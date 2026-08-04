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
import { renderEmail } from "@/lib/emailTemplate";

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

    // 🔴 كان يقرأ `preferredLocale` من قاعدة البيانات وحدها، وافتراضه
    // العربية - بينما شاشات الحساب تفتح بالإنجليزية افتراضاً وتحفظ
    // اختيار الزائر في المتصفّح لا في حسابه. فمن يتصفّح بالإنجليزية
    // تصله الرسالة بالعربية.
    //
    // لغة الطلب أولى: من نسي كلمة مروره لا يستطيع الدخول ليصحّح تفضيله،
    // واللغة التي يقرأ بها الآن هي الإشارة الوحيدة الصادقة عمّا يفهمه.
    const requested = rawBody?.locale === "ar" || rawBody?.locale === "en" ? rawBody.locale : null;
    const isAr = (requested ?? user.preferredLocale ?? "en") === "ar";
    const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;

    if (resend) {
      try {
        await resend.emails.send({
          from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
          to: user.email,
          subject: isAr ? "إعادة تعيين كلمة المرور - AdLoop" : "Reset your password - AdLoop",
          html: renderEmail({
            locale: isAr ? "ar" : "en",
            art: "lock",
            title: isAr ? "إعادة تعيين كلمة المرور" : "Reset your password",
            blocks: [
              {
                text: isAr
                  ? "وصلنا طلب لإعادة تعيين كلمة مرور حسابك. الرابط أدناه صالح لساعة واحدة."
                  : "We received a request to reset your account password. The link below is valid for one hour.",
              },
              {
                // طمأنة صريحة: رسالة أمان تترك القارئ قلقاً هي رسالة فاشلة
                text: isAr
                  ? "إن لم تكن أنت من طلب ذلك، تجاهل هذه الرسالة تماماً - كلمة مرورك لم تتغيّر ولن تتغيّر."
                  : "If this was not you, ignore this email entirely - your password has not changed and will not change.",
              },
            ],
            cta: {
              label: isAr ? "إعادة تعيين كلمة المرور" : "Reset my password",
              url: resetUrl,
            },
          }),
        });
      } catch (err) {
        console.error("فشل إرسال إيميل إعادة تعيين كلمة المرور:", err);
      }
    }
  }

  return NextResponse.json({ success: true });
}
