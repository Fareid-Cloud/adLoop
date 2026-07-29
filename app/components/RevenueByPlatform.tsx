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
}: {
  rows: RevenuePlatformRow[];
  currency: string;
  /** نقطة التعادل الحقيقية من هامش الربح - إن وُجدت، تصبح الحكم لا المتوسط */
  breakEvenRoas: number | null;
}) {
  const withRevenue = rows.filter((r) => r.revenue > 0);

  if (withRevenue.length === 0) {
    return (
      <div className="card-shadow rounded-2xl border border-border bg-surface p-4">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-text-muted">
          <ShoppingBag size={15} />
          الإيراد لكل منصة
        </div>
        <p className="text-[12.5px] leading-relaxed text-text-faint">
          لا يوجد إيراد مسجَّل في هذه الفترة. الإيراد يصل من المتجر المربوط (سلة، شوبيفاي، زد،
          ووكومرس، إيزي أوردرز) — بدون ربط متجر نعرف الإنفاق ولا نعرف ما عاد منه.
        </p>
      </div>
    );
  }

  const sorted = [...withRevenue].sort((a, b) => b.revenue - a.revenue);
  const maxRevenue = Math.max(...sorted.map((r) => r.revenue));
  const totalRevenue = sorted.reduce((s, r) => s + r.revenue, 0);
  const totalCost = sorted.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="card-shadow rounded-2xl border border-border bg-surface p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium text-text-muted">
          <ShoppingBag size={15} />
          الإيراد لكل منصة
        </span>
        <span className="text-[12px] tabular-nums text-text-faint">
          الإجمالي {num(totalRevenue)} {currency}
        </span>
      </div>
      <p className="mb-3 text-[11.5px] text-text-faint">
        مرتَّبة بالإيراد، ملوَّنة بالعائد
        {breakEvenRoas !== null
          ? ` مقابل نقطة التعادل الحقيقية لحسابك (${breakEvenRoas}x)`
          : " — حدِّد هامش ربحك في الإعدادات ليصبح الحكم على أساس نقطة تعادل حقيقية لا مقارنة نسبية"}
        .
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

              {/* شريط الإيراد، وعلى أرضيته علامة الإنفاق - الفارق بينهما هو الربح */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                <div
                  className={`absolute inset-y-0 start-0 rounded-full ${
                    profitable === null ? "bg-accent" : profitable ? "bg-verified" : "bg-critical"
                  }`}
                  style={{ width: `${(row.revenue / maxRevenue) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 w-px bg-text-primary/50"
                  style={{ insetInlineStart: `${Math.min(100, (row.cost / maxRevenue) * 100)}%` }}
                  title={`الإنفاق ${num(row.cost)} ${currency}`}
                />
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11.5px] text-text-faint">
                <span className="tabular-nums">إنفاق {num(row.cost)}</span>
                <span className="tabular-nums">
                  عائد {roas !== null ? `${roas}x` : "—"}
                  {profitable === false && <span className="text-critical"> (تحت التعادل)</span>}
                </span>
                <span className="tabular-nums">
                  ربح {num(row.revenue - row.cost)} {currency}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {totalCost > 0 && (
        <div className="mt-3 border-t border-border pt-3 text-[12px] text-text-muted">
          إجمالي العائد{" "}
          <span className="font-semibold tabular-nums text-text-primary">
            {Math.round((totalRevenue / totalCost) * 100) / 100}x
          </span>{" "}
          — صافي{" "}
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
