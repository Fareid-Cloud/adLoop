"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ThumbsUp, ThumbsDown, RotateCcw, Clock, Loader2, Check, ChevronDown, ChevronRight,
} from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import type { AgentReviewSummary, ReviewFilter, ReviewRow } from "@/lib/admin/agentReview";
// من `agentVerdicts` لا من `agentReview`: التاني بيستورد Prisma.
import { VERDICTS } from "@/lib/admin/agentVerdicts";
import { Card, SectionTitle, Badge } from "../components/AdminUI";

export function AgentReviewClient({
  rows, summary, filters, activeFilter, days,
}: {
  rows: ReviewRow[];
  summary: AgentReviewSummary;
  filters: Array<{ key: ReviewFilter; label: string }>;
  activeFilter: ReviewFilter;
  days: number;
}) {
  return (
    <div className="space-y-4">
      <SummaryStrip summary={summary} />

      <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/admin/agent?filter=${f.key}&days=${days}`}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium no-underline transition-colors ${
              f.key === activeFilter
                ? "bg-critical/15 text-critical"
                : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <span className="ms-auto flex gap-1">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/admin/agent?filter=${activeFilter}&days=${d}`}
              className={`rounded-lg px-2.5 py-1 text-[12px] font-medium no-underline transition-colors ${
                d === days ? "bg-critical/15 text-critical" : "border border-border text-text-muted hover:text-text-primary"
              }`}
            >
              {d}d
            </Link>
          ))}
        </span>
      </div>

      {summary.byPromptVersion.length > 1 && <VersionTable summary={summary} />}

      {rows.length === 0 ? (
        <Card>
          <p className="m-0 text-[12.5px] text-text-muted">
            {activeFilter === "queue"
              ? "Nothing waiting for review in this period — every answer has a verdict."
              : "No answers match this filter in this period."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <ReviewCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryStrip({ summary }: { summary: AgentReviewSummary }) {
  // معدّلُ الرضا على **المقيَّم** لا على الكلّ: أغلبُ الإجابات مالهاش
  // تقييم، وقسمتُها على الكلّ بتدّي رقماً منخفضاً دايماً يوصف الصمت لا الجودة.
  const satisfaction = summary.rated > 0 ? (summary.thumbsUp / summary.rated) * 100 : null;
  const reaskedPct = summary.answers > 0 ? (summary.reasked / summary.answers) * 100 : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Answers" value={String(summary.answers)} sub={`${summary.reviewed} reviewed`} />
      <Stat
        label="Rated good"
        value={satisfaction !== null ? `${satisfaction.toFixed(0)}%` : "—"}
        sub={satisfaction !== null ? `of ${summary.rated} rated` : "nobody has rated yet"}
        tone={satisfaction !== null && satisfaction < 70 ? "bad" : "ok"}
      />
      <Stat
        label="Asked again"
        value={reaskedPct !== null ? `${reaskedPct.toFixed(0)}%` : "—"}
        sub="re-asked within two minutes"
        tone={reaskedPct !== null && reaskedPct > 20 ? "bad" : "ok"}
      />
      <Stat
        label="Median latency"
        value={summary.medianLatencyMs !== null ? `${(summary.medianLatencyMs / 1000).toFixed(1)}s` : "—"}
        sub={summary.avgOutputTokens !== null ? `~${summary.avgOutputTokens} output tokens` : "no telemetry yet"}
      />
    </div>
  );
}

function Stat({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone?: "ok" | "bad" }) {
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wide text-text-faint">{label}</div>
      <div
        className={`text-2xl font-semibold tabular-nums ${
          tone === "bad" ? "text-critical" : "text-text-primary"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11.5px] text-text-faint">{sub}</div>}
    </Card>
  );
}

function VersionTable({ summary }: { summary: AgentReviewSummary }) {
  return (
    <Card>
      <SectionTitle hint="did the change help?">By prompt version</SectionTitle>
      <ul className="m-0 list-none space-y-1.5 p-0">
        {summary.byPromptVersion.map((v) => (
          <li key={v.version} className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
            <span className="font-medium text-text-primary">{v.version}</span>
            <span className="tabular-nums text-text-muted">
              {v.answers} answers · <span className="text-verified">{v.thumbsUp}👍</span>{" "}
              <span className="text-critical">{v.thumbsDown}👎</span>
              {v.reaskedPct !== null && <> · {v.reaskedPct.toFixed(0)}% re-asked</>}
            </span>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-2 border-t border-border pt-2 text-[11.5px] leading-relaxed text-text-faint">
        Compare a version against the one before it. Versions with few answers say nothing yet — a rate on a
        handful of replies moves with any single one of them.
      </p>
    </Card>
  );
}

function ReviewCard({ row }: { row: ReviewRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState(row.reviewNote ?? "");
  const [verdict, setVerdict] = useState(row.verdict);
  const [saved, setSaved] = useState(false);

  async function save(nextVerdict: string) {
    setBusy(nextVerdict);
    const res = await fetch(`/api/admin/agent/${row.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ verdict: nextVerdict, note: note.trim() || null }),
    }).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      setVerdict(nextVerdict);
      setSaved(true);
      // مش `refresh()` فوراً: في فلتر "غير المراجَع" ده بيشيل الكارت من
      // تحت إيد اللي لسه بيكتب ملاحظة عليه. التحديث بيستنّى الطيّ.
      setTimeout(() => setSaved(false), 2000);
    }
  }

  const ctx = row.contextSummary as Record<string, unknown> | null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {row.rating === 1 && <Badge tone="ok"><ThumbsUp size={9} className="me-0.5 inline" />rated good</Badge>}
            {row.rating === -1 && <Badge tone="bad"><ThumbsDown size={9} className="me-0.5 inline" />rated bad</Badge>}
            {row.reasked && <Badge tone="warn"><RotateCcw size={9} className="me-0.5 inline" />asked again</Badge>}
            {verdict && <Badge tone={verdict === "GOOD" ? "ok" : "bad"}>{verdict.toLowerCase().replace(/_/g, " ")}</Badge>}
            {row.latencyMs !== null && (
              <span className="text-[11px] text-text-faint">
                <Clock size={9} className="me-0.5 inline" />
                {(row.latencyMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          <p className="m-0 mt-1.5 text-[13px] font-medium text-text-primary">{row.question}</p>
        </div>
        <span className="shrink-0 text-[11px] text-text-faint">{row.userEmail}</span>
      </div>

      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          // التحديث عند الطيّ لا عند الحفظ - عشان الكارت مايختفيش وانت
          // لسه بتكتب فيه.
          if (!next && verdict !== row.verdict) router.refresh();
        }}
        className="mt-2 flex items-center gap-1 rounded p-0.5 text-[12px] text-text-muted hover:text-text-primary"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {open ? "Hide the answer" : "Read the answer"}
      </button>

      {open && (
        <>
          <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-border bg-surface-raised p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap text-text-primary">
            {row.answer}
          </div>

          {/* 🔴 السياق قبل الحكم: إجابةٌ ضعيفة على مساحةٍ فاضية عيبٌ في
              البيانات لا في المساعد، وتعديلُ التعليمات عندها بيصلّح الشيء
              الغلط - وبيضيّع الإجابات الصح في المساحات الممتلئة. */}
          {ctx && (
            <p className="m-0 mt-2 text-[11.5px] text-text-faint">
              It could see: {String(ctx.campaigns ?? 0)} campaigns · {String(ctx.creatives ?? 0)} creatives ·{" "}
              {String(ctx.historyMonths ?? 0)} months of history · tracking tag{" "}
              {ctx.tagLive ? "live" : "not live"}
            </p>
          )}

          <div className="mt-3 border-t border-border pt-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What exactly is wrong with it? This is what the next prompt change gets written from."
              rows={2}
              className="field w-full text-[12.5px]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {VERDICTS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => save(v.key)}
                  disabled={!!busy}
                  className={`rounded-lg border px-2.5 py-1 text-[12px] transition-colors ${
                    verdict === v.key
                      ? "border-critical bg-critical/15 text-critical"
                      : "border-border text-text-muted hover:text-text-primary"
                  }`}
                >
                  {busy === v.key ? <Loader2 size={11} className="animate-spin" /> : v.label}
                </button>
              ))}
              {saved && (
                <span className="flex items-center gap-1 text-[11.5px] text-verified">
                  <Check size={11} /> saved
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
