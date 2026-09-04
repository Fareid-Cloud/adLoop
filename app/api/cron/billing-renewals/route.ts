// app/api/cron/billing-renewals/route.ts
//
// **دورة حياة الاشتراك بعد الشراء - وكانت غير مبنيّة إطلاقاً.**
//
// 🔴 لم يكن في المستودع كلّه كاتبٌ واحد لـ`PAST_DUE`. وأثرُ ذلك أوسع من
// حقلٍ لا يُملأ: `getEntitlements` يقرأ الحالة `EXPIRED` من `PAST_DUE`
// وحدها، فكانت **غير قابلة للوصول أبداً** - ومعها ماتت حملةُ الاسترجاع
// (`lib/marketing/campaigns.ts` تنتظر `EXPIRED`) و`subscriptionAlerts.ts`
// كاملاً (يبدأ بـ`!== "PAST_DUE"` فيخرج دائماً). ثلاثُ ميزاتٍ مبنيّةٌ
// تنتظر إشارةً لا يرسلها أحد.
//
// والأهمّ للمشترك: لا شيء كان ينبّهه أنّ فترته تنتهي. `activePaid` يشترط
// `currentPeriodEnd > now`، فالوصول يسقط إلى المجّانية **في لحظةٍ صامتة**
// - تتوقّف المزامنة ويتوقّف التحقّق ولا رسالة قبلها ولا بعدها.
//
// ═══ التجديد التلقائيّ: يتجدّد ما لم يُلغِ صاحبُه ═══
//
// **القاعدة:** من لم يُلغِ يُجدَّد له تلقائياً من كارته المحفوظ قبل أن
// يُقال إنّ فترته انقضت. ومن ألغى تُحترَم إرادتُه بلا محاولةِ خصم.
//
// 🔴 **وهذا مغلقٌ ببنيته حتى يُفعَّل MOTO في لوحة Paymob.**
// `renewViaSavedCard` تخرج بـ`not_configured` بلا أيّ نداءٍ خارجيّ ما لم
// يوجد `PAYMOB_MOTO_INTEGRATION_ID` - وهو متغيّرٌ لا يُوجَد إلّا بعد
// موافقة Paymob على خدمة التجديد. فحتى ذلك الحين سلوكُ هذه المهمّة هو
// سلوكُها السابق حرفياً: تذكيرٌ قبل الانقطاع، ثمّ `PAST_DUE`.
//
// وترتيبُ حقول MOTO لم تُثبِته دفعةٌ حقيقيّة بعد - كما كان توقيعُ الويب
// هوك تخميناً حتى أثبتَته دفعةٌ واحدة. فأوّلُ تجديدٍ تلقائيٍّ يُراقَب.

import { NextRequest } from "next/server";
import { sendEmail } from "@/lib/sendEmail";
import { denyUnlessCron } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";
import { finishCronRun } from "@/lib/cronRun";
import { renewViaSavedCard } from "@/lib/billing";
import { isAutoChargeConfigured } from "@/lib/paymob";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const maxDuration = 300;

/** كم يوماً قبل الانتهاء يبدأ التنبيه. */
const REMIND_WITHIN_DAYS = 3;
/** لا يتكرّر التنبيه نفسه داخل هذه المدّة. */
const COOLDOWN_DAYS = 2;

/**
 * تذكيرٌ بالبريد. فشلُه لا يُفشِل الدورة: البند في الفيد وُضع أو سيوضع،
 * والتذكير قناةٌ ثانية لا شرطٌ لصحّة الحساب.
 */
