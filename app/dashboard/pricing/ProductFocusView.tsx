"use client";

// العرض المركّز للمنتج: يُفتح فور إضافة منتج جديد، وعند الضغط على أي منتج
// قائم. يعرض انهيار التكلفة الحقيقية، والربح أو الخسارة عند السعر الحالي،
// والسعر المقترح — ويعيد الحساب لحظياً عند تحريك شريط هامش الربح.
//
// الحساب يستخدم نفس دالة الخادم (lib/pricingCalculator.ts) لا نسخة منها،
// فلا يمكن أن يختلف رقم الصفحة عن رقم التنبيه.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil, AlertTriangle, ArrowLeft, Info, Check } from "lucide-react";
import { calculateFullPricing, type FullPricingInputs } from "@/lib/pricingCalculator";

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

const money = (n: number, c: string) =>
  `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;

export function ProductFocusView({
  product, currency, onClose, onEdit,
}: {
  product: ProductRecord;
  currency: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [margin, setMargin] = useState(product.desiredMarginPct);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const maxLine = Math.max(...result.lines.map((l) => l.amount), 1);

  // كان الزر يغلق النافذة دون تأكيد نجاح أو فشل، فبدا كأنه لا يفعل شيئاً.
  // الآن يعرض خطأ صريحاً عند الفشل، وتأكيداً قبل الإغلاق عند النجاح.
  async function applyPrice() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPrice: result.suggestedPrice, desiredMarginPct: margin }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "تعذّر حفظ السعر الجديد.");
        setSaving(false);
        return;
      }
      setSaved(true);
      router.refresh();
      // مهلة قصيرة ليرى المستخدم تأكيد الحفظ قبل إغلاق النافذة
      setTimeout(() => onClose(), 900);
    } catch {
      setError("تعذّر الاتصال بالخادم.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="pop-shadow my-6 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface">
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

        <div className="p-5">
          {/* انهيار التكلفة */}
          <h3 className="mb-3 text-[13px] font-medium text-text-muted">أين تذهب أموالك في كل طلب ناجح</h3>
          <div className="mb-4 flex flex-col gap-2">
            {result.lines.map((line) => (
              <div key={line.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-text-primary">
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
                <div className="text-[12px] text-text-muted">{losing ? "الخسارة على كل طلب" : "الربح على كل طلب"}</div>
                <div className="mt-0.5 font-mono text-[30px] font-bold leading-none"
                     style={{ color: losing ? "var(--critical)" : "var(--verified)" }}>
                  {losing ? "−" : "+"}{money(Math.abs(result.profitAtCurrentPrice), currency)}
                </div>
                <div className="mt-1 text-[11.5px] text-text-muted">
                  الهامش الفعلي {result.actualMarginPct}% عند السعر الحالي
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

          {/* حساسية المرتجعات */}
          {result.rtoBreakEvenPct !== null && (
            <p className="mb-4 rounded-xl border border-border bg-surface-raised p-3 text-[12.5px] leading-relaxed text-text-muted">
              يبقى هذا المنتج رابحاً بالسعر الحالي حتى نسبة مرتجعات{" "}
              <span className="font-mono font-semibold text-text-primary">{result.rtoBreakEvenPct}%</span>
              {product.rtoRatePct > 0 && ` — نسبتك الحالية ${product.rtoRatePct}%`}.
            </p>
          )}

          {error && (
            <p className="mb-2 rounded-xl border border-critical/35 bg-critical/[0.07] p-3 text-[12.5px] text-critical">
              {error}
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
              <>تم تحديث السعر <Check size={15} /></>
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
