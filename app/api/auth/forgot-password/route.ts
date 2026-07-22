import { getAppUrl } from "@/lib/appUrl";
// app/api/auth/forgot-password/route.ts
//
// أمان مهم: بنرجّع نفس الرسالة سواء الإيميل موجود ولا لأ - عشان محدش
// يقدر "يجرب" إيميلات ويعرف مين عنده حساب على المنتج (نفس مبدأ تسجيل
// الدخول). التوكن صالح ساعة واحدة بس - أقصر بكتير من تحقق البريد
// (24 ساعة) لأنه بيدّي وصول لتغيير كلمة السر مباشرة، أخطر لو اتسرب.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { forgotPasswordSchema, validateOrError } from "@/lib/validation/schemas";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const TOKEN_EXPIRY_MINUTES = 60;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "forgot-password", 5, 60);
  if (!allowed) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const rawBody = await req.json();
  const validation = validateOrError(forgotPasswordSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { email } = validation.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // بنكمل بنفس الرد بالظبط سواء لقيناه ولا لأ - منسربش معلومة "الإيميل ده مسجّل"
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: token, resetPasswordTokenExpiresAt: expiresAt },
    });

    const isAr = (user.preferredLocale ?? "ar") === "ar";
    const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;

    if (resend) {
      try {
        await resend.emails.send({
          from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
          to: user.email,
          subject: isAr ? "إعادة تعيين كلمة المرور - AdLoop" : "Reset your password - AdLoop",
          html: `
            <div dir="${isAr ? "rtl" : "ltr"}" style="font-family: sans-serif; padding: 20px;">
              <h2 style="color: #171C27;">${isAr ? "إعادة تعيين كلمة المرور" : "Reset your password"}</h2>
              <p style="color: #5C6478;">
                ${isAr ? "اضغط على الرابط ده خلال ساعة عشان تعيد تعيين كلمة المرور:" : "Click the link below within one hour to reset your password:"}
              </p>
              <a href="${resetUrl}" style="display: inline-block; background: #4C8DFF; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
                ${isAr ? "إعادة تعيين كلمة المرور" : "Reset Password"}
              </a>
              <p style="color: #9AA1B0; font-size: 12px; margin-top: 16px;">
                ${isAr ? "لو معملتش الطلب ده، تجاهل الإيميل - حسابك آمن." : "If you didn't request this, ignore this email - your account is safe."}
              </p>
            </div>
          `,
        });
      } catch (err) {
        console.error("فشل إرسال إيميل إعادة تعيين كلمة المرور:", err);
      }
    }
  }

  return NextResponse.json({ success: true });
}
