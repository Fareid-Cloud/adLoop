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

const PLATFORM_LABEL: Record<string, string> = {
  GOOGLE_ADS: "جوجل",
  META_ADS: "ميتا",
  TIKTOK_ADS: "تيك توك",
  SNAPCHAT_ADS: "سناب شات",
};

export function AdDecisionTable({
  decisions,
  workspaceId,
  currency,
  showPlatform = true,
}: {
  decisions: AdDecisionView[];
  workspaceId: string;
  currency: string;
  showPlatform?: boolean;
}) {
  if (decisions.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-xs text-text-muted">
        لا توجد بيانات كافية على مستوى الإعلان بعد. تتحدّث تلقائياً مع المزامنة اليومية.
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Summary icon={TrendingUp} count={counts.SCALE} label="يستحق التوسيع" tone="success" />
        <Summary icon={PauseCircle} count={counts.PAUSE} label="يستحق الإيقاف" tone="danger" />
        <Summary icon={MinusCircle} count={counts.HOLD} label="تحت المراقبة" tone="muted" />
      </div>

      {/* الجدول يمرّر أفقياً داخل حاويته - لا يدفع الصفحة كلها للتمرير */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[860px] text-right text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th className="px-4 py-3 font-medium">الإعلان</th>
              {showPlatform && <th className="px-4 py-3 font-medium">المنصة</th>}
              <th className="px-4 py-3 font-medium">تكلفة العميل</th>
              <th className="px-4 py-3 font-medium">مقابل المتوسط</th>
              <th className="px-4 py-3 font-medium">العائد</th>
              <th className="px-4 py-3 font-medium">الإنفاق</th>
              <th className="px-4 py-3 font-medium">التحويلات</th>
              <th className="px-4 py-3 font-medium">أيام</th>
              <th className="px-4 py-3 font-medium">القرار</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((d) => (
              <tr key={`${d.platform}-${d.adId}`} className="border-b border-border/50 last:border-0 align-top">
                <td className="px-4 py-3">
                  <div className="max-w-[220px] truncate font-medium text-text-primary" title={d.adName ?? d.adId}>
                    {d.adName ?? d.adId}
                  </div>
                  <p className="mt-1 max-w-[260px] text-[11px] leading-relaxed text-text-muted">{d.reason}</p>
                </td>

                {showPlatform && (
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {PLATFORM_LABEL[d.platform] ?? d.platform}
                  </td>
                )}

                <td className="px-4 py-3 tabular-nums text-text-primary">
                  {d.signals.cpa > 0 ? `${fmt(d.signals.cpa)} ${currency}` : "—"}
                </td>

                <td className="px-4 py-3">
                  <DivergenceBadge pct={d.signals.divergencePct} />
                  <div className="mt-0.5 text-[11px] text-text-muted">
                    المتوسط {fmt(d.signals.accountAvgCpa)}
                  </div>
                </td>

                <td className="px-4 py-3 tabular-nums">
                  {d.signals.roas !== null ? (
                    <span className="text-text-primary">{d.signals.roas}x</span>
                  ) : (
                    <span className="text-text-muted" title="هذه المنصة لا تُرجع قيمة تحويل على مستوى الإعلان الفردي">
                      —
                    </span>
                  )}
                  {d.signals.frequency !== null && (
                    <div className="mt-0.5 text-[11px] text-text-muted">
                      تكرار {d.signals.frequency.toFixed(1)}
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
                    workspaceId={workspaceId}
                    adId={d.adId}
                    decision={d.decision}
                    reason={d.reason}
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
        القرار مبنيّ على تكلفة العميل مقابل متوسط حسابك، والعائد مقابل نقطة التعادل الحقيقية لهامش ربحك،
        وحجم العينة وعدد الأيام والتعب الإحصائي ومعدّل التكرار. بعد تنفيذ أي قرار، لا يُقترح غيره على
        الإعلان نفسه قبل ٤ أيام حتى تُقاس نتيجته أولاً.
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
  const cls =
    tone === "success"
      ? "border-success/40 bg-success/10 text-success"
      : tone === "danger"
        ? "border-danger/40 bg-danger/10 text-danger"
        : "border-border bg-surface-2 text-text-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="tabular-nums font-semibold">{count}</span>
      {label}
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
