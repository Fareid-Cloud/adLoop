// lib/turnstile.ts
//
// التحقق من الكابتشا (Cloudflare Turnstile - مجاني بالكامل، بديل حديث
// وأخف من reCAPTCHA، بدون صور أو ألغاز). التحقق بيحصل من السيرفر دايماً،
// مينفعش نثق في التوكن من غير ما نتأكد منه مع Cloudflare نفسها.

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.warn("TURNSTILE_SECRET_KEY غير مضبوط - تم تجاوز فحص الكابتشا");
    return true; // في بيئة التطوير من غير مفتاح، منوقفش الاختبار بالكامل
  }

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        remoteip: remoteIp,
      }),
    });

    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("فشل التحقق من الكابتشا:", err);
    return false; // فشل الاتصال = رفض آمن، مش سماح افتراضي
  }
}
