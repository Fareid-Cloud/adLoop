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
// **ويُشترط له تأكيدُ هويّة.** جلسةٌ مسروقة تستطيع فتح هذه الشاشة، وبلا
// الشرط ده يقدر صاحبُها يسجّل تطبيقَ مصادقةٍ خاصّاً به على الحساب - أي
// أنّه يرث الحماية نفسها بدل أن تصدّه. وهو نفس الشرط الذي يحرس التعطيل.
//
// 🔴 **وكان الشرطُ كلمةَ سرٍّ وحدها، فقفل الشاشةَ على مَن يدخل بجوجل.**
// التفصيلُ الكامل في `lib/mfaStepUp.ts` - والخلاصة أنّ الرمزَ الحاليّ من
// التطبيق المسجَّل يثبت ما تثبته كلمةُ السرّ وزيادة.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { verifyCsrfToken } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rateLimit";
import { decryptMfaSecret, generateMfaQrCode } from "@/lib/mfa";
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

  // الدليلُ يُجرَّب هنا، فالمسارُ بابُ تخمينٍ لو تُرك بلا حدّ.
  const limit = await checkRateLimit(`mfa-add:${user.id}`, "mfa-add-device", 5, 15);
  if (!limit.allowed) {
    return NextResponse.json({ error: t(locale, "apiErr.tooManyAttempts") }, { status: 429 });
  }

  if (!user.mfaEnabled || !user.mfaSecret) {
    return NextResponse.json({ error: t(locale, "apiErr.mfaNotEnabled") }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const proof = await verifyMfaStepUp(user, body ?? {});
  if (!proof.ok) {
    return NextResponse.json({ error: t(locale, `apiErr.${proof.key}`) }, { status: proof.status });
  }

  const secret = decryptMfaSecret(user.mfaSecret);
  const qrCodeDataUrl = await generateMfaQrCode(user.email, secret);

  // بلا أيّ كتابة: لا تأكيدَ ولا تغييرَ حالة. المسحُ في التطبيق الثاني
  // يكفي لأنّ السرّ هو هو - وطلبُ تأكيدٍ هنا كان سيوحي بأنّ شيئاً تغيّر.
  return NextResponse.json({ secret, qrCodeDataUrl });
}
