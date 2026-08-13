// app/api/auth/mfa/backup-codes/route.ts
//
// عدّ الأكواد المتبقّية (GET)، وتوليد مجموعةٍ جديدة (POST).
//
// 🔴 **لا مسارَ لقراءة الأكواد نفسها - وهذا مقصود.** المخزَّن مجزّأٌ لا
// نصّ، فنحن لا نملكها بعد لحظة التوليد. ولو ملكناها لكان من يقرأ قاعدة
// البيانات يملك مفاتيح كلّ حساب.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { verifyCsrfToken } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateBackupCodes } from "@/lib/mfa";

export async function GET() {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ errorKey: "apiErr.unauthorized" }, { status: 401 });

  const remaining = await prisma.mfaBackupCode.count({
    where: { userId: user.id, usedAt: null },
  });
  return NextResponse.json({ remaining });
}

export async function POST(req: NextRequest) {
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ errorKey: "apiErr.csrfFailed" }, { status: 403 });
  }

  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ errorKey: "apiErr.unauthorized" }, { status: 401 });

  // إعادةُ التوليد تُبطل القديمة، فهي فعلٌ يستحقّ حدّاً: جلسةٌ مسروقة قد
  // تستعملها لإبطال أوراق صاحب الحساب مراراً حتى يفقد الثقة بها.
  const { allowed } = await checkRateLimit(user.id, "mfa-backup-codes", 3, 60);
  if (!allowed) {
    return NextResponse.json({ errorKey: "apiErr.tooManyAttempts" }, { status: 429 });
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mfaEnabled: true },
  });
  // أكوادُ استرجاعٍ لحسابٍ بلا تحقّقٍ بخطوتين لا معنى لها - ولا شيء تسترجعه.
  if (!record?.mfaEnabled) {
    return NextResponse.json({ errorKey: "apiErr.mfaNotEnabled" }, { status: 400 });
  }

  const { plain, hashes } = await generateBackupCodes();

  // الحذف والإنشاء معاً: لو فشل الإنشاء بعد حذفٍ ناجح، لبقي الحساب بلا
  // أيّ كودٍ دون أن يعلم صاحبُه - وهو أسوأ من فشلٍ صريح.
  await prisma.$transaction([
    prisma.mfaBackupCode.deleteMany({ where: { userId: user.id } }),
    prisma.mfaBackupCode.createMany({
      data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
    }),
  ]);

  return NextResponse.json({ success: true, backupCodes: plain });
}