async function sendRenewalReminderEmail(
  email: string,
  locale: Locale,
  days: number,
  /** هل سيُحصَّل تلقائياً فعلاً؟ الرسالتان مختلفتان تماماً. */
  autoRenew: boolean
) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import("resend");
    const { renderEmail } = await import("@/lib/emailTemplate");
    const { getAppUrl } = await import("@/lib/appUrl");
    const resend = new Resend(process.env.RESEND_API_KEY);

    await sendEmail({
      kind: "renewal",
      to: email,
      subject: t(locale, "alerts.renewalEmailSubject", { days }),
      html: renderEmail({
        locale,
        art: "loop",
        title: t(locale, "alerts.renewalEmailTitle"),
        subtitle: t(locale, autoRenew ? "alerts.renewalEmailSubtitleAuto" : "alerts.renewalEmailSubtitle"),
        blocks: [
          {
            stat: {
              label: t(locale, "alerts.renewalEmailDaysLabel"),
              value: t(locale, "alerts.renewalEmailDaysValue", { days }),
            },
          },
          { text: t(locale, "alerts.renewalEmailBody") },
        ],
        cta: { label: t(locale, "alerts.renewalEmailCta"), url: `${getAppUrl()}/dashboard/billing` },
        preferencesUrl: `${getAppUrl()}/dashboard/settings?tab=preferences`,
      }),
    });
  } catch (err) {
    console.error("[billing-renewals] تعذّر إرسال تذكير التجديد:", err);
  }
}

