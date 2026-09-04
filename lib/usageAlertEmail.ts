// lib/usageAlertEmail.ts
//
// **تنبيه استهلاك غير طبيعي - بالبريد، لا في شاشة تُفتَح.**
//
// كشفُ الشذوذ مبنيٌّ ودقيق (`lib/admin/usage.ts`): استهلاكُ الحساب مقابل
// **متوسّطه هو** لا متوسّط الجميع، بثلاثة أضعاف وبحدٍّ أدنى خمس نداءات -
// فالعميلُ الكبير مايتوسمش شاذّاً كلّ يوم. المشكلةُ إنّ النتيجة كانت
// بتستنّى حدّاً يفتح `/admin/analytics`، واستهلاكُ نداءات Claude **بيكلّف
// فلوساً وهو ماشي**: اللي بيتكشف بعد أسبوع بيكون اتدفع أسبوعاً.
//
// ═══ يُرسَل لمّا يبقى فيه حاجة، ويسكت لمّا مافيش ═══
//
// مافيش «تقرير يوميّ» بيوصل كلّ صباح فيه «كلُّ شيء طبيعي». الرسالةُ اللي
// بتيجي كلّ يوم بتتقري بعد أسبوع بالعين المغلقة، فأوّلُ يومٍ فيه مشكلة
// حقيقية بيعدّي مع الباقي. الصمتُ هنا هو اللي بيدّي للرسالة معناها.

import { Resend } from "resend";
import { sendEmail } from "@/lib/sendEmail";
import { getAppUrl } from "@/lib/appUrl";
import { renderEmail } from "@/lib/emailTemplate";
import { OWNER_EMAIL } from "@/lib/owner";
import { getUsageOverview } from "@/lib/admin/usage";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const OWNER_INBOX = (process.env.SUPPORT_INBOX_EMAIL || OWNER_EMAIL || "").trim();

/**
 * بيتنده بعد `captureUsageSnapshots` مباشرةً في الكرون اليوميّ.
 *
 * التوقيتُ مقصود: الشذوذُ بيتقري من **آخر لقطة يوميّة كاملة**، فالنداء
 * بعد كتابتها بيقارن يوماً منتهياً بمتوسّطه - لا «اليوم لحدّ دلوقتي»
 * وهو لسه ساعتين.
 */
export async function sendUsageAnomalyAlert(): Promise<{ sent: boolean; anomalies: number }> {
  const usage = await getUsageOverview(30);
  if (usage.anomalies.length === 0) return { sent: false, anomalies: 0 };

  if (!resend || !OWNER_INBOX) {
    console.warn(
      `[usage-alert] ${usage.anomalies.length} حساباً باستهلاك شاذّ - بلا بريد (Resend/العنوان غير مضبوط). يُقرأ من /admin/analytics?tab=usage`
    );
    return { sent: false, anomalies: usage.anomalies.length };
  }

  const top = usage.anomalies[0];

  // التكلفةُ في المتن لو كانت مضبوطة: الرقمُ اللي بيخلّي الرسالة تُقرأ
  // فوراً هو الفلوس، لا عددُ النداءات.
  const costLine = usage.costConfigured && usage.totalEstimatedCostUsd !== null
    ? [{ stat: { label: "التكلفة التقديرية (30 يوماً)", value: `$${usage.totalEstimatedCostUsd.toFixed(2)}` } }]
    : [{ text: "التكلفة التقديرية غير معروضة: CLAUDE_COST_PER_MTOK_USD غير مضبوط." }];

  try {
    await sendEmail({
      kind: "usage-alert",
      to: OWNER_INBOX,
      subject:
        usage.anomalies.length === 1
          ? `استهلاك غير طبيعي — ${top.email} (${top.multiple}×)`
          : `استهلاك غير طبيعي — ${usage.anomalies.length} حسابات`,
      html: renderEmail({
        locale: "ar",
        art: "alert",
        tone: "urgent",
        eyebrow: "استهلاك الذكاء الاصطناعي",
        title:
          usage.anomalies.length === 1
            ? "حساب واحد استهلك أضعاف معدّله"
            : `${usage.anomalies.length} حسابات استهلكت أضعاف معدّلها`,
        subtitle: "المقارنة بمعدّل كلّ حساب نفسه خلال آخر ثلاثين يوماً، لا بمعدّل الجميع.",
        blocks: [
          // كلُّ حساب في سطرٍ واحد: مين، كام النهارده، وكام معدّله.
          // الثلاثةُ مع بعض هما القرار - رقمٌ واحد منهم مايقولش حاجة.
          ...usage.anomalies.slice(0, 10).map((a) => ({
            stat: {
              label: a.email,
              value: `${a.todayCalls} نداءً مقابل معدّل ${a.averageCalls} (${a.multiple}×)`,
            },
          })),
          ...costLine,
          {
            text:
              "الاستهلاك الشاذّ ليس بالضرورة إساءة: قد يكون عميلاً بدأ يستخدم المنتج بجدّية. " +
              "افتح الحساب قبل أيّ إجراء - حدود الباقة تُضبط من صفحته.",
          },
        ],
        cta: { label: "افتح لوحة الاستهلاك", url: `${getAppUrl()}/admin/analytics?tab=usage` },
      }),
    });
    return { sent: true, anomalies: usage.anomalies.length };
  } catch (err) {
    console.error("[usage-alert] فشل إرسال تنبيه الاستهلاك:", err);
    return { sent: false, anomalies: usage.anomalies.length };
  }
}
