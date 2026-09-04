// app/api/auth/mfa/disable/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { verifyCsrfToken } from "@/lib/csrf";
import { verifyMfaStepUp } from "@/lib/mfaStepUp";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  // 🔴 **حدُّ معدّلٍ كان غائباً هنا وحده.** المسارُ يجرّب دليلاً - رمزاً من
  // ستّة أرقام أو كودَ استرجاع - وبلا حدٍّ يصير تخمينُه ممكناً بالتكرار،
  // ونتيجةُ نجاحه **إطفاءُ التحقّق بخطوتين كلِّه**. نفسُ حدّ «أضِف تطبيقاً».
  const limit = await checkRateLimit(`mfa-disable:${user.id}`, "mfa-disable", 5, 15);
  if (!limit.allowed) {
    return NextResponse.json({ error: t(locale, "apiErr.tooManyAttempts") }, { status: 429 });
  }

  // **التأكيدُ بأيّ عاملٍ يملكه، لا بكلمة السرّ وحدها.** كان حسابُ جوجل
  // يُرفض هنا رفضاً نهائياً ويُحال إلى الدعم - أي أنّ إطفاءَ الحماية صار
  // مكالمةً يحكم فيها موظّفٌ بانطباعه. التفصيل في `lib/mfaStepUp.ts`.
  const body = await req.json().catch(() => null);
  const proof = await verifyMfaStepUp(user, body ?? {});
  if (!proof.ok) {
    return NextResponse.json({ error: t(locale, `apiErr.${proof.key}`) }, { status: proof.status });
  }

  // 🔴 يُمسَح معه كلُّ أثر: أكوادُ استرجاعٍ وأجهزةٌ موثوقة.
  //
  // الأكواد بلا تحقّقٍ لا تسترجع شيئاً، وبقاؤها يعني أنّ إعادة التفعيل
  // لاحقاً ترث أوراقاً قديمة قد تكون تسرّبت. والأجهزة الموثوقة أخطر: لو
  // بقيت، فإعادةُ التفعيل تجد أجهزةً تتخطّى التحقّق من أوّل لحظة - أي
  // حمايةٌ مفعَّلةٌ ومُتخطّاةٌ في آن.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecret: null },
    }),
    prisma.mfaBackupCode.deleteMany({ where: { userId: user.id } }),
    prisma.trustedDevice.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ success: true });
}
