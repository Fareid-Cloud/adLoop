// lib/logoManifest.ts
//
// ⚠️ **مولَّد آلياً — لا يُحرَّر بيد.** يعيد `scripts/generateLogoManifest.mjs`
// كتابته في كلّ بناء من محتويات `public/logos`. أسقِط ملفّاً هناك وابنِ،
// فيظهر. احذفه وابنِ، فيعود إلى الرسم المضمَّن.

/** مفتاح العلامة ← امتداد ملفّها الرسميّ الموجود فعلاً */
export const LOGO_FILES: Record<string, "svg" | "png"> = {
  ARAMEX: "svg",
  BOSTA: "png",
  CLARITY: "png",
  EASY_ORDERS: "png",
  MESSENGER: "svg",
  MYLERZ: "png",
  SALLA: "svg",
  SHOPIFY: "svg",
  SMSA: "svg",
  WHATSAPP: "svg",
  WOOCOMMERCE: "png",
  ZID: "svg",
};
