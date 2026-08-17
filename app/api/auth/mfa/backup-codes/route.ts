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

  // المعلَّق لا يُعَدّ: ورقةٌ لم يُقِرّ بحفظها ليست ورقةً في يده، وعدُّها
  // يُطمئنه على ما لا يملك.
  const remaining = await prisma.mfaBackupCode.count({
    where: { userId: user.id, usedAt: null, pendingUntilConfirmed: false },
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
  // ثلاثٌ في الساعة: إعادةُ التوليد فعلٌ نادرٌ بطبعه (مرّةً عند التفعيل،
  // ومرّةً إن استُهلكت الأوراق)، وتكرارُها بلا حدٍّ يجعل جلسةً مسروقة
  // تُبطل أوراق صاحب الحساب مراراً حتى يفقد الثقة بها.
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

  // 🔴 **القديمة تبقى عاملةً حتى تُؤكَّد الجديدة.**
  //
  // كان الحذف والإنشاء في معاملةٍ واحدة، فمن ضغط «توليد» ثمّ أُغلق
  // متصفّحه - أو أغلق اللوحة قبل أن ينسخ - يخرج بلا ورقةٍ قديمة ولا
  // جديدة، ولا يكتشف ذلك إلّا يوم يفقد هاتفه.
  //
  // فتُكتب الجديدة معلّقة، ولا يُبطَل شيءٌ الآن. وأيّ محاولةِ توليدٍ
  // سابقةٍ لم تُؤكَّد تُمسح: المعلّق الوحيد هو ما يراه على شاشته الآن.
  await prisma.$transaction([
    prisma.mfaBackupCode.deleteMany({
      where: { userId: user.id, pendingUntilConfirmed: true },
    }),
    prisma.mfaBackupCode.createMany({
      data: hashes.map((codeHash) => ({
        userId: user.id,
        codeHash,
        pendingUntilConfirmed: true,
      })),
    }),
  ]);

  return NextResponse.json({ success: true, backupCodes: plain });
}

/** **إقرارُ الحفظ: هنا وحدها تُبطَل القديمة وتُفعَّل الجديدة.**
 *
 *  ولا يُنادى إلّا بعد أن ينسخ المستخدم أو يُنزّل - راجع الواجهة. */
export async function PATCH(req: NextRequest) {
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ errorKey: "apiErr.csrfFailed" }, { status: 403 });
  }

  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ errorKey: "apiErr.unauthorized" }, { status: 401 });

  const pending = await prisma.mfaBackupCode.count({
    where: { userId: user.id, pendingUntilConfirmed: true },
  });
  // لا معلَّقَ يُؤكَّد: طلبٌ متأخّرٌ أو مكرَّر. لا يُبطَل شيءٌ على شكّ.
  if (pending === 0) {
    return NextResponse.json({ success: true, confirmed: 0 });
  }

  await prisma.$transaction([
    // القديمة (غير المعلَّقة) تُبطَل الآن، بعد أن صار للمستخدم بديلٌ محفوظ
    prisma.mfaBackupCode.deleteMany({
      where: { userId: user.id, pendingUntilConfirmed: false },
    }),
    prisma.mfaBackupCode.updateMany({
      where: { userId: user.id, pendingUntilConfirmed: true },
      data: { pendingUntilConfirmed: false },
    }),
  ]);

  return NextResponse.json({ success: true, confirmed: pending });
}
