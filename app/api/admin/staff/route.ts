// app/api/admin/staff/route.ts
//
// منح صلاحية إدارية لحساب قائم، بالبريد.
//
// 🔴 **الفجوة اللي بيسدّها:** `[id]/role` كان بيقدر يمنح فعلاً (`OWNER`
// أو `SUPPORT` بيظبّطوا `isAdmin`)، لكن الواجهة بتسرد اللي `isAdmin`
// عندهم أصلاً - فمافيش أي طريق توصل بيه لحساب **لسه مش** أدمن. النتيجة
// إنّ إضافة أيّ زميل كانت بتتطلّب تعديل صفّ في قاعدة البيانات بالإيد،
// وده بالظبط اللي `SECURITY.md` بيقول إنّه مقصود للحماية - وهو مقصود
// فعلاً للمنع **الصامت**، لا لمنع مسار محروس ومسجَّل.
//
// **ومابنعملش حساباً جديداً هنا عن قصد.** الزميل بيسجّل بنفسه، يحطّ كلمة
// سرّه، ويفعّل التحقّق بخطوتين - تلاتتهم حاجات مايصحّ حد تاني يعملها
// نيابةً عنه. الحساب لازم يكون موجود، وإحنا بنمنح الصلاحية وبس.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { validateOrError } from "@/lib/validation/schemas";
import { resolveAdminRole } from "@/lib/adminRole";

const schema = z.object({
  email: z.string().email().max(254),
  // `NONE` مش مقبول هنا: ده مسار منح. السحب مكانه `[id]/role` اللي فيه
  // حارس "آخر مالك" - ولو اتقبل هنا كان هيبقى طريقاً تانياً للسحب بلا
  // نفس الحارس، وهي بالظبط الطريقة اللي بيتقفل بيها الجميع بره اللوحة.
  role: z.enum(["OWNER", "SUPPORT"]),
});

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req, {
    capability: "staff.manage",
    mutating: true,
    // منح صلاحية إدارية أخطر فعل في المنتج: بيدّي وصولاً لكل حساب وكل
    // رقم. لو فيه فعل واحد يستاهل إثباتاً طازجاً فهو ده.
    elevated: true,
  });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const { role } = validation.data;
  const email = validation.data.email.trim().toLowerCase();

  const target = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, isAdmin: true, adminRole: true, mfaEnabled: true, isSuspended: true },
  });

  if (!target) {
    return NextResponse.json(
      { error: "No account with that email. They need to sign up first — we grant access, we don't create accounts." },
      { status: 404 }
    );
  }

  // أدمن بالفعل: التوجيه لتغيير الدور بدل منحٍ صامت يدوس على دوره الحالي.
  if (resolveAdminRole(target)) {
    return NextResponse.json(
      { error: "That account already has admin access. Change its role in the table below." },
      { status: 400 }
    );
  }

  if (target.isSuspended) {
    return NextResponse.json(
      { error: "That account is suspended. Lift the suspension before granting access." },
      { status: 400 }
    );
  }

  // نفس شرط `[id]/role`: التحقّق بخطوتين شرط دخول اللوحة، فمنحٌ بدونه
  // بيخلق حساباً موصوفاً بأدمن ومش قادر يدخل - ورسالةٌ الآن أوضح من
  // اكتشافها بعد أول محاولة دخول فاشلة.
  if (!target.mfaEnabled) {
    return NextResponse.json(
      { error: "That account must turn on two-factor authentication before it can hold an admin role." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      isAdmin: true,
      adminRole: role,
      // الصلاحية الجديدة تسري على التبويبات المفتوحة دلوقتي، لا بعد
      // انتهاء جلسة عمرها ٣٠ يوم - نفس منطق تغيير الدور بالظبط.
      sessionInvalidatedAt: new Date(),
    },
  });

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "STAFF_GRANTED",
    targetUserId: target.id,
    details: `${guard.admin.email} granted ${target.email} the ${role} role`,
  });

  return NextResponse.json({ success: true, role, email: target.email });
}
