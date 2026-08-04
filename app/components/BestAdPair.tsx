// app/components/BestAdPair.tsx
//
// أفضل إعلان وثاني أفضل إعلان - داخل منصة واحدة أو عبر المنصات كلها.
//
// حين لا يستوفي أي إعلان شروط الترشيح، تُعرض العبارة الصريحة بدل ترشيح
// إعلان ضعيف السند. تسمية إعلان "الأفضل" بناءً على تحويلين هو أسوأ ما
// تفعله أداة تحليل: يبني عليه المستخدم قراراً بميزانية حقيقية.

import { Trophy, Medal, Info } from "lucide-react";
import type { TopCreativePick } from "@/lib/creativeAnalysis";
import type { CreativePerformance } from "@/lib/creativeAnalysis";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function BestAdPair({
  pick,
  currency,
  scopeLabel,
  locale = "ar",
}: {
  pick: TopCreativePick;
  currency: string;
  scopeLabel: string;
  locale?: Locale;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `bestAd.${k}`, vars);
  if (!pick.best) {
    return (
      <div className="card pad-md">
        <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-text-muted">
          <Trophy size={15} className="text-text-faint" />
          {tr("title", { scope: scopeLabel })}
        </div>
        <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-text-faint">
          <Info size={13} className="mt-0.5 shrink-0" />
          {pick.insufficientReason}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-medium text-text-muted">{tr("title", { scope: scopeLabel })}</span>
        <span className="text-[11.5px] text-text-faint">
          {tr("eligible", { n: pick.eligibleCount })}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <AdCard rank={1} item={pick.best} currency={currency} locale={locale} />
        {pick.runnerUp ? (
          <AdCard rank={2} item={pick.runnerUp} currency={currency} locale={locale} />
        ) : (
          <div className="flex items-center rounded-2xl border border-dashed border-border bg-surface p-4 text-[12px] text-text-faint">
            {tr("noSecond")}
          </div>
        )}
      </div>

      {pick.runnerUp && pick.leadPct !== null && (
        <p className="mt-2 text-[12px] leading-relaxed text-text-faint">
          {pick.isDecisiveLead ? (
            <>
              {tr("leadClear", { pct: pick.leadPct })}
            </>
          ) : (
            <>
              {tr("leadTie", { pct: Math.abs(pick.leadPct) })}
            </>
          )}
        </p>
      )}
    </div>
  );
}

function AdCard({
  rank,
  item,
  currency,
  locale,
}: {
  rank: 1 | 2;
  item: CreativePerformance;
  currency: string;
  locale: Locale;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `bestAd.${k}`, vars);
  const Icon = rank === 1 ? Trophy : Medal;
  const tone = rank === 1 ? "text-verified" : "text-text-muted";
  const bg = rank === 1 ? "bg-verified/10" : "bg-surface-raised";

  return (
    <div className="card pad-md">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg} ${tone}`}>
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-text-muted">
            {rank === 1 ? tr("first") : tr("second")}
          </div>
          <div className="truncate text-[13px] text-text-primary" title={item.adName ?? item.adId}>
            {item.adName ?? item.adId}
          </div>
        </div>
      </div>

      {item.headline && (
        <p className="mb-3 line-clamp-2 text-[12px] leading-relaxed text-text-faint">{item.headline}</p>
      )}

      <div className="flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-text-primary">
          {Math.round(item.cpa).toLocaleString("en-US")}
        </span>
        <span className="text-[13px] font-medium text-text-muted">{currency}</span>
      </div>
      <div className="mt-1 text-[12px] text-text-faint">
        {item.usingVerifiedData ? tr("cpaVerified") : tr("cpaReported")}
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 border-t border-border pt-3 text-[12px]">
        <Stat label={tr("ctr")} value={`${item.ctr}%`} />
        <Stat label={tr("roas")} value={item.roas !== null ? `${item.roas}x` : "—"} />
        <Stat label={tr("spend")} value={Math.round(item.cost).toLocaleString("en-US")} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-faint">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums text-text-primary">{value}</div>
    </div>
  );
}
