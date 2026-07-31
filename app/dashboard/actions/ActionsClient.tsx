"use client";

// app/dashboard/actions/ActionsClient.tsx
//
// مركز القرارات. النسخة السابقة كانت قائمة مسطّحة مرتّبة بالتاريخ: عشرون
// بنداً متشابهاً بلا مصدر ولا أثر ولا تقسيم، فلا يعرف المستخدم بأيّها يبدأ.
//
// ثلاثة مبادئ تحكم هذه الصفحة:
//
// ١) **الترتيب بالأثر لا بالتاريخ.** قرار يوفّر ٤٠٠٠ أهمّ من تنبيه وصل
//    قبله بساعة. التاريخ ترتيب أعمى حين تكون البنود غير متساوية القيمة.
//
// ٢) **المصدر معلن دائماً.** "من أين جاء هذا؟" سؤال يسبق "هل أنفّذه؟"،
//    وبلا إجابة عليه لا يثق المستخدم بالبند أصلاً.
//
// ٣) **التمييز الصريح بين ما يُنفَّذ فعلاً وما هو معلوماتي.** الضغط على
//    "نفّذ" في بند بلا actionType كان يسجّل موافقة دون أن يحدث شيء.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check, X, AlertOctagon, AlertTriangle, Info, Zap, Wallet,
  ChevronDown, ExternalLink, Loader2, CheckCircle2,
} from "lucide-react";
import { MetricCard, type MetricTone } from "@/app/components/ui/MetricCard";
import { t, type Locale } from "@/lib/i18n/dictionary";

export interface ActionItemData {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string | null;
  source: string;
  estimatedImpact: number | null;
  linkUrl: string | null;
  /** له تنفيذ حقيقي على المنصة - لا مجرّد تسجيل موافقة */
  executable: boolean;
  createdAt: string;
}

// مدّة انتظار التأكيد الثاني - كافية ليرى ويقرّر، لا قصيرة تُشعره بالعجلة
// ولا طويلة فينسى أنه في وضع تأكيد أصلاً.
const CONFIRM_WINDOW_MS = 4000;

const SEVERITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SEVERITY_TONE: Record<string, string> = {
  URGENT: "var(--critical)",
  HIGH: "var(--gap)",
  MEDIUM: "var(--accent)",
  LOW: "var(--text-muted)",
};

type Tab = "all" | "actionable" | "alerts";
type GroupBy = "source" | "severity";
type SortBy = "impact" | "newest";

