"use client";

// عرض الاختبارات: تُنشأ تلقائياً عند تنفيذ أي قرار، وتُقاس نتيجتها بعد
// اكتمال النافذة. الإضافة اليدوية ميزة إضافية لتسجيل تغيير أجريته خارج
// المنتج (نص إعلان، صفحة هبوط، استهداف).

import {
  createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { Beaker, Plus, TrendingUp, TrendingDown, Minus, X, Check, Pencil, Trash2, AlertTriangle, ChevronDown } from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { OptionGroup } from "@/app/components/ui/OptionGroup";
import { EXPERIMENT_METRICS } from "@/lib/experimentMetrics";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { Select } from "@/app/components/ui/Select";

interface MetricResult { before: number; after: number; changePct: number | null }

export interface ExperimentRow {
  id: string;
  changeType: string;
  description: string;
  changedAt: string;
  platform: string | null;
  campaignName: string | null;
  source: "AUTO" | "MANUAL";
  status: "RUNNING" | "MEASURED" | "INCONCLUSIVE";
  confidenceLevel: string;
  windowDays: number;
  note: string | null;
  trackedMetrics: string[];
  metricResults: Record<string, MetricResult> | null;
}

// سياق اللغة بدل تمريرها عبر ثلاثة مكوّنات متداخلة - نفس نمط الإعدادات.
const LabLocaleContext = createContext<Locale>("ar");
function useT() {
  const locale = useContext(LabLocaleContext);
  return (k: string, vars?: Record<string, string | number>) => t(locale, `lab.${k}`, vars);
}
function useLocale() {
  return useContext(LabLocaleContext);
}

const CHANGE_TYPE_KEYS: Record<string, string> = {
  BUDGET: "typeBudget", AD_COPY: "typeAdCopy", LANDING_PAGE: "typeLanding",
  TARGETING: "typeTargeting", BID_STRATEGY: "typeBid", CREATIVE: "typeCreative",
  PAUSE: "typePause", AUTOMATION_RULE: "typeRule", OTHER: "typeOther",
};

const CONFIDENCE_TONE: Record<string, { key: string; tone: string }> = {
  RELIABLE: { key: "confReliable", tone: "var(--verified)" },
  PRELIMINARY: { key: "confPreliminary", tone: "var(--gap)" },
  INSUFFICIENT_DATA: { key: "confInsufficient", tone: "var(--text-muted)" },
};

export function ExperimentsView({
  workspaceId, experiments, campaigns, locale,
}: {
  workspaceId: string;
  experiments: ExperimentRow[];
  campaigns: { id: string; name: string; platform: string }[];
  locale: Locale;
}) {
  return (
    <LabLocaleContext.Provider value={locale}>
      <ExperimentsBody workspaceId={workspaceId} experiments={experiments} campaigns={campaigns} />
    </LabLocaleContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// **جدولٌ ثمّ تفصيل، لا رصفُ بطاقاتٍ متطابقة.**
//
// 🔴 كانت كلُّ تجربةٍ بطاقةً كاملةً تحمل كلَّ شيء: الوصفَ والمقاييسَ
// وأزرارَ التحرير والحذف. فعشرُ تجاربَ = عشرُ بطاقاتٍ متطابقةِ الشكل
// والطول، لا يُعرف من نظرةٍ أيُّها يُقاس الآن وأيُّها صدر حكمُه، ولا
// تُقارَن واحدةٌ بأخرى لأنّ الأرقام في مواضعَ مختلفةٍ من كلّ بطاقة.
//
// الصفُّ الواحد يعرض ما **يُقارَن**: الاسم، ومتى بدأت، وكم بقي، والحالة،
// والحكم. والتفصيلُ - قبل/بعد لكلّ مقياس - يُفتح عند الطلب لتجربةٍ بعينها.
// وهو الترتيب الذي يعمل به من يدير تجاربَ فعلاً: يمسح القائمة، ثمّ يفتح
// ما نضج منها.

interface Verdict {
  key: "verdictBetter" | "verdictWorse" | "verdictFlat" | "verdictPending";
  tone: string;
}

/**
 * حكمُ التجربة من مقياسها الأوّل.
 *
 * **الأوّلُ لا المتوسّط**: `trackedMetrics` مرتّبةٌ بما اختاره صاحبها، وأوّلُها
 * هو الذي أُجريت التجربة لأجله. ومتوسّطُ مقاييسَ مختلفةِ الاتّجاه (تكلفةٌ
 * يُراد خفضُها، وتحويلاتٌ يُراد رفعُها) لا معنى له.
 */
function verdictOf(exp: ExperimentRow): Verdict {
  if (exp.status === "RUNNING") return { key: "verdictPending", tone: "var(--text-muted)" };
  const key = exp.trackedMetrics[0];
  const r = key ? exp.metricResults?.[key] : null;
  if (!r || r.changePct === null) return { key: "verdictPending", tone: "var(--text-muted)" };

  const def = EXPERIMENT_METRICS.find((m) => m.key === key);
  const pct = r.changePct;
  // عتبةُ ٢٪: ما دونها ضجيجُ قياسٍ لا أثرُ تغيير.
  if (Math.abs(pct) < 2) return { key: "verdictFlat", tone: "var(--text-muted)" };
  const good = def?.lowerIsBetter ? pct < 0 : pct > 0;
  return good
    ? { key: "verdictBetter", tone: "var(--verified)" }
    : { key: "verdictWorse", tone: "var(--critical)" };
}

function ExperimentsBody({
  workspaceId, experiments, campaigns,
}: {
  workspaceId: string;
  experiments: ExperimentRow[];
  campaigns: { id: string; name: string; platform: string }[];
}) {
  const tr = useT();
  const locale = useLocale();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [typeF, setTypeF] = useState("");

  const filtered = experiments.filter((e) => {
    if (statusF && e.status !== statusF) return false;
    if (typeF && e.changeType !== typeF) return false;
    if (q.trim() && !`${e.description} ${e.campaignName ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  const open = experiments.find((e) => e.id === openId) ?? null;
  const filtersOn = Boolean(q || statusF || typeF);

  const STATUS_LABEL: Record<string, string> = {
    RUNNING: tr("stRunning"), MEASURED: tr("stMeasured"), INCONCLUSIVE: tr("stInconclusive"),
  };
  const STATUS_TONE: Record<string, string> = {
    RUNNING: "var(--accent)", MEASURED: "var(--verified)", INCONCLUSIVE: "var(--text-muted)",
  };

  return (
    <div>
      {/* الإجراءُ الأساسيّ في صفّه، والشرحُ مطويّ */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <details className="group min-w-0 flex-1">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[12.5px] text-text-muted transition-colors hover:text-text-primary">
            <Beaker size={14} className="shrink-0 text-accent" />
            {tr("howItWorks")}
            <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-text-muted">
            {tr("howItWorksBody")}
          </p>
        </details>
        <button onClick={() => setAdding(true)} className="btn btn-primary btn-sm shrink-0">
          <Plus size={14} /> {tr("manualBtn")}
        </button>
      </div>

      {experiments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Beaker size={26} className="mx-auto mb-3 text-text-faint" />
          <p className="text-[13.5px] text-text-primary">{tr("noneTitle")}</p>
          <p className="mt-1 text-[12.5px] text-text-muted">{tr("noneBody")}</p>
        </div>
      ) : (
        <>
          {/* مرشّحاتٌ تظهر حين يكون ثمّة ما يُرشَّح - صفٌّ من ثلاثة ضوابط
              فوق ثلاث تجارب عبءٌ لا عون. */}
          {experiments.length > 3 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tr("searchPh")}
                className="field field-sm min-w-[12rem] flex-1"
              />
              <select
                value={statusF}
                onChange={(e) => setStatusF(e.target.value)}
                className="field field-sm w-auto"
              >
                <option value="">{tr("anyStatus")}</option>
                {["RUNNING", "MEASURED", "INCONCLUSIVE"].map((k) => (
                  <option key={k} value={k}>{STATUS_LABEL[k]}</option>
                ))}
              </select>
              <select
                value={typeF}
                onChange={(e) => setTypeF(e.target.value)}
                className="field field-sm w-auto"
              >
                <option value="">{tr("anyType")}</option>
                {Object.keys(CHANGE_TYPE_KEYS).map((k) => (
                  <option key={k} value={k}>{tr(CHANGE_TYPE_KEYS[k])}</option>
                ))}
              </select>
              {filtersOn && (
                <button
                  onClick={() => { setQ(""); setStatusF(""); setTypeF(""); }}
                  className="btn btn-ghost btn-sm"
                >
                  <X size={13} /> {tr("clearFilters")}
                </button>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-[12.5px] text-text-muted">
              {tr("noMatch")}
            </p>
          ) : (
            <div className="card-shadow overflow-hidden card">
              {/* رؤوسُ الأعمدة تختفي تحت `sm`: خمسةُ أعمدةٍ في ٣٧٥ بكسلاً
                  تُنتج نصّاً مقطوعاً، فيصير الصفُّ كتلةً مكدّسة. */}
              <div className="hidden items-center gap-3 border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-text-faint sm:flex">
                <span className="min-w-0 flex-1">{tr("colExperiment")}</span>
                <span className="w-[92px] shrink-0">{tr("colStarted")}</span>
                <span className="w-[104px] shrink-0">{tr("colProgress")}</span>
                <span className="w-[92px] shrink-0">{tr("colStatus")}</span>
                <span className="w-[150px] shrink-0">{tr("colResult")}</span>
              </div>

              <div className="divide-y divide-border">
                {filtered.map((e) => {
                  const v = verdictOf(e);
                  const daysLeft = Math.max(
                    0,
                    e.windowDays - Math.floor((Date.now() - new Date(e.changedAt).getTime()) / 86400000)
                  );
                  return (
                    <div
                      key={e.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenId(e.id)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setOpenId(e.id); }
                      }}
                      className="row-toggle flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:flex-nowrap"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        {e.platform && <PlatformLogo platform={e.platform} size={15} />}
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-text-primary">{e.description}</span>
                          <span className="block truncate text-[11px] text-text-faint">
                            {CHANGE_TYPE_KEYS[e.changeType] ? tr(CHANGE_TYPE_KEYS[e.changeType]) : e.changeType}
                            {e.campaignName ? ` · ${e.campaignName}` : ""}
                          </span>
                        </span>
                      </span>

                      <span className="w-[92px] shrink-0 text-[11.5px] tabular-nums text-text-muted">
                        {new Date(e.changedAt).toLocaleDateString(
                          locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
                          { day: "numeric", month: "short" }
                        )}
                      </span>

                      <span className="w-[104px] shrink-0 text-[11.5px] text-text-muted">
                        {e.status === "RUNNING"
                          ? daysLeft > 0 ? tr("dLeft", { n: daysLeft }) : tr("readyNow")
                          : tr("windowN", { n: e.windowDays })}
                      </span>

                      <span className="flex w-[92px] shrink-0 items-center gap-1.5 text-[11.5px]">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: STATUS_TONE[e.status] }}
                        />
                        <span className="truncate text-text-muted">{STATUS_LABEL[e.status]}</span>
                      </span>

                      <span
                        className="w-[150px] shrink-0 truncate text-[11.5px] font-medium"
                        style={{ color: v.tone }}
                      >
                        {tr(v.key)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {open && (
        <ExperimentDetail
          exp={open}
          workspaceId={workspaceId}
          onClose={() => setOpenId(null)}
        />
      )}

      {adding && (
        <ManualExperimentModal workspaceId={workspaceId} campaigns={campaigns} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}

/**
 * تفصيلُ تجربةٍ واحدة: الحكمُ أوّلاً، ثمّ قبل/بعد لكلّ مقياس.
 *
 * **الحكمُ في الأعلى لا في الأسفل.** من يفتح تجربةً انتهت يسأل سؤالاً
 * واحداً: هل نجح التغيير؟ ووضعُ الجواب بعد جدولِ أرقامٍ يجعله يقرأ ليصل
 * إلى ما جاء لأجله. الأرقامُ تحته تشرح **لماذا** كان الحكم كذلك.
 */
function ExperimentDetail({
  exp, workspaceId, onClose,
}: {
  exp: ExperimentRow;
  workspaceId: string;
  onClose: () => void;
}) {
  const tr = useT();
  const locale = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [desc, setDesc] = useState(exp.description);
  const [note, setNote] = useState(exp.note ?? "");
  const [win, setWin] = useState(exp.windowDays);

  const conf = CONFIDENCE_TONE[exp.confidenceLevel] ?? CONFIDENCE_TONE.INSUFFICIENT_DATA;
  const v = verdictOf(exp);
  const daysLeft = Math.max(
    0,
    exp.windowDays - Math.floor((Date.now() - new Date(exp.changedAt).getTime()) / 86400000)
  );

  async function save() {
    setBusy(true);
    await fetch(`/api/workspaces/${workspaceId}/experiments/${exp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: desc, note, windowDays: win }),
    }).catch(() => {});
    setBusy(false); setEditing(false); router.refresh();
  }

  async function remove() {
    setBusy(true);
    await fetch(`/api/workspaces/${workspaceId}/experiments/${exp.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false); setConfirmDelete(false); onClose(); router.refresh();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pop-shadow hover-scrollbar scrollbar-zone max-h-[90vh] w-full max-w-3xl overflow-y-auto card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {exp.platform && <PlatformLogo platform={exp.platform} size={16} />}
              <h2 className="text-[15px] font-semibold text-text-primary">{exp.description}</h2>
              <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10.5px] text-text-muted">
                {CHANGE_TYPE_KEYS[exp.changeType] ? tr(CHANGE_TYPE_KEYS[exp.changeType]) : exp.changeType}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] text-text-faint">
              {new Date(exp.changedAt).toLocaleDateString(
                locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
                { day: "numeric", month: "long", year: "numeric" }
              )}
              {" · "}
              {tr("windowN", { n: exp.windowDays })}
              {exp.campaignName ? ` · ${exp.campaignName}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={() => setEditing((x) => !x)} aria-label={tr("editAria")}
                    className="card-inset p-1.5 text-text-muted hover:text-text-primary">
              <Pencil size={13} />
            </button>
            <button onClick={() => setConfirmDelete(true)} aria-label={tr("deleteAria")}
                    className="card-inset p-1.5 text-text-muted hover:text-critical">
              <Trash2 size={13} />
            </button>
            <button onClick={onClose} aria-label={tr("cancel")} className="btn btn-ghost btn-icon btn-sm">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="p-4">
          {/* ── الحكم ─────────────────────────────────────────────── */}
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5"
            style={{
              borderColor: `color-mix(in srgb, ${v.tone} 38%, transparent)`,
              background: `color-mix(in srgb, ${v.tone} 8%, transparent)`,
            }}
          >
            <span className="text-[14px] font-semibold" style={{ color: v.tone }}>
              {tr(v.key)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: `color-mix(in srgb, ${conf.tone} 14%, transparent)`, color: conf.tone }}>
              {tr(conf.key)}
            </span>
          </div>

          {editing && (
            <div className="mb-4 flex flex-col gap-2.5 card-inset pad-sm">
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={tr("descPlaceholder")} className="field" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("notePlaceholder")} className="field" />
              <OptionGroup
                label={tr("window")}
                size="sm"
                value={win}
                onChange={setWin}
                options={[3, 7, 14, 30].map((d) => ({ value: d, label: tr("daysN", { n: d }) }))}
              />
              {win !== exp.windowDays && exp.status !== "RUNNING" && (
                <p className="text-[11.5px] text-gap">{tr("windowWarn")}</p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className="card px-3 py-1.5 text-[12px] text-text-muted">{tr("cancel")}</button>
                <button onClick={save} disabled={busy} className="btn btn-primary btn-sm">
                  {busy ? tr("saving") : tr("save")}
                </button>
              </div>
            </div>
          )}

          {confirmDelete && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-critical/35 bg-critical/[0.06] p-3">
              <span className="flex items-center gap-2 text-[12.5px] text-text-primary">
                <AlertTriangle size={14} className="text-critical" /> {tr("confirmDelete")}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="card px-3 py-1.5 text-[12px] text-text-muted">{tr("cancel")}</button>
                <button onClick={remove} disabled={busy} className="btn btn-danger btn-sm">
                  {busy ? tr("deleting") : tr("del")}
                </button>
              </div>
            </div>
          )}

          {exp.note && <p className="mb-4 text-[12px] italic text-text-muted">{exp.note}</p>}

          {/* ── قبل / بعد لكلّ مقياس ──────────────────────────────── */}
          {exp.status === "RUNNING" ? (
            <p className="text-[12.5px] text-text-muted">
              {daysLeft > 0 ? tr("resultAfter", { n: daysLeft }) : tr("resultComputing")}
            </p>
          ) : !exp.metricResults ? (
            <p className="text-[12.5px] text-text-muted">{tr("notEnough")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {exp.trackedMetrics.map((k) => {
                const r = exp.metricResults![k];
                if (!r) return null;
                const def = EXPERIMENT_METRICS.find((m) => m.key === k);
                const pct = r.changePct;
                const good = pct === null ? null : def?.lowerIsBetter ? pct < 0 : pct > 0;
                const tone = good === null ? "var(--text-muted)" : good ? "var(--verified)" : "var(--critical)";
                return (
                  <div key={k} className="card-inset pad-sm">
                    <div className="mb-2 text-[11.5px] font-medium text-text-primary">
                      {(locale === "en" ? def?.labelEn : def?.labelAr) ?? k}
                    </div>
                    {/* الرقمان جنباً إلى جنب لا سهماً بينهما: المقارنةُ هي
                        الغرض، والعمودان يجعلانها تُقرأ بلا حساب. */}
                    <div className="flex items-end gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10.5px] uppercase tracking-wide text-text-faint">{tr("before")}</div>
                        <div className="font-mono text-[16px] tabular-nums text-text-muted">{r.before}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10.5px] uppercase tracking-wide text-text-faint">{tr("after")}</div>
                        <div className="font-mono text-[16px] font-semibold tabular-nums text-text-primary">{r.after}</div>
                      </div>
                      {pct !== null && (
                        <span className="flex shrink-0 items-center gap-0.5 pb-0.5 text-[12px] font-medium" style={{ color: tone }}>
                          {pct > 0 ? <TrendingUp size={12} /> : pct < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                          {Math.abs(pct)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function ManualExperimentModal({
  workspaceId, campaigns, onClose,
}: {
  workspaceId: string;
  campaigns: { id: string; name: string; platform: string }[];
  onClose: () => void;
}) {
  const tr = useT();
  const locale = useLocale();
  const router = useRouter();
  const [changeType, setChangeType] = useState("AD_COPY");
  const [campaignId, setCampaignId] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [windowDays, setWindowDays] = useState(7);
  const [metrics, setMetrics] = useState<string[]>(["cost", "conversions_verified", "cpl_verified"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!description.trim()) { setError(tr("errNoDesc")); return; }
    if (metrics.length === 0) { setError(tr("errNoMetric")); return; }
    setSaving(true);
    setError(null);
    const campaign = campaigns.find((c) => c.id === campaignId);
    const res = await fetch(`/api/workspaces/${workspaceId}/experiments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changeType, description: description.trim(), note: note.trim() || null,
        campaignId: campaignId || null, platform: campaign?.platform ?? null,
        trackedMetrics: metrics, windowDays,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? tr("errSave"));
      setSaving(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="pop-shadow flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="section-title">{tr("manualTitle")}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <label className="mb-1.5 block text-[12.5px] text-text-muted">{tr("changeType")}</label>
          <Select
            locale={locale}
            value={changeType}
            onChange={setChangeType}
            ariaLabel={tr("changeType")}
            className="mb-4"
            options={Object.entries(CHANGE_TYPE_KEYS)
              .filter(([k]) => k !== "AUTOMATION_RULE")
              .map(([k, key]) => ({ value: k, label: tr(key) }))}
          />

          <label className="mb-1.5 block text-[12.5px] text-text-muted">{tr("campaignOptional")}</label>
          <Select
            locale={locale}
            value={campaignId}
            onChange={setCampaignId}
            ariaLabel={tr("campaignOptional")}
            className="mb-4"
            options={[
              { value: "", label: tr("allCampaigns") },
              ...campaigns.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          <label className="mb-1.5 block text-[12.5px] text-text-muted">{tr("changeDesc")}</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)}
                 placeholder={tr("changeDescPlaceholder")}
                 className="field mb-4 w-full" />

          <label className="mb-1.5 block text-[12.5px] text-text-muted">{tr("noteOptional")}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                    className="field mb-4 w-full resize-none" />

          <OptionGroup
            className="mb-4"
            label={tr("windowLabel")}
            value={windowDays}
            onChange={setWindowDays}
            options={[3, 7, 14, 30].map((d) => ({ value: d, label: tr("daysN", { n: d }) }))}
          />

          <label className="mb-1.5 block text-[12.5px] text-text-muted">
            {tr("metricsCompared", { n: metrics.length })}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {EXPERIMENT_METRICS.map((m) => {
              const on = metrics.includes(m.key);
              return (
                <button key={m.key}
                        onClick={() => setMetrics((p) => on ? p.filter((x) => x !== m.key) : [...p, m.key])}
                        className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[12px] ${on ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-muted"}`}>
                  {on && <Check size={11} />}{locale === "en" ? m.labelEn : m.labelAr}
                </button>
              );
            })}
          </div>

          {error && <p className="mt-3 text-[12.5px] text-critical">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="btn btn-secondary">{tr("cancel")}</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? tr("saving") : tr("startMeasuring")}
          </button>
        </div>
      </div>
    </div>
  );
}
