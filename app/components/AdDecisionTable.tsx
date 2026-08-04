// app/components/AdDecisionTable.tsx
//
// جدول الإعلانات بعمود القرار. مكوّن خادم يعرض خلايا عميل للأزرار فقط -
// فلا تُشحن بيانات التحليل كلها إلى المتصفح، ويبقى التفاعل حيث يلزم وحده.
//
// يُستخدم في الصفحة الشاملة وفي صفحة كل منصة على حدة بنفس الشكل - نقطة
// حقيقة واحدة بدل ثلاث نسخ تتباعد مع الوقت.

import { AdDecisionCell } from "@/app/components/AdDecisionCell";
import type { AdDecisionView } from "@/lib/adDecisions";
import { TrendingUp, PauseCircle, MinusCircle } from "lucide-react";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";
import { TABLE_WRAP, TH } from "@/app/components/ui/tableStyles";


export function AdDecisionTable({
  decisions,
  workspaceId,
  currency,
  showPlatform = true,
  locale = "ar",
}: {
  decisions: AdDecisionView[];
  workspaceId: string;
  currency: string;
  showPlatform?: boolean;
  locale?: Locale;
}) {
  if (decisions.length === 0) {
    return (
      <p className="card pad-md text-xs text-text-muted">
        {t(locale, "adDecision.empty")}
      </p>
    );
  }

  const counts = {
    SCALE: decisions.filter((d) => d.decision === "SCALE").length,
    HOLD: decisions.filter((d) => d.decision === "HOLD").length,
    PAUSE: decisions.filter((d) => d.decision === "PAUSE").length,
  };

  return (
    <div>
      {/* مجموعة واحدة مقسّمة بفواصل، لا ثلاث شارات عائمة: الأرقام الثلاثة
          تقسيم لمجموع واحد فتُقرأ معاً. **عرض لا فلتر** - جعلها قابلة
          للنقر كان سيُخفي صفوفاً دون أن يُدرك المستخدم أنه أخفاها. */}
      <div className="mb-3 inline-flex flex-wrap items-stretch overflow-hidden card">
        <Summary icon={TrendingUp} count={counts.SCALE} label={t(locale, "adDecision.scale")} tone="success" />
        <Summary icon={PauseCircle} count={counts.PAUSE} label={t(locale, "adDecision.pause")} tone="danger" />
        <Summary icon={MinusCircle} count={counts.HOLD} label={t(locale, "adDecision.hold")} tone="muted" />
      </div>

      {/* الجدول يمرّر أفقياً داخل حاويته - لا يدفع الصفحة كلها للتمرير */}
      <div className={TABLE_WRAP}>
        <table className="w-full min-w-[860px] text-start text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th className={TH}>{t(locale, "adDecision.colAd")}</th>
              {showPlatform && <th className={TH}>{t(locale, "adDecision.colPlatform")}</th>}
              <th className={TH}>{t(locale, "adDecision.colCpa")}</th>
              <th className={TH}>{t(locale, "adDecision.colVsAvg")}</th>
              <th className={TH}>{t(locale, "adDecision.colRoas")}</th>
              <th className={TH}>{t(locale, "adDecision.colSpend")}</th>
              <th className={TH}>{t(locale, "adDecision.colConversions")}</th>
              <th className={TH}>{t(locale, "adDecision.colDays")}</th>
              <th className={TH}>{t(locale, "adDecision.colDecision")}</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((d) => (
              <tr key={`${d.platform}-${d.adId}`} className="border-b border-border/50 last:border-0 align-top">
                {/* أيقونة القرار قبل الاسم: القرار يُلتقط بلمحة على يسار
                    الصفّ بدل قراءة آخر عمود في جدول عريض */}
                <td className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: `color-mix(in srgb, ${decisionColor(d.decision)} 13%, transparent)`,
                        color: decisionColor(d.decision),
                      }}
                    >
                      {d.decision === "SCALE" ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : d.decision === "PAUSE" ? (
                        <PauseCircle className="h-4 w-4" />
                      ) : (
                        <MinusCircle className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span
                        className="block max-w-[220px] truncate text-[13.5px] font-medium text-text-primary"
                        title={d.adName ?? d.adId}
                      >
                        {d.adName ?? d.adId}
                      </span>
                      <span className="mt-1 block max-w-[300px] text-[11.5px] leading-relaxed text-text-muted">
                        {locale === "en" ? d.reasonEn : d.reason}
                      </span>
                    </span>
                  </div>
                </td>

                {showPlatform && (
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {platformLabel(locale, d.platform)}
                  </td>
                )}

                <td className="px-4 py-3 tabular-nums text-text-primary">
                  {d.signals.cpa > 0 ? `${fmt(d.signals.cpa)} ${currency}` : "—"}
                </td>

                <td className="px-4 py-3">
                  <DivergenceBadge pct={d.signals.divergencePct} />
                  <div className="mt-0.5 text-[11px] text-text-muted">
                    {t(locale, "adDecision.avgIs", { value: fmt(d.signals.accountAvgCpa) })}
                  </div>
                </td>

                <td className="px-4 py-3 tabular-nums">
                  {d.signals.roas !== null ? (
                    <span className="text-text-primary">{d.signals.roas}x</span>
                  ) : (
                    <span className="text-text-muted" title={t(locale, "adDecision.noRoasTitle")}>
                      —
                    </span>
                  )}
                  {d.signals.frequency !== null && (
                    <div className="mt-0.5 text-[11px] text-text-muted">
                      {t(locale, "adDecision.frequency", { value: d.signals.frequency.toFixed(1) })}
                    </div>
                  )}
                </td>

                <td className="px-4 py-3 tabular-nums text-text-primary">{fmt(d.signals.cost)}</td>

                <td className="px-4 py-3 tabular-nums text-text-primary">
                  {Math.round(d.signals.conversions * 10) / 10}
                </td>

                <td className="px-4 py-3 tabular-nums text-text-muted">{d.signals.daysActive}</td>

                <td className="px-4 py-3">
                  <AdDecisionCell
                    locale={locale}
                    workspaceId={workspaceId}
                    adId={d.adId}
                    decision={d.decision}
                    reason={locale === "en" ? d.reasonEn : d.reason}
                    executable={d.executable}
                    blockedReason={d.blockedReason}
                    cooldownDaysRemaining={d.cooldownDaysRemaining}
                    lastAppliedDecision={d.lastAppliedDecision}
                    scaleIncreasePct={d.scaleIncreasePct}
                    scaleAffectsSiblings={d.scaleAffectsSiblings}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
        {t(locale, "adDecision.basis")}
      </p>
    </div>
  );
}

function Summary({
  icon: Icon,
  count,
  label,
  tone,
}: {
  icon: typeof TrendingUp;
  count: number;
  label: string;
  tone: "success" | "danger" | "muted";
}) {
  const color =
    tone === "success" ? "var(--verified)" : tone === "danger" ? "var(--critical)" : "var(--text-muted)";
  return (
    <span className="flex items-center gap-2.5 border-e border-border px-4 py-2.5 last:border-e-0">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-mono text-[15px] font-semibold tabular-nums" style={{ color }}>
          {count}
        </span>
        <span className="text-[11px] text-text-muted">{label}</span>
      </span>
    </span>
  );
}

function DivergenceBadge({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-xs text-text-muted">—</span>;
  // أرخص من المتوسط = فرق سالب = إشارة جيدة. اللون دلالي لا زخرفي.
  const good = pct < 0;
  return (
    <span
      className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
        good ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      {pct > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** لون القرار - نفس دلالات المنتج: أخضر توسيع، أحمر إيقاف، رمادي انتظار */
function decisionColor(decision: string): string {
  return decision === "SCALE"
    ? "var(--verified)"
    : decision === "PAUSE"
      ? "var(--critical)"
      : "var(--text-muted)";
}
