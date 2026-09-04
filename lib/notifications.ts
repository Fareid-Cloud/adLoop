// lib/notifications.ts
//
// قناة التنبيه العاجل - "داخل النظام" موجودة دايماً (Action Feed نفسه هو
// ده)، لكن دي الطبقة اللي بتقرر هل يوصل كمان إيميل، ومتى، بناءً على
// تفضيلات كل Workspace على حدة (مش كل حاجة بتتبعت لكل الناس بنفس الطريقة).

import { Resend } from "resend";
import { sendEmail } from "@/lib/sendEmail";
import { Locale } from "@/lib/i18n/dictionary";
import { renderEmail } from "@/lib/emailTemplate";
import { getAppUrl } from "@/lib/appUrl";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export type NotificationSeverity = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export interface NotificationPreferences {
  notifyUrgentByEmail: boolean;
  notifyHighByEmail: boolean;
  notificationEmail: string | null;
}

// بيقرر هل التنبيه ده يستاهل إيميل، مبني على درجته وتفضيلات الـ Workspace -
// منطق واحد موحّد، مش كل نقطة استدعاء بتحسب بنفسها
export function shouldSendEmail(
  severity: NotificationSeverity,
  prefs: NotificationPreferences
): boolean {
  if (severity === "URGENT") return prefs.notifyUrgentByEmail;
  if (severity === "HIGH") return prefs.notifyHighByEmail;
  return false; // MEDIUM/LOW دايماً داخل النظام بس - مفيش إغراق للإيميل بتنبيهات كتير
}

export async function sendUrgentNotificationEmail(params: {
  toEmail: string;
  workspaceName: string;
  title: string;
  description?: string | null;
  locale?: Locale;
}) {
  if (!resend) {
    // مفيش RESEND_API_KEY مضبوط - بنسجل تحذير بدل ما نفشل الطلب كله
    // 🔴 هذا الصمت هو سبب «التنبيهات لا تصلني»: كلّ شيء يعمل، ولا شيء
    // يُرسَل، ولا أثر لذلك إلّا سطر في سجلّ الخادم. التحذير صار صريحاً
    // ويحمل الخطوة التالية بدل أن يذكر اسم متغيّر ويصمت.
    console.warn(
      "[email] RESEND_API_KEY غير مضبوط - لم يُرسَل أيّ بريد. " +
        "التنبيهات تظهر في الجرس داخل التطبيق لكنها لن تصل بالبريد إطلاقاً. " +
        "اضبط RESEND_API_KEY وNOTIFICATION_FROM_EMAIL - راجع دليل التفعيل."
    );
    return;
  }

  const locale = params.locale ?? "en";

  try {
    await sendEmail({
      kind: "notification",
      // "onboarding@resend.dev" شغال فوراً بدون توثيق دومين - للتجربة
      // بس. للإنتاج الفعلي، لازم دومين موثّق (خطوة لاحقة، مش هنا)
      to: params.toEmail,
      // إصلاح G من الاختبار العدائي: بنشيل أي CRLF من الـ subject قبل
      // الاستخدام - دفاع إضافي ضد حقن هيدرات بريدية، حتى لو المخاطرة
      // العملية منخفضة جداً (عناوين الإيميل مش بتترجم HTML أصلاً)
      subject: sanitizeEmailHeader(`[${params.workspaceName}] ${params.title}`),
      html: renderEmail({
        locale,
        art: "alert",
        // «سياق ثمّ عنوان»: اسم مساحة العمل فوق بحرف صغير بدل حشره في
        // العنوان بين أقواس - العنوان يبقى للرسالة نفسها.
        eyebrow: params.workspaceName,
        title: params.title,
        tone: "urgent",
        blocks: [
          ...(params.description ? [{ text: params.description }] : []),
          {
            text:
              locale === "ar"
                ? "راجعناه لك ضمن الفحص اليومي، ولم نُرسله إلّا لأنّه يستحقّ نظرةً الآن لا لاحقاً."
                : "We caught this in your daily check, and only sent it because it is worth a look now rather than later.",
          },
        ],
        cta: {
          label: locale === "ar" ? "افتح لوحة القرارات" : "Open your decisions",
          url: `${getAppUrl()}/dashboard/actions`,
        },
        preferencesUrl: `${getAppUrl()}/dashboard/settings?tab=workspace`,
      }),
    });
  } catch (err) {
    // فشل إرسال الإيميل مش لازم يكسر باقي العملية (تسجيل المهمة/التنبيه
    // نفسه في قاعدة البيانات لازم يكمل حتى لو الإيميل فشل)
    console.error("فشل إرسال إيميل التنبيه:", err);
  }
}

function sanitizeEmailHeader(str: string): string {
  return str.replace(/[\r\n]/g, " ");
}


