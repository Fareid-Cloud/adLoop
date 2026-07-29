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

export function BestAdPair({
  pick,
  currency,
  scopeLabel,
}: {
  pick: TopCreativePick;
  currency: string;
  scopeLabel: string;
}) {
  if (!pick.best) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-text-muted">
          <Trophy size={15} className="text-text-faint" />
          أفضل إعلان في {scopeLabel}
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
        <span className="text-[13px] font-medium text-text-muted">أفضل إعلان في {scopeLabel}</span>
        <span className="text-[11.5px] text-text-faint">
          {pick.eligibleCount} إعلان استوفى شروط الترشيح
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <AdCard rank={1} item={pick.best} currency={currency} />
        {pick.runnerUp ? (
          <AdCard rank={2} item={pick.runnerUp} currency={currency} />
        ) : (
          <div className="flex items-center rounded-2xl border border-dashed border-border bg-surface p-4 text-[12px] text-text-faint">
            لا يوجد إعلان ثانٍ مؤهَّل للمقارنة بعد.
          </div>
        )}
      </div>

      {pick.runnerUp && pick.leadPct !== null && (
        <p className="mt-2 text-[12px] leading-relaxed text-text-faint">
          {pick.isDecisiveLead ? (
            <>
              الأول أرخص من الثاني بـ<span className="font-semibold text-text-muted">{pick.leadPct}%</span> في
              تكلفة العميل — فارق ذو دلالة، يستحق أن يأخذ نصيباً أكبر من الميزانية.
            </>
          ) : (
            <>
              الفارق بين الأول والثاني {Math.abs(pick.leadPct)}% فقط — متعادلان عملياً. أبقِ الاثنين شغّالين
              بدل تركيز الميزانية في واحد بناءً على فارق قد يكون تذبذباً.
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
}: {
  rank: 1 | 2;
  item: CreativePerformance;
  currency: string;
}) {
  const Icon = rank === 1 ? Trophy : Medal;
  const tone = rank === 1 ? "text-verified" : "text-text-muted";
  const bg = rank === 1 ? "bg-verified/10" : "bg-surface-raised";

  return (
    <div className="card-shadow rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg} ${tone}`}>
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-text-muted">
            {rank === 1 ? "الأول" : "الثاني"}
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
        تكلفة العميل {item.usingVerifiedData ? "المتحقّق منها" : "(معلَنة من المنصة)"}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-[12px]">
        <Stat label="نسبة النقر" value={`${item.ctr}%`} />
        <Stat label="العائد" value={item.roas !== null ? `${item.roas}x` : "—"} />
        <Stat label="الإنفاق" value={Math.round(item.cost).toLocaleString("en-US")} />
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
