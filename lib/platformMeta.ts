// lib/platformMeta.ts
//
// اسم ولون كل منصة - مصدر حقيقة واحد يستخدمه جدول المصادر والرسم الدائري
// وأي عرض آخر. الألوان هي ألوان العلامات الرسمية (إشارة بصرية، مش لوجو).
export const PLATFORM_META: Record<string, { label: string; color: string }> = {
  GOOGLE_ADS: { label: "Google Ads", color: "#4285F4" },
  META_ADS: { label: "Meta Ads", color: "#0866FF" },
  TIKTOK_ADS: { label: "TikTok Ads", color: "#FE2C55" },
  SNAPCHAT_ADS: { label: "Snapchat Ads", color: "#E4B000" },
  SALLA: { label: "سلة", color: "#8B5CF6" },
  SHOPIFY: { label: "Shopify", color: "#5E8E3E" },
  EASY_ORDERS: { label: "Easy Orders", color: "#64748B" },
  MANUAL_UPLOAD: { label: "رفع يدوي", color: "#64748B" },
};

export function platformMeta(platform: string): { label: string; color: string } {
  return PLATFORM_META[platform] ?? { label: platform, color: "#64748B" };
}
