// lib/pricingCalculator.ts
//
// حاسبة التسعير الكاملة: تُرجع انهيار تكلفة مفصّلاً وسعراً مقترحاً وربحاً
// أو خسارة فعلية عند السعر الحالي.
//
// **بيانات ومنطق حسابي خالص - صفر استيراد.** يُستورد مباشرة في مكوّنات
// المتصفح ليعيد الحساب لحظياً عند تحريك شريط هامش الربح، وفي الخادم
// للتنبيهات - نسخة واحدة من المعادلة، فلا يختلف رقمان لنفس المنتج.
//
// ما أُضيف على المعادلة السابقة (كانت تغفلها فتُظهر ربحاً غير حقيقي):
//  • التغليف والمناولة - تكلفة فعلية لكل طلب
//  • عمولة الدفع عند الاستلام - شائعة جداً في السوق العربي
//  • خسارة إعادة التخزين - جزء من المرتجعات لا يعود قابلاً للبيع أصلاً
//  • سعر التعادل صراحةً - الرقم الذي تحته كل عملية بيع خسارة مؤكدة
//  • الربح/الخسارة الفعلي عند السعر الحالي، لا مجرد "السعر المقترح"

export interface FullPricingInputs {
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
}

export interface CostLine {
  key: string;
  labelAr: string;
  labelEn: string;
  amount: number;
  /** شرح سبب اختلاف الرقم عن المُدخل الخام (توزيع المرتجعات مثلاً) */
  noteAr?: string;
  noteEn?: string;
}

