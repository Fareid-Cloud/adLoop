import { getAppUrl } from "@/lib/appUrl";
// lib/emailVerification.ts

import crypto from "crypto";
import { Resend } from "resend";
import { Locale } from "@/lib/i18n/dictionary";
import { renderEmail } from "@/lib/emailTemplate";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const TOKEN_EXPIRY_HOURS = 24;

export function generateVerificationToken(): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  return { token, expiresAt };
}

export async function sendVerificationEmail(params: {
  toEmail: string;
  token: string;
  locale?: Locale;
}) {
  if (!resend) {
    console.warn("RESEND_API_KEY غير مضبوط - تم تجاهل إرسال إيميل التحقق");
    return;
  }

  const locale = params.locale ?? "en";
  const verifyUrl = `${getAppUrl()}/verify-email?token=${params.token}`;

  const isAr = locale === "ar";

  try {
    await resend.emails.send({
      from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
      to: params.toEmail,
      subject: isAr ? "تأكيد بريدك الإلكتروني - AdLoop" : "Verify your email - AdLoop",
      html: renderEmail({
        locale,
        art: "verify",
        title: isAr ? "أهلاً بك في AdLoop" : "Welcome to AdLoop",
        blocks: [
          {
            text: isAr
              ? "خطوة واحدة وتبدأ: أكّد بريدك ليصير حسابك جاهزاً."
              : "One step and you are in: confirm your email to activate your account.",
          },
          {
            text: isAr
              ? "بعدها تربط حساباتك الإعلانية، ونبدأ في مقارنة ما تقوله المنصّات بما يحدث فعلاً - وهو الفارق الذي بُني هذا المنتج كلّه لأجله."
              : "After that you connect your ad accounts, and we start comparing what the platforms claim against what actually happened - the gap this whole product exists for.",
          },
        ],
        cta: {
          label: isAr ? "تأكيد البريد الإلكتروني" : "Verify my email",
          url: verifyUrl,
        },
      }),
    });
  } catch (err) {
    console.error("فشل إرسال إيميل التحقق:", err);
  }
}