export function ActionsClient({
  items, currency, locale = "ar",
}: {
  items: ActionItemData[];
  currency: string;
  locale?: Locale;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `actions.${k}`, v);
  const router = useRouter();

  const [processing, setProcessing] = useState<string | null>(null);
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("source");
  const [sortBy, setSortBy] = useState<SortBy>("impact");
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const live = useMemo(() => items.filter((i) => !handled.has(i.id)), [items, handled]);

  const counts = useMemo(() => ({
    urgent: live.filter((i) => i.severity === "URGENT").length,
    high: live.filter((i) => i.severity === "HIGH").length,
    suggestions: live.filter((i) => i.type === "SUGGESTION").length,
    // الأثر يُجمَع من البنود التي تحمل رقماً حقيقياً فقط - لا نعوّض
    // الفارغ بصفر ثم نعرضه كأنه إجمالي كامل
    impact: live.reduce((sum, i) => sum + (i.estimatedImpact ?? 0), 0),
  }), [live]);

  const filtered = useMemo(() => {
    const byTab =
      tab === "actionable" ? live.filter((i) => i.type === "SUGGESTION")
      : tab === "alerts" ? live.filter((i) => i.type !== "SUGGESTION")
      : live;
    return [...byTab].sort((a, b) => {
      if (sortBy === "impact") {
        const d = (b.estimatedImpact ?? -1) - (a.estimatedImpact ?? -1);
        if (d !== 0) return d;
        return (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [live, tab, sortBy]);

  const groups = useMemo(() => {
    const map = new Map<string, ActionItemData[]>();
    for (const item of filtered) {
      const key = groupBy === "source" ? item.source : item.severity;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    const entries = [...map.entries()];
    if (groupBy === "severity") {
      entries.sort((a, b) => (SEVERITY_ORDER[a[0]] ?? 9) - (SEVERITY_ORDER[b[0]] ?? 9));
    } else {
      // المصادر تُرتَّب بأخطر بند فيها - لا أبجدياً
      entries.sort((a, b) => {
        const worst = (g: ActionItemData[]) => Math.min(...g.map((i) => SEVERITY_ORDER[i.severity] ?? 9));
        return worst(a[1]) - worst(b[1]);
      });
    }
    return entries;
  }, [filtered, groupBy]);

  async function handle(id: string, action: "apply" | "dismiss") {
    setProcessing(id);
    setError(null);
    const res = await fetch(`/api/action-feed/${id}/${action}`, { method: "POST" });
    setProcessing(null);

    if (!res.ok) {
      // فشل حقيقي (كفشل نداء المنصة) يجب أن يظهر - لا نخفي البند كأنه
      // نُفِّذ بنجاح وهو لم يفعل شيئاً
      const data = await res.json().catch(() => ({ error: tr("genericFail") }));
      setError(data.error ?? tr("genericFail"));
      return;
    }

    setHandled((prev) => new Set(prev).add(id));
    router.refresh();
  }

  function handleApplyClick(id: string) {
    if (pendingConfirm === id) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setPendingConfirm(null);
      handle(id, "apply");
      return;
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setPendingConfirm(id);
    confirmTimerRef.current = setTimeout(() => setPendingConfirm(null), CONFIRM_WINDOW_MS);
  }

  if (live.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <CheckCircle2 size={26} className="mx-auto mb-3 text-verified" />
        <p className="text-[13.5px] text-text-primary">{tr("emptyTitle")}</p>
        <p className="mt-1 text-[12.5px] text-text-muted">{tr("emptyBody")}</p>
      </div>
    );
  }

  return (
    <div>
      {/* حصيلة أعلى الصفحة - نفس نظام البطاقة الموحّد */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={tr("kpiUrgent")}
          value={String(counts.urgent)}
          icon={AlertOctagon}
          tone={(counts.urgent > 0 ? "critical" : "verified") as MetricTone}
          caption={{ text: tr("kpiUrgentCaption"), tone: counts.urgent > 0 ? "negative" : "muted" }}
        />
        <MetricCard
          label={tr("kpiHigh")}
          value={String(counts.high)}
          icon={AlertTriangle}
          tone={(counts.high > 0 ? "gap" : "verified") as MetricTone}
          caption={{ text: tr("kpiHighCaption"), tone: "muted" }}
        />
        <MetricCard
          label={tr("kpiSuggestions")}
          value={String(counts.suggestions)}
          icon={Zap}
          tone={"accent" as MetricTone}
          caption={{ text: tr("kpiSuggestionsCaption"), tone: "muted" }}
        />
        <MetricCard
          label={tr("kpiImpact")}
          value={counts.impact > 0 ? Math.round(counts.impact).toLocaleString("en-US") : "—"}
          unit={counts.impact > 0 ? currency : undefined}
          icon={Wallet}
          tone={"verified" as MetricTone}
          caption={{ text: tr("kpiImpactCaption"), tone: "positive" }}
        />
      </div>

      {/* أدوات العرض */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <Pill active={tab === "all"} onClick={() => setTab("all")} label={tr("tabAll")} />
          <Pill active={tab === "actionable"} onClick={() => setTab("actionable")} label={tr("tabActionable")} />
          <Pill active={tab === "alerts"} onClick={() => setTab("alerts")} label={tr("tabAlerts")} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="rounded-xl border border-border bg-surface px-3 py-1.5 text-[12px] text-text-primary outline-none"
          >
            <option value="source">{tr("groupBySource")}</option>
            <option value="severity">{tr("groupBySeverity")}</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-xl border border-border bg-surface px-3 py-1.5 text-[12px] text-text-primary outline-none"
          >
            <option value="impact">{tr("sortImpact")}</option>
            <option value="newest">{tr("sortNewest")}</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-2xl border border-critical/35 bg-critical/[0.06] p-3 text-[12.5px] text-critical">
          {tr("applyFailed", { error })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-[13px] text-text-muted">
          {tr("emptyFiltered")}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([key, groupItems]) => (
            <section key={key} className="card-shadow overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
                  {groupBy === "severity" && (
                    <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_TONE[key] }} />
                  )}
                  {tr(groupBy === "source" ? `src${key}` : `sev${key}`)}
                </span>
                <span className="text-[11.5px] text-text-faint">{tr("nItems", { n: groupItems.length })}</span>
              </div>

              <ul>
                {groupItems.map((item, i) => (
                  <li key={item.id} className={i === 0 ? "" : "border-t border-border/50"}>
                    <div className="flex items-start gap-3 p-4">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: SEVERITY_TONE[item.severity] ?? "var(--text-muted)" }}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              item.type === "SUGGESTION" ? "bg-accent/15 text-accent"
                              : item.type === "ACCOUNT" ? "bg-surface-raised text-text-muted"
                              : "bg-gap/15 text-gap"
                            }`}
                          >
                            {tr(item.type === "SUGGESTION" ? "typeSuggestion" : item.type === "ACCOUNT" ? "typeAccount" : "typeAlert")}
                          </span>
                          {groupBy === "severity" && (
                            <span className="text-[10.5px] text-text-faint">{tr(`src${item.source}`)}</span>
                          )}
                          {item.estimatedImpact !== null && item.estimatedImpact > 0 && (
                            <span className="rounded-full bg-verified/12 px-2 py-0.5 text-[10.5px] font-medium tabular-nums text-verified">
                              {Math.round(item.estimatedImpact).toLocaleString("en-US")} {currency}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                          className="flex w-full items-start gap-1.5 text-start"
                        >
                          <span className="flex-1 text-[13.5px] font-medium text-text-primary">{item.title}</span>
                          {item.description && (
                            <ChevronDown
                              size={14}
                              className={`mt-0.5 shrink-0 text-text-faint transition-transform ${expanded === item.id ? "rotate-180" : ""}`}
                            />
                          )}
                        </button>

                        {/* التفاصيل محتوى حقيقي في مكانها - لا زرّ يقود
                            لصفحة أخرى تبدأ من الصفر */}
                        {expanded === item.id && item.description && (
                          <div className="mt-2 rounded-xl bg-surface-raised/70 p-3">
                            <p className="text-[12.5px] leading-relaxed text-text-muted">{item.description}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <span className={`text-[11px] ${item.executable ? "text-verified" : "text-text-faint"}`}>
                                {tr(item.executable ? "executable" : "informational")}
                              </span>
                              {item.linkUrl && (
                                <a href={item.linkUrl} className="flex items-center gap-1 text-[11.5px] text-accent no-underline">
                                  {tr("openSource")} <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {item.type === "SUGGESTION" && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          {pendingConfirm === item.id ? (
                            <button
                              onClick={() => handleApplyClick(item.id)}
                              disabled={processing === item.id}
                              className="flex h-8 items-center gap-1 rounded-full bg-critical/15 px-3 text-[11.5px] font-medium text-critical disabled:opacity-40"
                            >
                              {processing === item.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              {tr("confirm")}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApplyClick(item.id)}
                              disabled={processing === item.id}
                              title={tr("apply")}
                              aria-label={tr("apply")}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-verified/15 text-verified disabled:opacity-40"
                            >
                              <Check size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => handle(item.id, "dismiss")}
                            disabled={processing === item.id}
                            title={tr("dismiss")}
                            aria-label={tr("dismiss")}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-text-muted disabled:opacity-40"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors ${
        active ? "bg-surface-raised font-medium text-text-primary" : "text-text-muted hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}
