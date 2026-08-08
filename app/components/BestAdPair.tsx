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
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function BestAdPair({
  pick,
  currency,
  scopeLabel,
  locale,
}: {
  pick: TopCreativePick;
  currency: string;
  scopeLabel: string;
  locale: Locale;
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
  const first = rank === 1;
  const Icon = first ? Trophy : Medal;

  return (
    // إطار ذهبيّ خفيف للأوّل وحده: لونٌ لا يحمل معنًى دلالياً في هذا المنتج
    // (الأخضر «متحقَّق» والأحمر «حرج»)، فهو حرٌّ ليعني «الفائز» بلا لبس.
    // والتوهّج ظلٌّ واحدٌ خافت لا حلقة صارخة - الصفحة تُقرأ ساعاتٍ يومياً.
    <div
      className="card pad-md"
      style={
        first
          ? {
              borderColor: "rgba(212,175,55,.55)",
              boxShadow: "0 0 0 1px rgba(212,175,55,.22), 0 0 26px -10px rgba(212,175,55,.75)",
            }
          : undefined
      }
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={
            first
              ? { background: "rgba(212,175,55,.14)", color: "#D4AF37" }
              : undefined
          }
        >
          <Icon size={19} className={first ? "" : "text-text-muted"} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={first ? "text-[13px] font-bold tracking-wide" : "text-[13px] font-medium text-text-muted"}
              style={first ? { color: "#D4AF37" } : undefined}
            >
              {first ? tr("first") : tr("second")}
            </span>
            {/* شعار المنصّة إلى جانب الترتيب: البطاقة تُعرض الآن عبر
                المنصّات مجتمعةً كما تُعرض داخل منصّة واحدة، و«الأوّل» بلا
                منصّة لا يعني شيئاً حين يكون المتنافسان من منصّتين. */}
            <PlatformLogo platform={item.platform} size={13} />
          </div>
          {/* 🔴 كان يُطبع اسم الإعلان هنا **وعنوانه تحته**، وهما في أغلب
              الحسابات النصّ نفسه - فيُقرأ السطر مرّتين بلا فائدة. الاسم
              أعرض وزناً لأنّه ما يُبحث عنه في المنصّة، والعنوان لا يظهر
              إلّا إن كان مختلفاً فعلاً. */}
          <div
            className={`truncate ${first ? "text-[14.5px] font-semibold" : "text-[13.5px] font-medium"} text-text-primary`}
            title={item.adName ?? item.adId}
          >
            {item.adName ?? item.adId}
          </div>
        </div>
      </div>

      {item.headline && item.headline !== item.adName && (
        <p className="mb-3 line-clamp-2 text-[12px] leading-relaxed text-text-faint">{item.headline}</p>
      )}

      <div className="flex items-baseline gap-1.5">
        <span
          className={`${first ? "text-[32px] font-bold" : "text-[26px] font-semibold"} leading-none tracking-tight tabular-nums text-text-primary`}
        >
          {Math.round(item.cpa).toLocaleString("en-US")}
        </span>
        <span className="text-[13px] font-medium text-text-muted">{currency}</span>
      </div>
      <div className="mt-1 text-[12px] text-text-faint">
        {item.usingVerifiedData ? tr("cpaVerified") : tr("cpaReported")}
      </div>

      {/* 🔴 كانت شبكة تنهار عموداً واحداً على الهاتف، فتصير ثلاثة مؤشّرات
          ثلاثة أسطر وتطول البطاقة بلا سبب. صفٌّ واحد دائماً بأعمدة متساوية
          وفاصل رأسيّ بينها - أرقامٌ قصيرة تسع العرض في كلّ مقاس. */}
      <div className="mt-3 flex items-stretch border-t border-border pt-3 text-[12px]">
        <Stat label={tr("ctr")} value={`${item.ctr}%`} />
        <span className="mx-1 w-px shrink-0 self-stretch bg-border" aria-hidden />
        <Stat label={tr("roas")} value={item.roas !== null ? `${item.roas}x` : "—"} />
        <span className="mx-1 w-px shrink-0 self-stretch bg-border" aria-hidden />
        <Stat label={tr("spend")} value={Math.round(item.cost).toLocaleString("en-US")} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 px-1 text-center">
      <div className="truncate text-[11px] text-text-faint">{label}</div>
      <div className="mt-0.5 truncate font-semibold tabular-nums text-text-primary">{value}</div>
    </div>
  );
}
