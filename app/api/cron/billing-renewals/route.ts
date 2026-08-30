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
// ═══ ما لا تفعله هذه المهمّة عمداً: لا تسحب من بطاقة ═══
//
// الخطّة الأصلية اقترحت خصماً تلقائياً من `savedCardToken`. والحقل موجود
// في المخطَّط **ولا يكتبه أحد**، ولا توجد في المستودع دالّةُ سحبٍ بتوكن
// أصلاً (`lib/paymob.ts` يُنشئ نيّة دفعٍ تفاعلية وحدها). وبناءُ مسارِ
// سحبٍ حقيقيٍّ من بطاقات العملاء على تكاملٍ **ترتيبُ توقيعه غير مؤكَّد
// بعد** (راجع `docs/activation-checklist.md`) وبلا أيّ بيئةٍ لتجريبه =
// خصمٌ مزدوجٌ أو بمبلغٍ خاطئ على مالٍ حقيقيّ. فالتجديد يبقى بضغطةٍ من
// المشترك، وهذه المهمّة تضمن أن يعرف **قبل** أن ينقطع لا بعده.

import { NextRequest } from "next/server";
import { denyUnlessCron } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";
import { finishCronRun } from "@/lib/cronRun";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const maxDuration = 300;

/** كم يوماً قبل الانتهاء يبدأ التنبيه. */
const REMIND_WITHIN_DAYS = 3;
/** لا يتكرّر التنبيه نفسه داخل هذه المدّة. */
const COOLDOWN_DAYS = 2;

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
      preferredLocale: true,
      currentPeriodEnd: true,
      subscriptionPlan: true,
      // الحساب المعلَّق لا يصله تنبيه - راجع `lib/accountActive.ts`.
      isSuspended: true,
      // مساحةٌ حقيقية واحدة تكفي لعرض التنبيه فيها. والعرض التجريبيّ
      // مستثنى: تنبيهُ فوترةٍ داخل مساحة عرضٍ يربك أكثر ممّا يفيد.
      workspaces: { where: { isDemo: false }, select: { id: true }, take: 1 },
    },
  });

  let reminded = 0;
  let lapsed = 0;

  for (const user of subscribers) {
    if (user.isSuspended || !user.currentPeriodEnd) continue;
    const workspaceId = user.workspaces[0]?.id;
    const locale: Locale = (user.preferredLocale as Locale) ?? "ar";

    try {
      // ── انتهت الفترة: تُسجَّل الحالة ويُخطَر صاحبها ──────────────
      if (user.currentPeriodEnd <= now) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: "PAST_DUE" },
          }),
          prisma.subscriptionEvent.create({
            data: {
              userId: user.id,
              type: "EXPIRED",
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
      if (user.currentPeriodEnd <= soon && workspaceId) {
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
    { reminded, lapsed }
  );
}
