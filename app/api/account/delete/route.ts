// app/api/account/delete/route.ts
//
// حق "المحو" (Right to Erasure) - مطلوب قانونياً بموجب قانون حماية
// البيانات المصري وGDPR. بيمسح الحساب وكل البيانات المرتبطة بيه عن طريق
// Cascade في الـ schema (مساحات العمل، الحملات المربوطة، كل البيانات).
//
// أمان: بنطلب كلمة السر تاني كتأكيد - حذف نهائي، مفيش تراجع.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteAccountSchema, validateOrError } from "@/lib/validation/schemas";
import { verifyCsrfToken } from "@/lib/csrf";
import { workspaceOwnerFilter } from "@/lib/workspaceAccess";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const rawBody = await req.json();
  const validation = validateOrError(deleteAccountSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { password } = validation.data;
  const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!fullUser) return NextResponse.json({ error: "not found" }, { status: 404 });

  // إصلاح باگ حقيقي: حساب OAuth بلا باسورد خالص - bcrypt.compare كانت
  // هترمي خطأ وقت التشغيل. عكس إلغاء التحقق بخطوتين، حذف الحساب حق
  // أساسي لازم يفضل متاح - لحساب OAuth بس، جلسة الدخول نفسها (اللي
  // لازم تكون شغالة أصلاً عشان توصل للـ endpoint ده) هي التأكيد الكافي
  const isValid = fullUser.passwordHash
    ? await bcrypt.compare(password ?? "", fullUser.passwordHash)
    : true;
  if (!isValid) {
    return NextResponse.json({ error: t(locale, "apiErr.wrongPassword") }, { status: 401 });
  }

  // 🔴 **«المحو» كان يترك أكثر ممّا يمسح.**
  //
  // كان الراوت يعتمد على cascade المخطَّط وحده - وخمسة جداول تحمل بيانات
  // شخصية **لا مسار cascade لها إطلاقاً**: `UnmatchedClick` و
  // `AttributionResult` و`SessionConversion` تعرّف `workspaceId` نصّاً
  // مجرّداً بلا `@relation`، و`SupportThread` يعرّف `userId` بلا علاقة،
  // و`WaClick` جدولُ المتتبّع بلا عمود مالك أصلاً (مفتاحه `clientId`).
  // فبعد «الحذف النهائي» تبقى في القاعدة: اسمُ المشترك وبريده وهاتفه
  // ونصُّ تذاكره، **وأرقامُ هواتف زوّاره وعناوينهم**. أي أنّ بيانات
  // المتحكّم وبيانات المعالَجة تعيشان بعد حذفٍ تقدّمه الواجهة كنهائيّ.
  //
  // ولا تُضاف هنا علاقاتُ مفاتيح أجنبية بدل ذلك: `WaClick` يملكه المشروع
  // الآخر (تحذير المخطَّط عند `WaClick` صريح)، و`UnmatchedClick.workspaceId`
  // موثَّقٌ أنّه **قد لا يكون معرّف مساحة** - فقيدٌ أجنبيّ عليه قد يفشل عند
  // المزامنة فيوقف كلّ نشرة. الحذف الصريح يبلغ الغاية نفسها بلا هذا الخطر.
  const workspaces = await prisma.workspace.findMany({
    where: workspaceOwnerFilter(user.id),
    select: { id: true },
  });
  const workspaceIds = workspaces.map((w) => w.id);

  // مرفقات التذاكر تعيش في التخزين لا في القاعدة، فحذفُ الصفّ لا يمسّها.
  const attachments = await prisma.supportMessage.findMany({
    where: { thread: { userId: user.id } },
    select: { imageUrls: true },
  });
  const blobPaths = attachments
    .flatMap((m) => m.imageUrls)
    .filter((u) => u.startsWith("/api/support/attachment/"))
    .map((u) => `support/${u.slice("/api/support/attachment/".length)}`);

  if (blobPaths.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = await import("@vercel/blob");
      await del(blobPaths);
    } catch (err) {
      // فشلُ التخزين لا يمنع محو القاعدة: بقاءُ الحساب كلّه أسوأ من بقاء
      // ملفٍّ، ويُسجَّل ليُنظَّف يدوياً.
      console.error("[account/delete] تعذّر حذف مرفقات الدعم من التخزين:", err);
    }
  }

  await prisma.$transaction([
    ...(workspaceIds.length > 0
      ? [
          prisma.unmatchedClick.deleteMany({ where: { workspaceId: { in: workspaceIds } } }),
          prisma.attributionResult.deleteMany({ where: { workspaceId: { in: workspaceIds } } }),
          prisma.sessionConversion.deleteMany({ where: { workspaceId: { in: workspaceIds } } }),
          prisma.waClick.deleteMany({ where: { clientId: { in: workspaceIds } } }),
        ]
      : []),
    prisma.supportThread.deleteMany({ where: { userId: user.id } }),
    // الباقي يسقط بالـcascade مع المستخدم (المساحات، الحملات، التقارير…)
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  const response = NextResponse.json({ success: true });
  response.cookies.delete("session");
  return response;
}
