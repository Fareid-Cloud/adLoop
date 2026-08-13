// app/api/auth/mfa/verify-setup/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyMfaCode, encryptMfaSecret, generateBackupCodes } from "@/lib/mfa";
import { validateOrError } from "@/lib/validation/schemas";
import { verifyCsrfToken } from "@/lib/csrf";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

const schema = z.object({
  secret: z.string().min(1),
  code: z.string().length(6, "الكود 6 أرقام"),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const rawBody = await req.json();
  const validation = validateOrError(schema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { secret, code } = validation.data;

  const isValid = await verifyMfaCode(secret, code);
  if (!isValid) {
    return NextResponse.json({ error: t(locale, "apiErr.codeInvalidClock") }, { status: 400 });
  }

  // 🔴 **أكواد الاسترجاع تُولَّد مع التفعيل لا بعده بخطوة.**
  //
  // لو تُركت لزرٍّ منفصلٍ يضغطه من يتذكّر، لبقي معظمُ من فعّل التحقّق بلا
  // شبكةِ أمان - وهم أوّلُ من سيُقفَل خارج حسابه عند فقد الهاتف. فتُولَّد
  // في اللحظة نفسها، وتُعرَض مرّةً واحدة.
  //
  // وتُمسَح القديمة أوّلاً: إعادةُ التفعيل تعني جهازاً جديداً، وأكواد
  // الجهاز السابق لا يصحّ أن تبقى صالحة.
  const { plain, hashes } = await generateBackupCodes();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: encryptMfaSecret(secret), mfaEnabled: true },
    }),
    prisma.mfaBackupCode.deleteMany({ where: { userId: user.id } }),
    prisma.mfaBackupCode.createMany({
      data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
    }),
  ]);

  // النصّ الصريح يُعاد هنا **وحدَ مرّة**: لا نملكه بعد هذه الاستجابة، إذ
  // لم يُخزَّن إلّا مجزّأً.
  return NextResponse.json({ success: true, backupCodes: plain });
}
