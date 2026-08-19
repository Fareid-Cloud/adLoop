// lib/envCheck.ts
//
// فحص الإعداد وقت إقلاع الخادم - بيتنده من `instrumentation.ts` قبل أوّل
// طلب، عشان الإعداد الناقص يبان دلوقتي مش في وش أوّل مستخدم.
//
// 🔴 **الفحص كان بيغطّي خمسة متغيّرات من تسعةٍ وأربعين.** يعني كان بيقوم
// ويعدّي بينما مفاتيح Paymob كلّها ناقصة - وهو بالظبط اللي حصل: خمس
// محاولات دفع في ١ أغسطس ٢٠٢٦ فشلت بـ401، ومحدش عرف غير باستعلامٍ يدويّ
// على `PaymentIntent.failureReason` بعدها بأسابيع. القائمة الكاملة بقت
// في `lib/launchReadiness.ts`، مشتقّة من grep على الكود مش من الذاكرة.
//
// **التدرّج هنا مقصود، والرمي أضيق ما يكون:**
//   • `haltsBoot` → بيرمي. المنتج بلاها مايردّش على أي طلب أصلاً، وقيامُه
//     ناقصاً أسوأ من عدم قيامه (صفحات ٥٠٠ بدل نشرٍ فاشلٍ واضح).
//   • أي شيء تاني → تحذيرٌ مسجَّل بس. `RESEND_API_KEY` بيوقّف التسجيل
//     الجديد بالكامل - وده خطيرٌ فعلاً - لكنّ كلّ مشترك قائم بيفضل شغّال،
//     ووقف الخادم بسببه بيحوّل عطلاً جزئياً لانقطاعٍ تامّ صنعناه بإيدينا.
//
// اللوحة (صحّة النظام) بتعرض القائمة كاملةً بأثر كلّ بند - وهي المكان
// اللي بتتراجع فيه قبل النشر، مش سجلّ الإقلاع.

import { checkReadiness } from "@/lib/launchReadiness";

export function validateEnvOrThrow() {
  const { missing } = checkReadiness();
  if (missing.length === 0) return;

  const fatal = missing.filter((m) => m.item.haltsBoot);
  if (fatal.length > 0) {
    throw new Error(
      "متغيّرات بيئة أساسية ناقصة، والخادم مايقومش من غيرها:\n" +
        fatal.map((f) => `  • ${f.item.key} — ${f.item.breaks}`).join("\n")
    );
  }

  // مجمَّعة بالخطورة عشان السطر الأوّل في سجلّ النشر يقول الأهمّ، مش
  // أوّل ما اتصادف أبجدياً.
  for (const severity of ["BLOCKER", "REVENUE", "FEATURE"] as const) {
    const hits = missing.filter((m) => m.item.severity === severity);
    if (hits.length === 0) continue;
    console.warn(
      `[env] ${severity}: ${hits.length} إعداداً ناقصاً — ` +
        hits.map((h) => h.item.key).join(", ")
    );
  }
}
