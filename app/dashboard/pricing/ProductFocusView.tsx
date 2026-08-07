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
import { t, type Locale } from "@/lib/i18n/dictionary";

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
  product, currency, sales, onClose, onEdit, locale,
}: {
  product: ProductRecord;
  currency: string;
  sales?: SalesStats | null;
  onClose: () => void;
  onEdit: () => void;
  locale: Locale;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `focus.${k}`, v);
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
        setError(data.error ?? tr("errSave"));
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
      setError(tr("errNetwork"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="pop-shadow max-h-[92vh] w-full max-w-5xl overflow-hidden card">
        {/* الرأس */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold text-text-primary">{product.name}</h2>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              {product.sku ? `SKU: ${product.sku} · ` : ""}{tr("currentPrice", { price: money(product.currentPrice, currency) })}
              {product.stockQuantity !== null ? tr("stock", { n: product.stockQuantity }) : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button onClick={onEdit} className="btn btn-secondary btn-sm">
              <Pencil size={13} /> {tr("edit")}
            </button>
            <button onClick={onClose} className="rounded-lg p-2 text-text-muted hover:bg-surface-raised"><X size={17} /></button>
          </div>
        </div>

        {/* التحذير - يظهر بحركة تنبيه ثم يهدأ، ولا يختفي لأن الخسارة قائمة */}
        {losing && (
          <div className="note items-start rounded-none border-x-0 border-t-0 border-b-critical/30 bg-critical/[0.07] p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 animate-pulse-attention text-critical" />
            <div>
              <p className="text-[13.5px] font-bold text-critical">{tr("losingTitle")}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-muted">
                {tr("losingBody", {
                  loss: money(Math.abs(result.profitAtCurrentPrice), currency),
                  suggested: money(result.suggestedPrice, currency),
                  margin,
                })}
              </p>
            </div>
          </div>
        )}

        <div className="grid max-h-[calc(92vh-90px)] gap-5 overflow-y-auto p-5 lg:grid-cols-[1.7fr_1fr]">
        <div>
          {/* انهيار التكلفة */}
          <h3 className="mb-3 text-[13px] font-medium text-text-muted">{tr("breakdownTitle")}</h3>
          <div className="mb-4 flex flex-col gap-2">
            {result.lines.map((line) => (
              <div key={line.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 text-[13px] text-text-primary">
                    {(() => { const I = LINE_ICON[line.key] ?? Package; return <I size={14} className="shrink-0 text-text-muted" />; })()}
                    {line.labelAr}
                    {line.key === result.largestCostKey && (
                      <span className="ms-1.5 rounded-full bg-gap/12 px-1.5 py-0.5 text-[10px] font-medium text-gap">{tr("biggest")}</span>
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
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="card-inset pad-sm">
              <div className="text-[11.5px] text-text-muted">{tr("trueCost")}</div>
              <div className="mt-1 font-mono text-[18px] font-semibold text-text-primary">
                {money(result.trueCostPerOrder, currency)}
              </div>
            </div>
            <div className="card-inset pad-sm">
              <div className="flex items-center gap-1 text-[11.5px] text-text-muted">
                {tr("breakEvenPrice")} <Info size={11} />
              </div>
              <div className="mt-1 font-mono text-[18px] font-semibold text-text-primary">
                {money(result.breakEvenPrice, currency)}
              </div>
              <div className="mt-0.5 text-[10.5px] text-text-faint">{tr("breakEvenHint")}</div>
            </div>
          </div>

          {/* الحصيلة: خسارة حمراء عريضة أو ربح */}
          <div className="mb-4 rounded-2xl border p-3.5"
               style={{
                 borderColor: losing ? "color-mix(in srgb, var(--critical) 35%, transparent)" : "color-mix(in srgb, var(--verified) 35%, transparent)",
                 background: losing ? "color-mix(in srgb, var(--critical) 6%, var(--surface))" : "color-mix(in srgb, var(--verified) 6%, var(--surface))",
               }}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[12px] text-text-muted">
                  {tr("profitAtSuggested")}
                </div>
                {/* يتغيّر لحظياً مع تحريك المسطرة - المستخدم يرى ربحه قبل
                    أن يعتمد السعر، لا بعده */}
                <div className="mt-0.5 font-mono text-[22px] font-bold leading-tight text-verified">
                  +{money(profitAtSuggested, currency)}
                </div>
                <div className="mt-1 text-[11.5px] text-text-muted">
                  {tr("marginIs", { margin })}
                </div>
                <div className="mt-2 border-t border-border pt-2 text-[11.5px]"
                     style={{ color: losing ? "var(--critical)" : "var(--text-muted)" }}>
                  {tr("atCurrentPrice")}:{" "}
                  <span className="font-mono font-semibold">
                    {losing ? "−" : "+"}{money(Math.abs(result.profitAtCurrentPrice), currency)}
                  </span>{" "}
                  {tr("actualMargin", { pct: result.actualMarginPct })}
                </div>
              </div>
              <div className="text-end">
                <div className="text-[12px] text-text-muted">{tr("suggestedPrice")}</div>
                <div className="mt-0.5 font-mono text-[22px] font-bold leading-tight text-verified">
                  {money(result.suggestedPrice, currency)}
                </div>
                <div className="mt-1 text-[11.5px] text-text-muted">
                  {result.priceGap > 0 ? `+${money(result.priceGap, currency)} (${result.priceGapPct}%)` : tr("currentEnough")}
                </div>
              </div>
            </div>
          </div>

          {/* شريط هامش الربح */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[13px] text-text-primary">{tr("marginSlider")}</label>
              <span className="font-mono text-[15px] font-semibold text-accent">{margin}%</span>
            </div>
            <input
              type="range" min={0} max={70} step={1} value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <div className="mt-1 flex justify-between text-[10.5px] text-text-faint">
              <span>{tr("sliderMin")}</span><span>{tr("sliderMax")}</span>
            </div>
          </div>


        </div>

        {/* العمود الجانبي */}
        <aside className="flex flex-col gap-3">
          {/* نظرة سريعة - تظهر فقط عند وجود مبيعات فعلية مربوطة */}
          {sales && (
            <div className="card-inset pad-md">
              <div className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
                <TrendingUp size={14} className="text-accent" /> {tr("quickLook")}
              </div>
              <div className="flex flex-col gap-2.5">
                {[
                  { Icon: ShoppingBag, label: tr("successOrders"), value: tr("nOrders", { n: sales.orders.toLocaleString("en-US") }), tone: "var(--accent)" },
                  { Icon: Wallet, label: tr("aov"), value: money(sales.aov, currency), tone: "var(--gap)" },
                  { Icon: CheckCircle2, label: tr("successRate"), value: `${sales.successRate}%`, tone: "var(--verified)" },
                  { Icon: Clock, label: tr("window"), value: tr("last30"), tone: "var(--text-muted)" },
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
                <Sparkles size={14} className="text-verified" /> {tr("impactTitle")}
              </div>
              <p className="mb-3 text-[11.5px] text-text-muted">{tr("impactHint")}</p>
              <div className="flex flex-col gap-2">
                <ImpactRow
                  label={tr("extraPerOrder")}
                  value={`+${money(profitAtSuggested - result.profitAtCurrentPrice, currency)}`}
                />
                {sales && (
                  <ImpactRow
                    label={tr("extraMonthly")}
                    value={`+${money((profitAtSuggested - result.profitAtCurrentPrice) * sales.orders, currency)}`}
                  />
                )}
                <ImpactRow
                  label={tr("marginImprove")}
                  value={`+${Math.round((margin - result.actualMarginPct) * 10) / 10}%`}
                />
              </div>
            </div>
          )}

          {/* حساسية المرتجعات */}
          {result.rtoBreakEvenPct !== null && (
            <div className="card-inset pad-md">
              <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
                <RotateCcw size={14} className="text-text-muted" /> {tr("rtoTitle")}
              </div>
              <p className="text-[12px] leading-relaxed text-text-muted">
                {tr("rtoBody", { pct: result.rtoBreakEvenPct })}
                {product.rtoRatePct > 0 && tr("rtoYours", { pct: product.rtoRatePct })}.
              </p>
            </div>
          )}
          {/* اعتماد السعر - في العمود الجانبي كما طُلب، فلا يحتاج المستخدم
              التمرير إلى أسفل النافذة للوصول إلى الإجراء الأساسي */}
          <div className="mt-auto">
            {error && (
              <p className="note mb-2 border-critical/35 bg-critical/[0.07] p-2.5 text-critical">
                {error}
              </p>
            )}
            {saved && storeNotice && (
              <div className="mb-2 flex items-start gap-2 rounded-xl border border-gap/35 bg-gap/[0.07] p-2.5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-gap" />
                <p className="text-[11.5px] leading-relaxed text-text-primary">{storeNotice}</p>
              </div>
            )}
            {saved && !storeNotice && storeName && (
              <p className="mb-2 rounded-xl border border-verified/35 bg-verified/[0.07] p-2.5 text-[11.5px] text-verified">
                {tr("storeUpdated", { store: storeName })}
              </p>
            )}

            <button
              onClick={applyPrice}
              disabled={saving || saved || result.priceGap <= 0}
              className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-[13px] font-medium text-white disabled:opacity-45 ${
                saved ? "bg-verified" : "bg-accent"
              }`}
            >
              {saved ? (
                <>{storeNotice ? tr("savedLocalOnly") : tr("priceUpdated")} <Check size={14} /></>
              ) : saving ? (
                tr("saving")
              ) : result.priceGap <= 0 ? (
                tr("currentEnough")
              ) : (
                <>
                  {tr("approve", { price: money(result.suggestedPrice, currency) })}
                  <ArrowLeft size={14} className="rtl:rotate-0 ltr:rotate-180" />
                </>
              )}
            </button>
          </div>
        </aside>
        </div>


      </div>
    </div>
  );
}
