// app/admin/analytics/tabs/AcquisitionTab.tsx
//
// القمع أوّلاً، والمصادر تحته - والترتيب مقصود: "بيقعوا فين" سؤال بيتاخد
// عليه فعل، و"جايين منين" سؤال بيوجّه الصرف. الأوّل أعجل.

import { UserPlus, Plug, ShieldCheck, CreditCard, Clock } from "lucide-react";
import type { AcquisitionAnalytics, FunnelStep, SourceRow } from "@/lib/admin/acquisition";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TR, TD, TD_MUTED } from "@/app/components/ui/tableStyles";
import { Card, SectionTitle } from "../../components/AdminUI";

const STEP_ICON: Record<string, typeof UserPlus> = {
  signed_up: UserPlus,
  connected: Plug,
  verified: ShieldCheck,
  paid: CreditCard,
};

export function AcquisitionTab({ data }: { data: AcquisitionAnalytics }) {
  if (data.funnel.length === 0) {
    return (
      <Card>
        <p className="m-0 text-[12.5px] text-text-muted">
          No signups in this period, so there is no funnel to draw. Widen the range above.
        </p>
      </Card>
    );
  }

  const top = data.funnel[0].count;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle hint="where this period's signups have reached by now">Activation funnel</SectionTitle>

        <div className="space-y-2.5">
          {data.funnel.map((s, i) => (
            <FunnelRow key={s.key} step={s} top={top} isFirst={i === 0} />
          ))}
        </div>

        <p className="mt-3 border-t border-border pt-3 text-[11.5px] leading-relaxed text-text-faint">
          {data.note}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="what they said at signup">How they heard about us</SectionTitle>
          <SourceTable rows={data.howHeard} empty="Nobody has answered this yet." />
        </Card>

        <Card>
          <SectionTitle hint="referral code or source">Referrals</SectionTitle>
          <SourceTable rows={data.referral} empty="No referral sources recorded." />
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent">
              <Clock size={17} />
            </span>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-faint">Median days to pay</div>
              <div className="text-xl font-semibold tabular-nums text-text-primary">
                {data.medianDaysToPay !== null ? Math.round(data.medianDaysToPay) : "—"}
              </div>
            </div>
          </div>
          <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-text-faint">
            {data.medianDaysToPay !== null
              ? "Median, not mean — one conversion after nine months would drag an average somewhere meaningless."
              : "Shown once at least five signups in a period have converted."}
          </p>
        </Card>

        <Card>
          <div className="text-[11px] uppercase tracking-wide text-text-faint">Told us nothing</div>
          <div className="text-xl font-semibold tabular-nums text-text-primary">{data.unattributed}</div>
          <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-text-faint">
            Signups with neither an answer nor a referral source. This is the honest denominator — every share
            above is a share of the ones who did tell us, not of everyone.
          </p>
        </Card>
      </div>
    </div>
  );
}

function FunnelRow({ step, top, isFirst }: { step: FunnelStep; top: number; isFirst: boolean }) {
  const Icon = STEP_ICON[step.key] ?? UserPlus;
  const width = top > 0 ? Math.max((step.count / top) * 100, step.count > 0 ? 2 : 0) : 0;

  // السقوط بين خطوتين هو المعلومة، مش الوصول. الوصول ٤٠٪ مابيقولش فين
  // المشكلة؛ "٦٠٪ وقعوا هنا بالذات" بيقولها.
  const dropPct = step.fromPreviousPct !== null ? 100 - step.fromPreviousPct : null;
  const heavyDrop = dropPct !== null && dropPct >= 50;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-[12.5px] text-text-primary">
          <Icon size={14} className="shrink-0 text-text-faint" />
          {step.label}
        </span>
        <span className="shrink-0 tabular-nums text-[12.5px] text-text-muted">
          {step.count}
          {step.fromTopPct !== null && !isFirst && (
            <span className="ms-1.5 text-text-faint">({step.fromTopPct.toFixed(0)}%)</span>
          )}
        </span>
      </div>

      <div className="h-6 w-full overflow-hidden rounded-lg bg-surface-raised">
        <div
          className={`h-full rounded-lg ${heavyDrop ? "bg-gap/45" : "bg-accent/40"}`}
          style={{ width: `${width}%` }}
        />
      </div>

      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[11px] text-text-faint">{step.hint}</span>
        {dropPct !== null && dropPct > 0 && (
          <span className={`shrink-0 text-[11px] tabular-nums ${heavyDrop ? "text-gap" : "text-text-faint"}`}>
            −{dropPct.toFixed(0)}% from the step above
          </span>
        )}
      </div>
    </div>
  );
}

function SourceTable({ rows, empty }: { rows: SourceRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="m-0 text-[12.5px] text-text-faint">{empty}</p>;
  }
  return (
    <div className={TABLE_WRAP}>
      <table className={TABLE}>
        <thead>
          <tr className={THEAD_ROW}>
            <th className={TH}>Source</th>
            <th className={TH}>Signups</th>
            <th className={TH}>Paying</th>
            <th className={TH}>Converts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.source} className={TR}>
              <td className={TD}>{r.source}</td>
              <td className={TD_MUTED}>{r.signups}</td>
              <td className={TD_MUTED}>{r.paying}</td>
              <td className={TD}>
                {r.conversionPct !== null ? (
                  `${r.conversionPct.toFixed(0)}%`
                ) : (
                  <span className="text-text-faint" title="Hidden below five signups — a rate on fewer describes individuals, not a channel.">
                    —
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
