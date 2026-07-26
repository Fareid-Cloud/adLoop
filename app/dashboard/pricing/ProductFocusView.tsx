"use client";

// العرض المركّز للمنتج: يُفتح فور إضافة منتج جديد، وعند الضغط على أي منتج
// قائم. يعرض انهيار التكلفة الحقيقية، والربح أو الخسارة عند السعر الحالي،
// والسعر المقترح — ويعيد الحساب لحظياً عند تحريك شريط هامش الربح.
//
// الحساب يستخدم نفس دالة الخادم (lib/pricingCalculator.ts) لا نسخة منها،
// فلا يمكن أن يختلف رقم الصفحة عن رقم التنبيه.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, Pencil, AlertTriangle, ArrowLeft, Check, TrendingUp,
  Package, Megaphone, Truck, RotateCcw, CreditCard, Boxes,
  ShoppingBag, Wallet, CheckCircle2, Clock, Sparkles, Info,
} from "lucide-react";
import { calculateFullPricing, type FullPricingInputs } from "@/lib/pricingCalculator";

/** إحصاءات مبيعات حقيقية - تُعرض فقط عند وجودها فعلاً */
export interface SalesStats {
  orders: number;
  revenue: number;
  aov: number;
  successRate: number;
}

// أيقونة لكل بند تكلفة - تعريف بصري فوري بدل قائمة نصية متشابهة
const LINE_ICON: Record<string, any> = {
  cogs: Package,
  ad: Megaphone,
  shipping: Truck,
  return_shipping: RotateCcw,
  restock: Boxes,
  packaging: CreditCard,
};

export interface ProductRecord {
  id: string;
  name: string;
  sku: string | null;
  currentPrice: number;
  cogs: number;
  outboundShippingCost: number;
  returnShippingCost: number;
  packagingCost: number;
  handlingCost: number;
  avgAdCostPerOrder: number;
  rtoRatePct: number;
  restockingLossPct: number;
  paymentGatewayFeePct: number;
  paymentGatewayFixedFee: number;
  codFeePct: number;
  desiredMarginPct: number;
  stockQuantity: number | null;
}

function ImpactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-2">
      <span className="text-[11.5px] text-text-muted">{label}</span>
      <span className="font-mono text-[12.5px] font-semibold text-verified">{value}</span>
    </div>
  );
}