export interface FullPricingResult {
  /** انهيار التكلفة الحقيقية لكل طلب ناجح */
  lines: CostLine[];
  /** مجموع التكلفة الحقيقية قبل رسوم الدفع والهامش */
  trueCostPerOrder: number;
  /** السعر الذي يجعل الربح صفراً - تحته خسارة مؤكدة */
  breakEvenPrice: number;
  /** السعر المحقّق للهامش المطلوب */
  suggestedPrice: number;
  /** الربح (موجب) أو الخسارة (سالب) عند السعر الحالي */
  profitAtCurrentPrice: number;
  /** الهامش الفعلي المتحقق عند السعر الحالي */
  actualMarginPct: number;
  /** الفارق بين السعر الحالي والمقترح */
  priceGap: number;
  priceGapPct: number;
  status: "SAFE" | "WARNING" | "CRITICAL";
  /** أكبر بند تكلفة - أين تذهب أموالك فعلاً */
  largestCostKey: string;
  /** كم مرتجعاً إضافياً يحوّل هذا المنتج إلى خسارة */
  rtoBreakEvenPct: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculateFullPricing(
  currentPrice: number,
  input: FullPricingInputs
): FullPricingResult {
  const rtoRate = Math.min(Math.max(input.rtoRatePct, 0), 95) / 100;
  const successRate = Math.max(1 - rtoRate, 0.05);

  // كل التكاليف التي تُدفع على **كل** طلب (ناجح أو مرتجع) يجب توزيعها على
  // الطلبات الناجحة وحدها، لأنها هي التي تُنتج إيراداً.
  const adCost = r2(input.avgAdCostPerOrder / successRate);
  const outbound = r2(input.outboundShippingCost / successRate);
  const packaging = r2((input.packagingCost + input.handlingCost) / successRate);
  const returnShip = r2((rtoRate * input.returnShippingCost) / successRate);

  // جزء من المرتجعات لا يعود قابلاً للبيع (تلف، فتح العبوة) ⇒ خسارة تكلفة كاملة
  const restockLoss = r2(
    (rtoRate * (input.restockingLossPct / 100) * input.cogs) / successRate
  );

  const lines: CostLine[] = [
    { key: "cogs", labelAr: "تكلفة المنتج", labelEn: "Product cost", amount: r2(input.cogs) },
    {
      key: "ad", labelAr: "تكلفة الإعلان", labelEn: "Ad cost", amount: adCost,
      noteAr: rtoRate > 0 ? `موزّعة على الطلبات الناجحة فقط (${Math.round(rtoRate * 100)}% مرتجعات)` : undefined,
      noteEn: rtoRate > 0 ? `Spread over successful orders only (${Math.round(rtoRate * 100)}% returns)` : undefined,
    },
    { key: "shipping", labelAr: "الشحن للعميل", labelEn: "Outbound shipping", amount: outbound },
    {
      key: "return_shipping", labelAr: "شحن المرتجعات", labelEn: "Return shipping", amount: returnShip,
      noteAr: "تكلفة إعادة الشحن للطلبات المرتجعة، محمّلة على الناجحة",
      noteEn: "Return shipping cost, carried by successful orders",
    },
    { key: "restock", labelAr: "خسارة إعادة التخزين", labelEn: "Restocking loss", amount: restockLoss },
    { key: "packaging", labelAr: "التغليف والمناولة", labelEn: "Packaging & handling", amount: packaging },
  ].filter((l) => l.amount > 0);

  const trueCostPerOrder = r2(
    input.cogs + adCost + outbound + returnShip + restockLoss + packaging
  );

  // رسوم الدفع نسبة من السعر النهائي، فتُحل جبرياً لا تُضاف بعد الحساب
  const feeRate = (input.paymentGatewayFeePct + input.codFeePct) / 100;
  const marginRate = Math.min(Math.max(input.desiredMarginPct, 0), 90) / 100;

  const breakEvenPrice = r2(
    (trueCostPerOrder + input.paymentGatewayFixedFee) / Math.max(1 - feeRate, 0.05)
  );
  const suggestedPrice = r2(
    (trueCostPerOrder + input.paymentGatewayFixedFee) / Math.max(1 - feeRate - marginRate, 0.05)
  );

  // الربح الفعلي عند السعر الحالي
  const feesAtCurrent = r2(currentPrice * feeRate + input.paymentGatewayFixedFee);
  const profitAtCurrentPrice = r2(currentPrice - trueCostPerOrder - feesAtCurrent);
  const actualMarginPct = currentPrice > 0 ? r2((profitAtCurrentPrice / currentPrice) * 100) : 0;

  const priceGap = r2(suggestedPrice - currentPrice);
  const priceGapPct = currentPrice > 0 ? r2((priceGap / currentPrice) * 100) : 0;

  const status: FullPricingResult["status"] =
    profitAtCurrentPrice < 0 ? "CRITICAL"
    : currentPrice < suggestedPrice * 0.95 ? "WARNING"
    : "SAFE";

  const largestCostKey = lines.length > 0
    ? lines.reduce((a, b) => (b.amount > a.amount ? b : a)).key
    : "cogs";

  // حساسية المرتجعات: عند أي نسبة مرتجعات يصبح السعر الحالي خاسراً؟
  // معلومة قوية عملياً - تخبرك كم تحتمل قبل أن تنقلب الربحية.
  const rtoBreakEvenPct = findRtoBreakEven(currentPrice, input);

  return {
    lines, trueCostPerOrder, breakEvenPrice, suggestedPrice,
    profitAtCurrentPrice, actualMarginPct, priceGap, priceGapPct,
    status, largestCostKey, rtoBreakEvenPct,
  };
}

/** أعلى نسبة مرتجعات يبقى عندها السعر الحالي رابحاً (بحث ثنائي بسيط). */
function findRtoBreakEven(currentPrice: number, input: FullPricingInputs): number | null {
  const profitAt = (rtoPct: number) => {
    const rate = Math.min(Math.max(rtoPct, 0), 95) / 100;
    const success = Math.max(1 - rate, 0.05);
    const cost =
      input.cogs +
      input.avgAdCostPerOrder / success +
      input.outboundShippingCost / success +
      (rate * input.returnShippingCost) / success +
      (rate * (input.restockingLossPct / 100) * input.cogs) / success +
      (input.packagingCost + input.handlingCost) / success;
    const fees = currentPrice * ((input.paymentGatewayFeePct + input.codFeePct) / 100) + input.paymentGatewayFixedFee;
    return currentPrice - cost - fees;
  };

  if (profitAt(0) <= 0) return null; // خاسر حتى بصفر مرتجعات
  if (profitAt(95) > 0) return 95;   // رابح في كل الأحوال

  let lo = 0, hi = 95;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (profitAt(mid) > 0) lo = mid; else hi = mid;
  }
  return Math.round(lo * 10) / 10;
}
