// lib/ecommerce/webhookAuth.ts
//
// **مَن يولّد سرّ الويب هوك: نحن أم المنصّة؟**
//
// 🔴 كانت الواجهة تجيب بجوابٍ واحد للخمس: تولّد سرّاً عشوائياً وتقول
// «الصقه في متجرك». وهو صحيحٌ **لووكومرس وحدها**. أمّا شوبيفاي وسلّة
// وإيزي أوردرز فتولّد أسرارها بنفسها، فالسرّ الذي نولّده لا يعرفه أحد
// ولا يُطابق شيئاً - يلصقه المشترك حيث لا مكان له، ثمّ يُرفض كلّ ويب هوك
// بـ`401` بلا سببٍ ظاهر. والاتجاه معكوس: من المنصّة إلينا لا العكس.
//
// وزد ليست في الطرفين: **لا توقيع لها إطلاقاً**، بل مصادقة أساسية
// (Basic) باسم مستخدم وكلمة مرور يضعهما المطوّر عند إنشاء الويب هوك.
//
// ═══ مصادر التحقّق (بحثٌ لا ذاكرة) ═══
//   شوبيفاي    - shopify.dev/docs/apps/build/webhooks/verify-deliveries
//                المفتاح هو client secret الذي تولّده شوبيفاي، ولا يمكن
//                تدويره لتطبيقٍ مخصَّص أصلاً.
//   سلّة       - docs.salla.dev/doc-421119 - **استراتيجيتان**: توقيع
//                (HMAC hex) أو توكن (في `Authorization`)، وترويسة
//                `X-Salla-Security-Strategy` تقول أيّهما. دعمُ واحدةٍ
//                فقط يعني رفضاً دائماً لنصف التجّار.
//   ووكومرس    - developer.woocommerce.com/docs/apis/rest-api/v3/webhooks
//                السرّ حقلٌ يملؤه صاحب المتجر عند إنشاء الويب هوك.
//   إيزي أوردرز - public-api-docs.easy-orders.net/docs/webhooks
//                «بعد إنشاء الويب هوك يُولَّد مفتاح سرّي» - هي تولّده.
//   زد         - docs.zid.sa/create-a-webhook - `username`/`password`
//                اختياريان عندها. **وعندنا إجباريان**: بدونهما يستطيع
//                كلّ من عرف الرابط أن يحقن مبيعاتٍ وهمية في حساب تاجر.
//
// هذا الملفّ **بيانات فقط، صفر استيراد** - تقرأه الواجهة (مكوّن متصفّح)
// ويقرأه المتحقّق في الخادم، فلا يفترق وصفُ الخطوات عمّا يُفحص فعلاً.

export type EcommercePlatformKey =
  | "SALLA"
  | "SHOPIFY"
  | "ZID"
  | "WOOCOMMERCE"
  | "EASY_ORDERS";

/**
 * `we_generate`  - نولّد نحن، والمشترك ينسخ منّا ويلصق في المنصّة.
 * `they_generate` - المنصّة تولّد، والمشترك ينسخ منها ويلصق عندنا.
 */
export type SecretDirection = "we_generate" | "they_generate";

export interface WebhookAuthSpec {
  direction: SecretDirection;
  /** المصادقة الأساسية تحتاج حقلين لا حقلاً واحداً */
  needsUsername: boolean;
  /** مفتاح الترجمة الذي يصف من أين يُنسخ السرّ - لا نصّ مثبَّت */
  hintKey: string;
}

export const WEBHOOK_AUTH: Record<EcommercePlatformKey, WebhookAuthSpec> = {
  WOOCOMMERCE: { direction: "we_generate", needsUsername: false, hintKey: "waWoo" },
  ZID: { direction: "we_generate", needsUsername: true, hintKey: "waZid" },
  SHOPIFY: { direction: "they_generate", needsUsername: false, hintKey: "waShopify" },
  SALLA: { direction: "they_generate", needsUsername: false, hintKey: "waSalla" },
  EASY_ORDERS: { direction: "they_generate", needsUsername: false, hintKey: "waEasyOrders" },
};

export function authSpecFor(platform: string): WebhookAuthSpec | null {
  return WEBHOOK_AUTH[platform as EcommercePlatformKey] ?? null;
}
