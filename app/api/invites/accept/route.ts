// app/api/invites/accept/route.ts
//
// قبولُ دعوةِ مقعد.
//
// **لازم يكون مسجّلاً دخوله بالفعل.** مابنعملش حساباً هنا: إنشاءُ حسابٍ
// نيابةً عن حدّ معناه كلمةُ سرٍّ مانعرفهاش أو حسابٌ بلا كلمة سر، والاتنين
// أسوأ من خطوةٍ زيادة. اللي معاه الرابط بيسجّل عادي وبيرجع له.

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { verifyCsrfToken } from "@/lib/csrf";
import { validateOrError } from "@/lib/validation/schemas";

const schema = z.object({ token: z.string().min(20).max(200) });

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const tokenHash = crypto.createHash("sha256").update(validation.data.token).digest("hex");
  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash },
    select: { id: true, workspaceId: true, email: true, role: true, expiresAt: true, acceptedAt: true },
  });

  // رسالةٌ واحدة للحالات الثلاث (مش موجودة / منتهية / مستهلَكة): التفرقة
  // بينها بتقول لحامل رابطٍ مسروق إن كان صالحاً يوماً ما، وهي معلومةٌ
  // مايستاهلهاش.
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "this invitation is no longer valid" }, { status: 400 });
  }

  // 🔴 **الدعوة لبريدٍ بعينه.** بدون الفحص ده، رابطٌ اتسرّب من بريدِ
  // المدعوّ بيدّي الوصول لأيّ حساب يفتحه - والحدُّ اللي الباقة بتبيعه
  // بيتخطّى بحدّ مش مدعوٍّ أصلاً.
  if (user.email.trim().toLowerCase() !== invite.email) {
    return NextResponse.json(
      { error: "this invitation was sent to a different email address" },
      { status: 403 }
    );
  }

  await prisma.$transaction([
    prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
      create: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role },
      update: { role: invite.role },
    }),
    // الاستهلاك في نفس المعاملة: بلا ذلك رابطٌ واحد يُستعمَل مرّتين في
    // نافذةٍ بين الكتابتين.
    prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true, workspaceId: invite.workspaceId });
}
