// lib/notifications.ts
//
// قناة التنبيه العاجل - "داخل النظام" موجودة دايماً (Action Feed نفسه هو
// ده)، لكن دي الطبقة اللي بتقرر هل يوصل كمان إيميل، ومتى، بناءً على
// تفضيلات كل Workspace على حدة (مش كل حاجة بتتبعت لكل الناس بنفس الطريقة).

import { Resend } from "resend";
import { Locale } from "@/lib/i18n/dictionary";

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
    console.warn("RESEND_API_KEY غير مضبوط - تم تجاهل إرسال الإيميل");
    return;
  }

  const locale = params.locale ?? "ar";

  try {
    await resend.emails.send({
      // "onboarding@resend.dev" شغال فوراً بدون توثيق دومين - للتجربة
      // بس. للإنتاج الفعلي، لازم دومين موثّق (خطوة لاحقة، مش هنا)
      from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
      to: params.toEmail,
      // إصلاح G من الاختبار العدائي: بنشيل أي CRLF من الـ subject قبل
      // الاستخدام - دفاع إضافي ضد حقن هيدرات بريدية، حتى لو المخاطرة
      // العملية منخفضة جداً (عناوين الإيميل مش بتترجم HTML أصلاً)
      subject: sanitizeEmailHeader(`[${params.workspaceName}] ${params.title}`),
      html: `
        <div dir="${locale === "ar" ? "rtl" : "ltr"}" style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #171C27;">${escapeHtml(params.title)}</h2>
          ${params.description ? `<p style="color: #5C6478;">${escapeHtml(params.description)}</p>` : ""}
          <p style="color: #9AA1B0; font-size: 12px; margin-top: 24px;">
            ${locale === "ar" ? "مساحة العمل" : "Workspace"}: ${escapeHtml(params.workspaceName)}
          </p>
        </div>
      `,
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

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
