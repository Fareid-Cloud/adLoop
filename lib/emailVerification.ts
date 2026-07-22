// lib/emailVerification.ts

import crypto from "crypto";
import { Resend } from "resend";
import { Locale } from "@/lib/i18n/dictionary";

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

  const locale = params.locale ?? "ar";
  const verifyUrl = `${process.env.APP_URL}/verify-email?token=${params.token}`;

  const isAr = locale === "ar";

  try {
    await resend.emails.send({
      from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
      to: params.toEmail,
      subject: isAr ? "تأكيد بريدك الإلكتروني - AdLoop" : "Verify your email - AdLoop",
      html: `
        <div dir="${isAr ? "rtl" : "ltr"}" style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #171C27;">${isAr ? "أهلاً بيك في AdLoop" : "Welcome to AdLoop"}</h2>
          <p style="color: #5C6478;">
            ${isAr ? "اضغط على الرابط ده عشان تأكد بريدك الإلكتروني:" : "Click the link below to verify your email:"}
          </p>
          <a href="${verifyUrl}" style="display: inline-block; background: #4C8DFF; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin: 12px 0;">
            ${isAr ? "تأكيد البريد الإلكتروني" : "Verify Email"}
          </a>
          <p style="color: #9AA1B0; font-size: 12px;">
            ${isAr ? "الرابط صالح لمدة 24 ساعة." : "This link expires in 24 hours."}
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("فشل إرسال إيميل التحقق:", err);
  }
}
