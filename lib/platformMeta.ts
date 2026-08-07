// lib/platformMeta.ts
//
// اسم ولون كل منصة - مصدر حقيقة واحد يستخدمه جدول المصادر والرسم الدائري
// وأي عرض آخر. الألوان هي ألوان العلامات الرسمية (إشارة بصرية، مش لوجو).
//
// **لماذا `labelAr` منفصل:** أسماء العلامات التجارية لا تُترجَم (Shopify
// تبقى Shopify)، لكن «سلة» و«رفع يدوي» كانا مثبَّتين بالعربية داخل هذا
// الجدول - فيقرأهما مستخدم الواجهة الإنجليزية بالعربية في وسم الرسم نفسه.
// الحقل اختياري: من لا يملكه اسمه واحد في اللغتين، وهذا هو الشائع.
//
// **لماذا لون جوجل ليس `#4285F4`:** جوجل شعارها أربعة ألوان ولا لون رسمي
// واحد لها، وأزرقها يكاد يطابق أزرق ميتا الرسمي `#0866FF` - فيصير قطاعا
// الرسم الدائري لونين لا يفرّق بينهما أحد. أخذنا أخضر جوجل الرسمي من
// الشعار نفسه: هويّة صحيحة، وتمييز فعليّ عن ميتا.
export const PLATFORM_META: Record<
  string,
  { label: string; labelAr?: string; color: string }
> = {
  GOOGLE_ADS: { label: "Google Ads", color: "#34A853" },
  META_ADS: { label: "Meta Ads", color: "#0866FF" },
  TIKTOK_ADS: { label: "TikTok Ads", color: "#FE2C55" },
  SNAPCHAT_ADS: { label: "Snapchat Ads", color: "#E4B000" },
  SALLA: { label: "Salla", labelAr: "سلة", color: "#8B5CF6" },
  SHOPIFY: { label: "Shopify", color: "#5E8E3E" },
  EASY_ORDERS: { label: "Easy Orders", color: "#64748B" },
  MANUAL_UPLOAD: { label: "Manual upload", labelAr: "رفع يدوي", color: "#64748B" },
};

export function platformMeta(
  platform: string,
  locale: "ar" | "en" = "ar",
): { label: string; color: string } {
  const m = PLATFORM_META[platform];
  if (!m) return { label: platform, color: "#64748B" };
  return { label: locale === "ar" ? (m.labelAr ?? m.label) : m.label, color: m.color };
}
