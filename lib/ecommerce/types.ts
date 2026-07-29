// lib/ecommerce/types.ts
//
// شكل الطلب الموحّد. كل منصة إيكومرس لها صيغة ويب هوك مختلفة، فنحوّلها
// جميعاً إلى هذا الشكل مرة واحدة، ثم يعمل باقي المنتج على شكل واحد فقط.
// البديل (نسخة منطق لكل منصة) يعني خمس نسخ تتباعد مع الوقت.

export type EcommercePlatform = "SALLA" | "SHOPIFY" | "ZID" | "WOOCOMMERCE" | "EASY_ORDERS";

export interface NormalizedOrderItem {
  sku: string | null;
  name: string | null;
  quantity: number;
  /** إجمالي سطر الطلب (السعر × الكمية) بعملة المتجر */
  lineTotal: number;
  /** تكلفة البضاعة إن أرسلتها المنصة - قليل من المنصات ترسلها */
  unitCost?: number | null;
}

/** بيانات العميل كما ترسلها المنصة. تُهشَّم قبل التخزين - لا يُحفظ بريد
 *  ولا هاتف صريح في أي مكان. تحليل العملاء يحتاج سلوكهم لا هويتهم. */
export interface NormalizedCustomer {
  externalId?: string | null;
  email?: string | null;
  phone?: string | null;
  /** الاسم الأول فقط يُحتفَظ به للعرض */
  firstName?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface NormalizedOrder {
  platform: EcommercePlatform;
  /** معرّف الطلب لدى المنصة - أساس منع التكرار */
  externalOrderId: string;
  createdAt: Date;
  /** إجمالي الطلب بعملة المتجر */
  total: number;
  currency?: string | null;
  /** تكلفة الشحن إن توفّرت */
  shippingCost?: number | null;
  /** حالة الطلب كما ترسلها المنصة - تُستخدم لرصد المرتجعات */
  status?: string | null;
  isReturned: boolean;
  items: NormalizedOrderItem[];
  customer?: NormalizedCustomer | null;
  /** طريقة الدفع كما ترسلها المنصة - أساس رصد الدفع عند الاستلام */
  paymentMethod?: string | null;
  fulfilledAt?: Date | null;
}

/** الحالات التي تعني إلغاءً صريحاً (لا إرجاعاً بعد الاستلام). التفريق مهم:
 *  الإلغاء يعني أن الطلب لم يُشحن أصلاً، والإرجاع يعني تكلفة شحن مدفوعة
 *  مرتين - أثرهما المالي مختلف تماماً. */
const CANCELLED_STATUSES = ["cancel", "canceled", "cancelled", "void", "ملغي", "ملغى", "إلغاء"];

export function isCancelledStatus(status: unknown): boolean {
  if (typeof status !== "string") return false;
  const s = status.toLowerCase().trim();
  return CANCELLED_STATUSES.some((r) => s.includes(r));
}

const COD_HINTS = ["cod", "cash", "cash_on_delivery", "cashondelivery", "الدفع عند الاستلام", "نقدا", "نقداً"];

export function isCashOnDelivery(method: unknown): boolean {
  if (typeof method !== "string") return false;
  const s = method.toLowerCase().trim();
  return COD_HINTS.some((h) => s.includes(h));
}

/** تحديث مخزون قادم من المنصة (حدث منفصل عن الطلبات). */
export interface NormalizedStockUpdate {
  platform: EcommercePlatform;
  sku: string | null;
  externalProductId: string | null;
  quantity: number;
}

export const PLATFORM_LABEL: Record<EcommercePlatform, { ar: string; en: string }> = {
  SALLA: { ar: "سلة", en: "Salla" },
  SHOPIFY: { ar: "شوبيفاي", en: "Shopify" },
  ZID: { ar: "زد", en: "Zid" },
  WOOCOMMERCE: { ar: "ووكومرس", en: "WooCommerce" },
  EASY_ORDERS: { ar: "إيزي أوردرز", en: "EasyOrders" },
};

/** الحالات التي تعني أن الطلب لم يكتمل - أساس احتساب المرتجعات. */
const RETURNED_STATUSES = [
  "returned", "refunded", "canceled", "cancelled", "restored",
  "مرتجع", "ملغي", "مسترجع", "ملغى",
];

export function isReturnedStatus(status: unknown): boolean {
  if (typeof status !== "string") return false;
  const s = status.toLowerCase().trim();
  return RETURNED_STATUSES.some((r) => s.includes(r));
}

export function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
