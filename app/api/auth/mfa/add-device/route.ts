// app/api/auth/mfa/add-device/route.ts - ربط تطبيق مصادقة إضافي
//
// **نفس السرّ، لا سرٌّ ثانٍ.** معيار TOTP يسمح بأن يحمل أكثر من تطبيق
// السرَّ نفسه، وكلٌّ منها يولّد الرمز ذاته - فالاحتياطيّ يعمل من غير أن
// نغيّر شيئاً في قاعدة البيانات ولا نضيف عموداً.
//
// 🔴 **وهذا هو المسار الذي كان ناقصاً، لا خيارٌ في الشاشة.** `setup`
// يولّد سرّاً **جديداً** في كلّ نداء - فمن أعاده وأكّده وهو مفعِّلٌ للتحقّق
// كان **يكسر تطبيقه الأوّل** بدل أن يضيف ثانياً، بلا تحذيرٍ يقول ذلك.
// عرضُ السرّ القائم هو الفرق بين إضافةٍ واستبدال.
//
// **ويُشترط له كلمة السرّ.** جلسةٌ مسروقة تستطيع فتح هذه الشاشة، وبلا
// الشرط ده يقدر صاحبُها يسجّل تطبيقَ مصادقةٍ خاصّاً به على الحساب - أي
// أنّه يرث الحماية نفسها بدل أن تصدّه. وهو نفس الشرط الذي يحرس التعطيل.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth";
import { verifyCsrfToken } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rateLimit";
import { decryptMfaSecret, generateMfaQrCode } from "@/lib/mfa";
import { deleteAccountSchema, validateOrError } from "@/lib/validation/schemas";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  // كلمةُ السرّ تُجرَّب هنا، فالمسارُ بابُ تخمينٍ لو تُرك بلا حدّ.
  const limit = await checkRateLimit(`mfa-add:${user.id}`, "mfa-add-device", 5, 15);
  if (!limit.allowed) {
    return NextResponse.json({ error: t(locale, "apiErr.tooManyAttempts") }, { status: 429 });
  }

  if (!user.mfaEnabled || !user.mfaSecret) {
    return NextResponse.json({ error: t(locale, "apiErr.mfaNotEnabled") }, { status: 400 });
  }

  if (!user.passwordHash) {
    return NextResponse.json({ error: t(locale, "apiErr.mfaNoPassword") }, { status: 400 });
  }

  const validation = validateOrError(deleteAccountSchema, await req.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const ok = await bcrypt.compare(validation.data.password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: t(locale, "apiErr.wrongPassword") }, { status: 401 });
  }

  const secret = decryptMfaSecret(user.mfaSecret);
  const qrCodeDataUrl = await generateMfaQrCode(user.email, secret);

  // بلا أيّ كتابة: لا تأكيدَ ولا تغييرَ حالة. المسحُ في التطبيق الثاني
  // يكفي لأنّ السرّ هو هو - وطلبُ تأكيدٍ هنا كان سيوحي بأنّ شيئاً تغيّر.
  return NextResponse.json({ secret, qrCodeDataUrl });
}
