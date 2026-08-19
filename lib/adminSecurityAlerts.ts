// lib/adminSecurityAlerts.ts
//
// تنبيه أمني لحساب أدمن دخل من جهاز غير موثوق (أول مرة على الأقل، أو
// جهاز انتهت ثقته). صاحب لوحة تحكم شاملة (تعليق حسابات، تسعير مخصّص،
// انتحال أي عميل) يستاهل يعرف لحظة أي دخول جديد لحسابه هو تحديداً -
// مش بعد ما يحصل مشكلة.

import { Resend } from "resend";
import { renderEmail } from "@/lib/emailTemplate";
import { describeDevice } from "@/lib/mfa";
import { getAppUrl } from "@/lib/appUrl";
import type { Locale } from "@/lib/i18n/dictionary";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendNewAdminDeviceAlert(params: {
  toEmail: string;
  locale?: Locale;
  userAgent: string | null;
}) {
  if (!resend) {
    console.warn("[admin-security] RESEND_API_KEY غير مضبوط - لم يُرسَل تنبيه الجهاز الجديد");
    return;
  }

  const locale = params.locale ?? "ar";
  const ar = locale === "ar";
  const device = describeDevice(params.userAgent) ?? (ar ? "جهاز غير معروف" : "Unknown device");
  const when = new Date().toLocaleString(ar ? "ar-EG" : "en-US");

  try {
    await resend.emails.send({
      from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
      to: params.toEmail,
      subject: ar ? "دخول جديد للوحة المالك في AdLoop" : "New sign-in to your AdLoop owner panel",
      html: renderEmail({
        locale,
        art: "alert",
        tone: "urgent",
        title: ar ? "دخول جديد لحسابك" : "New sign-in to your account",
        subtitle: ar
          ? "حساب المالك بتاعك اتفتح دلوقتي من جهاز مش متسجّل عندنا كموثوق."
          : "Your owner account was just accessed from a device we don't have marked as trusted.",
        blocks: [
          { stat: { label: ar ? "الجهاز" : "Device", value: device } },
          { stat: { label: ar ? "الوقت" : "Time", value: when } },
          {
            text: ar
              ? "لو ده انت، مفيش حاجة تانية مطلوبة. لو مش انت، غيّر كلمة السر فوراً واستخدم \"تسجيل الخروج من كل مكان\" في الإعدادات → الأمان."
              : "If this was you, no action needed. If it wasn't, change your password immediately and use \"Sign out everywhere\" in Settings → Security.",
          },
        ],
        cta: {
          label: ar ? "افتح إعدادات الأمان" : "Open security settings",
          url: `${getAppUrl()}/dashboard/settings?tab=security`,
        },
      }),
    });
  } catch (err) {
    console.error("[admin-security] فشل إرسال تنبيه الجهاز الجديد:", err);
  }
}
