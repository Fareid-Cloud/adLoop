// lib/mfaEmailCode.ts
//
// رسالة كود الدخول الاحتياطيّ. تُبنى بالقالب نفسه الذي تُبنى به رسائل
// المنتج - رسالةٌ بشكلٍ آخر تُقرأ تصيّداً لا رسالةً من عندنا.

import { Resend } from "resend";
import { renderEmail } from "@/lib/emailTemplate";
import { EMAIL_CODE_TTL_MINUTES } from "@/lib/mfa";
import type { Locale } from "@/lib/i18n/dictionary";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendMfaEmailCode(params: {
  toEmail: string;
  code: string;
  locale: Locale;
}) {
  if (!resend) {
    console.warn("RESEND_API_KEY not set - MFA email code was not sent");
    return;
  }

  const isAr = params.locale === "ar";

  try {
    await resend.emails.send({
      from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
      to: params.toEmail,
      subject: isAr ? `كود الدخول: ${params.code}` : `Your sign-in code: ${params.code}`,
      html: renderEmail({
        locale: params.locale,
        art: "lock",
        title: isAr ? "كود دخولٍ لمرّة واحدة" : "A one-time sign-in code",
        blocks: [
          // الكود في أوّل سطرٍ يُقرأ: أكثر من يفتح هذه الرسالة يريده وحده.
          {
            text: isAr
              ? `<span style="font-size:28px;letter-spacing:6px;font-weight:700">${params.code}</span>`
              : `<span style="font-size:28px;letter-spacing:6px;font-weight:700">${params.code}</span>`,
          },
          {
            text: isAr
              ? `ينتهي خلال ${EMAIL_CODE_TTL_MINUTES} دقائق، ولا يعمل إلّا مرّةً واحدة.`
              : `It expires in ${EMAIL_CODE_TTL_MINUTES} minutes and works once.`,
          },
          // 🔴 الجملة التي تجعل الرسالة إنذاراً لا إزعاجاً: من لم يطلبها
          // يعرف من فورها أنّ كلمة مروره في يد غيره - وهي المعلومة التي
          // تُنقذ الحساب قبل أن يُفتَح.
          {
            text: isAr
              ? "لم تطلب هذا الكود؟ إذاً أحدهم يعرف كلمة مرورك. لم يدخل حسابك - التحقّق بخطوتين منعه - لكن غيّر كلمة مرورك الآن."
              : "Did not ask for this? Then someone knows your password. They did not get in - two-step verification stopped them - but change your password now.",
          },
        ],
      }),
    });
  } catch (err) {
    console.error("Failed to send MFA email code:", err);
  }
}
