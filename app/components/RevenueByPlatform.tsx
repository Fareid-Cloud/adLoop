// app/components/RevenueByPlatform.tsx
//
// مقارنة الإيراد لكل منصة - مقابل إنفاقها، لا وحده.
//
// السبب: "أي منصة تجلب أكبر إيراد؟" سؤال مضلِّل بمفرده - المنصة الأكبر
// إنفاقاً تجلب عادةً أكبر إيراد وقد تكون أسوأها ربحيةً. لذلك يعرض كل صفّ
// الإيراد والإنفاق والعائد معاً، ويُرتَّب بالإيراد بينما يلوَّن بالعائد.
//
// حين لا يوجد إيراد مسجَّل يُقال ذلك صراحةً مع سببه (لا متجر مربوط)، بدل
// عرض أصفار توحي بأن المنصات لم تُنتج شيئاً.

import { PlatformLogo } from "@/app/components/PlatformLogo";
import { TrendingUp, TrendingDown, ShoppingBag } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export interface RevenuePlatformRow {
  platform: string;
  revenue: number;
  cost: number;
  verifiedConversions: number;
  /** تغيّر الإيراد عن الفترة السابقة */
  revenueChangePct: number | null;
}

const PLATFORM_NAMES: Record<string, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  TIKTOK_ADS: "TikTok Ads",
  SNAPCHAT_ADS: "Snapchat Ads",
};

const num = (n: number) => Math.round(n).toLocaleString("en-US");

export function RevenueByPlatform({
  rows,
  currency,
  breakEvenRoas,
  locale,
}: {
  rows: RevenuePlatformRow[];
  currency: string;
  /** نقطة التعادل الحقيقية من هامش الربح - إن وُجدت، تصبح الحكم لا المتوسط */
  breakEvenRoas: number | null;
  locale: Locale;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `revenue.${k}`, vars);
  const withRevenue = rows.filter((r) => r.revenue > 0);

  if (withRevenue.length === 0) {
    return (
      <div className="card pad-md">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-text-muted">
          <ShoppingBag size={15} />
          {tr("title")}
        </div>
        <p className="text-[12.5px] leading-relaxed text-text-faint">
          {tr("empty")}
        </p>
      </div>
    );
  }

  const sorted = [...withRevenue].sort((a, b) => b.revenue - a.revenue);
  const maxRevenue = Math.max(...sorted.map((r) => r.revenue));
  const totalRevenue = sorted.reduce((s, r) => s + r.revenue, 0);
  const totalCost = sorted.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="card pad-md">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium text-text-muted">
          <ShoppingBag size={15} />
          {tr("title")}
        </span>
        <span className="text-[12px] tabular-nums text-text-faint">
          {tr("total", { value: num(totalRevenue), currency })}
        </span>
      </div>
      <p className="mb-2 text-[11.5px] text-text-faint">
        {tr("sortedBy")}
        {breakEvenRoas !== null
          ? tr("vsBreakEven", { n: breakEvenRoas })
          : tr("setMargin")}
        .
      </p>

      {/* مفتاح العلامة الرأسية: بدونه تُقرأ كخدش في الشريط لا كمعلومة،
          وهي في الحقيقة أهمّ عنصر في الصفّ - ما بعدها هو الربح. */}
      <p className="mb-3 flex items-center gap-1.5 text-[11.5px] text-text-faint">
        <span className="inline-block h-3 w-[3px] shrink-0 rounded-full bg-text-primary" />
        {tr("legendSpendMark")}
      </p>

      {/* 🔴 **الفراغ يمين الشريط كان بلا تفسير.** وهو ليس عطلاً: الأشرطة
          مرسومةٌ نسبةً إلى أكبر منصّة، فما لم يمتلئ منها هو الفارق بينها
          وبين الأكبر - أي أنّه معلومةٌ لا نقص. لكنّ شيئاً لم يكن يقوله،
          فيقف المستخدم أمام مساحةٍ خالية يسأل عن سببها. */
      }
      <p className="mb-3 flex items-center gap-1.5 text-[11.5px] text-text-faint">
        <span className="inline-block h-1.5 w-4 shrink-0 rounded-full bg-surface-raised" />
        {tr("legendScale")}
      </p>

      <div className="flex flex-col gap-3">
        {sorted.map((row) => {
          const roas = row.cost > 0 ? Math.round((row.revenue / row.cost) * 100) / 100 : null;
          const profitable = breakEvenRoas !== null && roas !== null ? roas >= breakEvenRoas : null;

          return (
            <div key={row.platform}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-primary">
                  <PlatformLogo platform={row.platform} size={14} />
                  <span className="truncate">{PLATFORM_NAMES[row.platform] ?? row.platform}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[12px] tabular-nums">
                  {row.revenueChangePct !== null && (
                    <span
                      className={`inline-flex items-center gap-0.5 ${
                        row.revenueChangePct >= 0 ? "text-verified" : "text-critical"
                      }`}
                    >
                      {row.revenueChangePct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {Math.abs(row.revenueChangePct)}%
                    </span>
                  )}
                  <span className="font-semibold text-text-primary">{num(row.revenue)}</span>
                </span>
              </div>

              {/* شريط الإيراد، وعلى أرضيته علامة الإنفاق - **المسافة بين
                  العلامة ونهاية الشريط هي الربح**، وهي كل ما يقوله الصفّ.
                  كانت العلامة خطّاً رفيعاً بلا تسمية ولا تباين، فتُقرأ
                  كخدش أو خطأ رسم. صارت علامة واضحة يعلوها مفتاحها. */}
              <div className="relative h-3 w-full rounded-full bg-surface-raised">
                <div
                  className={`absolute inset-y-0 start-0 rounded-full ${
                    profitable === null ? "bg-accent" : profitable ? "bg-verified" : "bg-critical"
                  }`}
                  style={{ width: `${(row.revenue / maxRevenue) * 100}%` }}
                />
                <span
                  className="absolute -inset-y-1 flex w-[3px] items-center justify-center rounded-full bg-text-primary"
                  style={{ insetInlineStart: `${Math.min(100, (row.cost / maxRevenue) * 100)}%` }}
                  title={tr("spendTitle", { value: num(row.cost), currency })}
                />
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11.5px] text-text-faint">
                <span className="tabular-nums">{tr("spend", { value: num(row.cost) })}</span>
                <span className="tabular-nums">
                  {tr("roas", { value: roas !== null ? `${roas}x` : "—" })}
                  {profitable === false && <span className="text-critical">{tr("belowBreakEven")}</span>}
                </span>
                <span className="tabular-nums">
                  {tr("profit", { value: num(row.revenue - row.cost), currency })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {totalCost > 0 && (
        <div className="mt-3 border-t border-border pt-3 text-[12px] text-text-muted">
          {tr("totalRoas")}{" "}
          <span className="font-semibold tabular-nums text-text-primary">
            {Math.round((totalRevenue / totalCost) * 100) / 100}x
          </span>{" "}
          {tr("netProfitSep")}{" "}
          <span
            className={`font-semibold tabular-nums ${
              totalRevenue - totalCost >= 0 ? "text-verified" : "text-critical"
            }`}
          >
            {num(totalRevenue - totalCost)} {currency}
          </span>
        </div>
      )}
    </div>
  );
}