export async function GET(req: NextRequest) {
  const denied = denyUnlessCron(req);
  if (denied) return denied;

  const startedAt = Date.now();
  const now = new Date();
  const soon = new Date(now.getTime() + REMIND_WITHIN_DAYS * 86_400_000);
  const cooldownStart = new Date(now.getTime() - COOLDOWN_DAYS * 86_400_000);
  const failures: Array<{ userId: string; error: string }> = [];

  const subscribers = await prisma.user.findMany({
    where: { subscriptionStatus: "ACTIVE", currentPeriodEnd: { not: null } },
    select: {
      id: true,
      email: true,
      preferredLocale: true,
      currentPeriodEnd: true,
      subscriptionPlan: true,
      // من ألغى بنفسه يعرف أنّ فترته تنتهي - تذكيرُه بالتجديد إلحاحٌ على
      // قرارٍ اتّخذه. يُسجَّل انتهاؤه ولا يُنبَّه قبله.
      cancelAtPeriodEnd: true,
      // يحدّد نصّ التذكير: «سيُجدَّد تلقائياً» أم «التجديد بيدك».
      savedCardToken: true,
      // الحساب المعلَّق لا يصله تنبيه - راجع `lib/accountActive.ts`.
      isSuspended: true,
      // مساحةٌ حقيقية واحدة تكفي لعرض التنبيه فيها. والعرض التجريبيّ
      // مستثنى: تنبيهُ فوترةٍ داخل مساحة عرضٍ يربك أكثر ممّا يفيد.
      workspaces: { where: { isDemo: false }, select: { id: true }, take: 1 },
    },
  });

  let reminded = 0;
  let lapsed = 0;
  let renewed = 0;

  for (const user of subscribers) {
    if (user.isSuspended || !user.currentPeriodEnd) continue;
    const workspaceId = user.workspaces[0]?.id;
    const locale: Locale = (user.preferredLocale as Locale) ?? "en";

    try {
      // ── انتهت الفترة: تُحاوَل التجديد أوّلاً، ثمّ تُسجَّل النهاية ──
      if (user.currentPeriodEnd <= now) {
        // **الاشتراك يتجدّد تلقائياً ما لم يُلغِه صاحبُه.** فمن لم يُلغِ
        // تُحاوَل له دفعةٌ من كارته المحفوظ قبل أيّ حديثٍ عن انقضاء.
        //
        // ولا يتغيّر شيءٌ ما لم يُفعَّل MOTO: `renewViaSavedCard` تخرج
        // بـ`not_configured` بلا نداءٍ واحد، فيهبط التنفيذ إلى المسار
        // الآمن نفسه الذي كان يعمل قبل اليوم.
        if (!user.cancelAtPeriodEnd) {
          const renewal = await renewViaSavedCard(user.id);
          if (renewal.ok) {
            renewed++;
            continue; // الفترة امتدّت - لا انقضاء ولا إخطار
          }
        }

        // **مَن ألغى ليس مَن تعثّر دفعُه.** `PAST_DUE` تعني «فشل الدفع»،
        // و`getEntitlements` تشتقّ منها `EXPIRED` التي تُشغّل حملةَ الاسترجاع
        // و`subscriptionAlerts` («فشل الدفع - حدّث بيانات بطاقتك»). فوسمُ من
        // ألغى بإرادته بها يلاحقه برسائل عن عطبٍ لم يقع، ويطالبه بإصلاح
        // بطاقةٍ لم تُرفَض. الإلغاء `CANCELED` - نهايةٌ مقصودة لا تعثّر.
        const endedByChoice = user.cancelAtPeriodEnd;
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: endedByChoice ? "CANCELED" : "PAST_DUE" },
          }),
          prisma.subscriptionEvent.create({
            data: {
              userId: user.id,
              type: endedByChoice ? "CANCELLED" : "EXPIRED",
              fromPlan: user.subscriptionPlan ?? null,
              toPlan: "free",
            },
          }),
        ]);
        lapsed++;

        if (workspaceId) {
          await pushToActionFeed({
            workspaceId,
            source: "ACCOUNT",
            type: "ACCOUNT",
            severity: "HIGH",
            title: t(locale, "alerts.subscriptionLapsedTitle"),
            titleKey: "alerts.subscriptionLapsedTitle",
            description: t(locale, "alerts.subscriptionLapsedBody"),
            descKey: "alerts.subscriptionLapsedBody",
            linkUrl: "/dashboard/billing",
          });
        }
        continue;
      }

      // ── تقترب الفترة من نهايتها: تذكيرٌ قبل الانقطاع ──────────────
      if (user.currentPeriodEnd <= soon && workspaceId && !user.cancelAtPeriodEnd) {
        const already = await prisma.actionFeedItem.findFirst({
          // بالمفتاح لا بالنصّ: النصّ يتبدّل بلغة القارئ، فالبحث فيه
          // يكسر منعَ التكرار بصمت. نفس عادة `subscriptionAlerts.ts`.
          where: {
            workspaceId,
            titleKey: "alerts.renewalDueTitle",
            createdAt: { gte: cooldownStart },
          },
          select: { id: true },
        });
        if (already) continue;

        const days = Math.max(
          1,
          Math.ceil((user.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000)
        );

        // بريدٌ إلى جانب البند في الفيد: إشعارُ الدفع لا يصل إلّا لمن فعّله
        // (`pushSubscriptions: { some: {} }`)، والبندُ في الفيد لا يُرى إلّا
        // لمن يفتح اللوحة - ومَن فترتُه على وشك الانتهاء قد يكون تركها.
        // فالبريد هو القناة التي عند الجميع.
        await sendRenewalReminderEmail(
          user.email,
          locale,
          days,
          Boolean(user.savedCardToken) && isAutoChargeConfigured()
        );

        await pushToActionFeed({
          workspaceId,
          source: "ACCOUNT",
          type: "ACCOUNT",
          severity: "MEDIUM",
          title: t(locale, "alerts.renewalDueTitle", { days }),
          titleKey: "alerts.renewalDueTitle",
          titleVars: { days },
          description: t(locale, "alerts.renewalDueBody"),
          descKey: "alerts.renewalDueBody",
          linkUrl: "/dashboard/billing",
        });
        reminded++;
      }
    } catch (err) {
      // فشلُ مشتركٍ واحد لا يوقف الدورة على الباقين - نفس عادة بقيّة الكرونات
      console.error(`[billing-renewals] فشلت المعالجة للمستخدم ${user.id}:`, err);
      failures.push({ userId: user.id, error: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
    }
  }

  return finishCronRun(
    {
      job: "billing-renewals",
      total: subscribers.length,
      succeeded: subscribers.length - failures.length,
      failed: failures.length,
      startedAt,
      errors: failures,
    },
    { reminded, lapsed, renewed }
  );
}