const money = (n: number, c: string) =>
  `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;

export function ProductFocusView({
  product, currency, sales, onClose, onEdit,
}: {
  product: ProductRecord;
  currency: string;
  sales?: SalesStats | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [margin, setMargin] = useState(product.desiredMarginPct);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeNotice, setStoreNotice] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);

  const inputs: FullPricingInputs = useMemo(() => ({
    cogs: product.cogs,
    outboundShippingCost: product.outboundShippingCost,
    returnShippingCost: product.returnShippingCost || product.outboundShippingCost,
    packagingCost: product.packagingCost,
    handlingCost: product.handlingCost,
    avgAdCostPerOrder: product.avgAdCostPerOrder,
    rtoRatePct: product.rtoRatePct,
    restockingLossPct: product.restockingLossPct,
    paymentGatewayFeePct: product.paymentGatewayFeePct,
    paymentGatewayFixedFee: product.paymentGatewayFixedFee,
    codFeePct: product.codFeePct,
    desiredMarginPct: margin,
  }), [product, margin]);

  const result = useMemo(
    () => calculateFullPricing(product.currentPrice, inputs),
    [product.currentPrice, inputs]
  );

  const losing = result.profitAtCurrentPrice < 0;
  // الربح عند السعر المقترح بالهامش الحالي - يُعاد حسابه مع كل تحريك للمسطرة
  const profitAtSuggested = useMemo(() => {
    const feeRate = (product.paymentGatewayFeePct + product.codFeePct) / 100;
    const fees = result.suggestedPrice * feeRate + product.paymentGatewayFixedFee;
    return Math.round((result.suggestedPrice - result.trueCostPerOrder - fees) * 100) / 100;
  }, [result, product]);
  const maxLine = Math.max(...result.lines.map((l) => l.amount), 1);

  // كان الزر يغلق النافذة دون تأكيد نجاح أو فشل، فبدا كأنه لا يفعل شيئاً.
  // الآن يعرض خطأ صريحاً عند الفشل، وتأكيداً قبل الإغلاق عند النجاح.
  async function applyPrice() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${product.id}/apply-price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: result.suggestedPrice, desiredMarginPct: margin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "تعذّر حفظ السعر الجديد.");
        setSaving(false);
        return;
      }
      setSaved(true);
      // نُفرّق صراحةً: هل تغيّر السعر في متجرك فعلاً أم عندنا فقط؟
      setStoreNotice(data.storeUpdated ? null : data.storeNotice ?? null);
      setStoreName(data.storePlatform ?? null);
      router.refresh();
      // نُبقي النافذة مفتوحة عند وجود ملاحظة عن المتجر ليقرأها المستخدم
      if (data.storeUpdated) setTimeout(() => onClose(), 1100);
    } catch {
      setError("تعذّر الاتصال بالخادم.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="pop-shadow my-6 w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-surface">
        {/* الرأس */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold text-text-primary">{product.name}</h2>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              {product.sku ? `SKU: ${product.sku} · ` : ""}السعر الحالي {money(product.currentPrice, currency)}
              {product.stockQuantity !== null ? ` · المخزون ${product.stockQuantity}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button onClick={onEdit} className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-text-primary">
              <Pencil size={13} /> تعديل
            </button>
            <button onClick={onClose} className="rounded-lg p-2 text-text-muted hover:bg-surface-raised"><X size={17} /></button>
          </div>
        </div>

        {/* التحذير - يظهر بحركة تنبيه ثم يهدأ، ولا يختفي لأن الخسارة قائمة */}
        {losing && (
          <div className="flex items-start gap-2.5 border-b border-critical/30 bg-critical/[0.07] p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 animate-pulse-attention text-critical" />
            <div>
              <p className="text-[13.5px] font-bold text-critical">هذا المنتج يُباع بخسارة</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-muted">
                كل عملية بيع بالسعر الحالي تُكلّفك {money(Math.abs(result.profitAtCurrentPrice), currency)}.
                رفع السعر إلى {money(result.suggestedPrice, currency)} يعيد الربحية عند هامش {margin}%.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-5 p-5 lg:grid-cols-[1.7fr_1fr]">
        <div>
          {/* انهيار التكلفة */}
          <h3 className="mb-3 text-[13px] font-medium text-text-muted">أين تذهب أموالك في كل طلب ناجح</h3>
          <div className="mb-4 flex flex-col gap-2">
            {result.lines.map((line) => (
              <div key={line.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 text-[13px] text-text-primary">
                    {(() => { const I = LINE_ICON[line.key] ?? Package; return <I size={14} className="shrink-0 text-text-muted" />; })()}
                    {line.labelAr}
                    {line.key === result.largestCostKey && (
                      <span className="ms-1.5 rounded-full bg-gap/12 px-1.5 py-0.5 text-[10px] font-medium text-gap">الأكبر</span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-[13px] text-text-primary">{money(line.amount, currency)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                  <div className="h-full rounded-full bg-accent/55" style={{ width: `${(line.amount / maxLine) * 100}%` }} />
                </div>
                {line.noteAr && <p className="mt-1 text-[11px] text-text-faint">{line.noteAr}</p>}
              </div>
            ))}
          </div>

          {/* التكلفة الحقيقية وسعر التعادل */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-surface-raised p-3">
              <div className="text-[11.5px] text-text-muted">التكلفة الحقيقية للطلب</div>
              <div className="mt-1 font-mono text-[18px] font-semibold text-text-primary">
                {money(result.trueCostPerOrder, currency)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface-raised p-3">
              <div className="flex items-center gap-1 text-[11.5px] text-text-muted">
                سعر التعادل <Info size={11} />
              </div>
              <div className="mt-1 font-mono text-[18px] font-semibold text-text-primary">
                {money(result.breakEvenPrice, currency)}
              </div>
              <div className="mt-0.5 text-[10.5px] text-text-faint">تحته خسارة مؤكدة</div>
            </div>
          </div>

          {/* الحصيلة: خسارة حمراء عريضة أو ربح */}
          <div className="mb-5 rounded-2xl border p-4"
               style={{
                 borderColor: losing ? "color-mix(in srgb, var(--critical) 35%, transparent)" : "color-mix(in srgb, var(--verified) 35%, transparent)",
                 background: losing ? "color-mix(in srgb, var(--critical) 6%, var(--surface))" : "color-mix(in srgb, var(--verified) 6%, var(--surface))",
               }}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[12px] text-text-muted">
                  الربح لكل طلب عند السعر المقترح
                </div>
                {/* يتغيّر لحظياً مع تحريك المسطرة - المستخدم يرى ربحه قبل
                    أن يعتمد السعر، لا بعده */}
                <div className="mt-0.5 font-mono text-[30px] font-bold leading-none text-verified">
                  +{money(profitAtSuggested, currency)}
                </div>
                <div className="mt-1 text-[11.5px] text-text-muted">
                  هامش الربح {margin}%
                </div>
                <div className="mt-2 border-t border-border pt-2 text-[11.5px]"
                     style={{ color: losing ? "var(--critical)" : "var(--text-muted)" }}>
                  {losing ? "بالسعر الحالي" : "بالسعر الحالي"}:{" "}
                  <span className="font-mono font-semibold">
                    {losing ? "−" : "+"}{money(Math.abs(result.profitAtCurrentPrice), currency)}
                  </span>{" "}
                  (هامش {result.actualMarginPct}%)
                </div>
              </div>
              <div className="text-end">
                <div className="text-[12px] text-text-muted">السعر المقترح</div>
                <div className="mt-0.5 font-mono text-[30px] font-bold leading-none text-verified">
                  {money(result.suggestedPrice, currency)}
                </div>
                <div className="mt-1 text-[11.5px] text-text-muted">
                  {result.priceGap > 0 ? `+${money(result.priceGap, currency)} (${result.priceGapPct}%)` : "السعر الحالي كافٍ"}
                </div>
              </div>
            </div>
          </div>

          {/* شريط هامش الربح */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[13px] text-text-primary">هامش الربح المستهدف</label>
              <span className="font-mono text-[15px] font-semibold text-accent">{margin}%</span>
            </div>
            <input
              type="range" min={0} max={70} step={1} value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <div className="mt-1 flex justify-between text-[10.5px] text-text-faint">
              <span>0% (تعادل)</span><span>70%</span>
            </div>
          </div>


        </div>

        {/* العمود الجانبي */}
        <aside className="flex flex-col gap-3">
          {/* نظرة سريعة - تظهر فقط عند وجود مبيعات فعلية مربوطة */}
          {sales && (
            <div className="rounded-2xl border border-border bg-surface-raised p-4">
              <div className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
                <TrendingUp size={14} className="text-accent" /> نظرة سريعة
              </div>
              <div className="flex flex-col gap-2.5">
                {[
                  { Icon: ShoppingBag, label: "الطلبات الناجحة", value: `${sales.orders.toLocaleString("en-US")} طلب`, tone: "var(--accent)" },
                  { Icon: Wallet, label: "متوسط قيمة الطلب", value: money(sales.aov, currency), tone: "var(--gap)" },
                  { Icon: CheckCircle2, label: "معدل النجاح", value: `${sales.successRate}%`, tone: "var(--verified)" },
                  { Icon: Clock, label: "نافذة القياس", value: "آخر 30 يوماً", tone: "var(--text-muted)" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `color-mix(in srgb, ${row.tone} 13%, transparent)` }}>
                      <row.Icon size={13} style={{ color: row.tone }} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] text-text-muted">{row.label}</div>
                      <div className="font-mono text-[13px] font-medium text-text-primary">{row.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تأثير السعر المقترح */}
          {result.priceGap > 0 && (
            <div className="rounded-2xl border border-verified/30 bg-verified/[0.05] p-4">
              <div className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
                <Sparkles size={14} className="text-verified" /> تأثير السعر المقترح
              </div>
              <p className="mb-3 text-[11.5px] text-text-muted">إذا اعتمدت السعر المقترح الآن</p>
              <div className="flex flex-col gap-2">
                <ImpactRow
                  label="الربح الإضافي لكل طلب"
                  value={`+${money(profitAtSuggested - result.profitAtCurrentPrice, currency)}`}
                />
                {sales && (
                  <ImpactRow
                    label="الربح الإضافي شهرياً"
                    value={`+${money((profitAtSuggested - result.profitAtCurrentPrice) * sales.orders, currency)}`}
                  />
                )}
                <ImpactRow
                  label="تحسّن هامش الربح"
                  value={`+${Math.round((margin - result.actualMarginPct) * 10) / 10}%`}
                />
              </div>
            </div>
          )}

          {/* حساسية المرتجعات */}
          {result.rtoBreakEvenPct !== null && (
            <div className="rounded-2xl border border-border bg-surface-raised p-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
                <RotateCcw size={14} className="text-text-muted" /> حساسية المرتجعات
              </div>
              <p className="text-[12px] leading-relaxed text-text-muted">
                يبقى هذا المنتج رابحاً بالسعر الحالي حتى نسبة مرتجعات{" "}
                <span className="font-mono font-semibold text-text-primary">{result.rtoBreakEvenPct}%</span>
                {product.rtoRatePct > 0 && ` — نسبتك الحالية ${product.rtoRatePct}%`}.
              </p>
            </div>
          )}
        </aside>
        </div>

        <div className="border-t border-border p-5 pt-4">
          {error && (
            <p className="mb-2 rounded-xl border border-critical/35 bg-critical/[0.07] p-3 text-[12.5px] text-critical">
              {error}
            </p>
          )}

          {/* حُفظ عندنا لكن لم يتغيّر في المتجر - فرق جوهري يجب ذكره */}
          {saved && storeNotice && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-gap/35 bg-gap/[0.07] p-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-gap" />
              <p className="text-[12.5px] leading-relaxed text-text-primary">{storeNotice}</p>
            </div>
          )}
          {saved && !storeNotice && storeName && (
            <p className="mb-2 rounded-xl border border-verified/35 bg-verified/[0.07] p-3 text-[12.5px] text-verified">
              تم تحديث السعر في {storeName} وفي AdLoop معاً.
            </p>
          )}

          <button
            onClick={applyPrice}
            disabled={saving || saved || result.priceGap <= 0}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13.5px] font-medium text-white disabled:opacity-45 ${
              saved ? "bg-verified" : "bg-accent"
            }`}
          >
            {saved ? (
              <>{storeNotice ? "حُفظ عندنا فقط" : "تم تحديث السعر"} <Check size={15} /></>
            ) : saving ? (
              "جارٍ الحفظ..."
            ) : result.priceGap <= 0 ? (
              "السعر الحالي يحقّق هامشك المستهدف"
            ) : (
              <>
                اعتماد السعر المقترح {money(result.suggestedPrice, currency)}
                <ArrowLeft size={15} className="rtl:rotate-0 ltr:rotate-180" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
