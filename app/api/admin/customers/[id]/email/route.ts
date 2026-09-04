// app/api/admin/customers/[id]/email/route.ts
//
// رسالة فردية من المالك لعميل بعينه.
//
// **منفصلة عن محرّك الحملات عمداً.** ذاك بيرسل رسائل معرَّفة مسبقاً بجدول
// وبقيد تفرّد يمنع تكرار نفس الرسالة، وده نصّ حرّ بيتكتب في اللحظة
// وبيتكرّر بطبيعته. دمجهم كان معناه إمّا إنّ قيد التفرّد يمنع المالك من
// يبعت تاني لنفس العميل، أو إنّ فكّه بيفتح باب تكرار رسائل الحملات.
//
// ⚠️ **بيتجاهل `marketingOptOut` بقرار صريح**: إلغاء الاشتراك في التسويق
// مالوش علاقة برد المالك على مشكلة، ومعاملة الاتنين واحد كانت هتمنع
// الدعم عن اللي طلب ما يوصلوش إعلانات.

import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendEmail";
import { z } from "zod";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { validateOrError } from "@/lib/validation/schemas";
import { renderEmail } from "@/lib/emailTemplate";
import { getAppUrl } from "@/lib/appUrl";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const schema = z.object({
  subject: z.string().min(3).max(150),
  body: z.string().min(10).max(5_000),
  /** رابط اختياري تحت النصّ - "افتح اللوحة"، "جدّد اشتراكك" */
  ctaLabel: z.string().max(60).optional(),
  ctaPath: z.string().max(200).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardAdmin(req, { capability: "customers.email", mutating: true });
  if (!guard.ok) return guard.response;

  // سقف على الإرسال: صندوق بريد المنتج سمعته مشتركة، وأي إرسال مكثّف من
  // اللوحة بيأثّر على وصول رسائل النظام نفسها (التحقّق، إعادة التعيين).
  const { allowed } = await checkRateLimit(guard.admin.id, "admin-email", 30, 60);
  if (!allowed) return NextResponse.json({ error: "too many emails, slow down" }, { status: 429 });
  void getClientIp(req);

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const body = validation.data;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { email: true, name: true, preferredLocale: true },
  });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (!resend) {
    return NextResponse.json({ error: "email is not configured (RESEND_API_KEY)" }, { status: 503 });
  }

  // لغة العميل هي لغة الرسالة، مش لغة اللوحة. اللوحة إنجليزية بقرار
  // داخلي، والرسالة بتروح لعميل عربيّ يقرا بلغته.
  const locale: "ar" | "en" = target.preferredLocale === "en" ? "en" : "ar";

  const cta =
    body.ctaLabel && body.ctaPath
      ? { label: body.ctaLabel, url: `${getAppUrl()}${body.ctaPath.startsWith("/") ? "" : "/"}${body.ctaPath}` }
      : undefined;

  const html = renderEmail({
    locale,
    art: "none",
    title: body.subject,
    // فقرة لكل سطر فارغ: المالك بيكتب في مربّع نصّ عادي، وبلا التقسيم ده
    // الرسالة كلها بتوصل كتلة واحدة.
    blocks: body.body
      .split(/\n{2,}/)
      .map((p) => ({ text: p.trim() }))
      .filter((b) => b.text.length > 0),
    cta,
    tone: "neutral",
  });

  try {
    await sendEmail({
      kind: "admin-direct",
      to: target.email,
      subject: body.subject,
      html,
    });
  } catch (err) {
    console.error("[adminEmail] فشل الإرسال", err);
    return NextResponse.json({ error: "send failed" }, { status: 502 });
  }

  // السجلّ **بعد** نجاح الإرسال: صفّ مكتوب لرسالة ماوصلتش بيخلّي المالك
  // يفتكر إنه ردّ على العميل وهو ماردّش.
  await prisma.adminEmailLog.create({
    data: { userId: id, adminUserId: guard.admin.id, subject: body.subject, body: body.body },
  });
  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "SEND_EMAIL",
    targetUserId: id,
    details: `${guard.admin.email} → ${target.email}: ${body.subject}`,
  });

  return NextResponse.json({ success: true });
}
