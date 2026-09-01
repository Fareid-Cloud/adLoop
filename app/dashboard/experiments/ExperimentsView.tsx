"use client";

// عرض الاختبارات: تُنشأ تلقائياً عند تنفيذ أي قرار، وتُقاس نتيجتها بعد
// اكتمال النافذة. الإضافة اليدوية ميزة إضافية لتسجيل تغيير أجريته خارج
// المنتج (نص إعلان، صفحة هبوط، استهداف).

import {
  createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { Beaker, Plus, TrendingUp, TrendingDown, Minus, X, Check, Clock, Pencil, Trash2, AlertTriangle, ChevronDown } from "lucide-react";
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

function ExperimentsBody({
  workspaceId, experiments, campaigns,
}: {
  workspaceId: string;
  experiments: ExperimentRow[];
  campaigns: { id: string; name: string; platform: string }[];
}) {
  const tr = useT();
  const [adding, setAdding] = useState(false);
  const running = experiments.filter((e) => e.status === "RUNNING");
  const done = experiments.filter((e) => e.status !== "RUNNING");

  return (
    <div>
      {/* 🔴 **الإجراءُ الأساسيّ كان مدفوناً داخل بطاقة شرح.**
          «تجربة يدوية» هو الفعلُ الوحيد الذي يبدأ به المستخدم شيئاً في هذه
          الصفحة، وكان زرّاً ثانوياً في ركن كتلةٍ تعريفيّة تُقرأ مرّةً
          واحدة. صعد إلى صفٍّ خاصٍّ به فوق القائمة.

          والشرحُ نفسُه انطوى: نصٌّ ثابتٌ يشرح ما تفعله الصفحة يُقرأ مرّةً
          ثمّ يصير سقفاً يُزاح كلَّ زيارة. يبقى متاحاً لمن يريده. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <details className="min-w-0 flex-1 group">
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

      {experiments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Beaker size={26} className="mx-auto mb-3 text-text-faint" />
          <p className="text-[13.5px] text-text-primary">{tr("noneTitle")}</p>
          <p className="mt-1 text-[12.5px] text-text-muted">{tr("noneBody")}</p>
        </div>
      )}

      {running.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-text-muted">
            <Clock size={13} /> {tr("measuring", { n: running.length })}
          </h3>
          <div className="flex flex-col gap-2">
            {running.map((e) => <ExperimentCard key={e.id} exp={e} workspaceId={workspaceId} live />)}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13px] font-medium text-text-muted">{tr("results", { n: done.length })}</h3>
          <div className="flex flex-col gap-2">
            {done.map((e) => <ExperimentCard key={e.id} exp={e} workspaceId={workspaceId} />)}
          </div>
        </section>
      )}

      {adding && (
        <ManualExperimentModal workspaceId={workspaceId} campaigns={campaigns} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}

function ExperimentCard({
  exp, workspaceId, live,
}: {
  exp: ExperimentRow;
  workspaceId: string;
  /** ما زالت تُقاس - يُفرَّق بصرياً عمّا صدر حكمُه */
  live?: boolean;
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
    setBusy(false); setConfirmDelete(false); router.refresh();
  }

  const conf = CONFIDENCE_TONE[exp.confidenceLevel] ?? CONFIDENCE_TONE.INSUFFICIENT_DATA;
  const daysLeft = Math.max(
    0,
    exp.windowDays - Math.floor((Date.now() - new Date(exp.changedAt).getTime()) / 86400000)
  );

  return (
    // 🔴 **كلُّ التجارب كانت بطاقةً واحدةً مكرّرة**، فلا يُعرف من نظرةٍ
    // ما يُقاس الآن ممّا صدر حكمُه. حدٌّ جانبيٌّ بلون الحالة يفصلهما:
    // لونُ العلامة لما يجري، ولونُ الحكم لما انتهى.
    <div
      className="card pad-md border-s-2"
      style={{ borderInlineStartColor: live ? "var(--accent)" : conf.tone }}
    >
      <div className="mb-3 flex items-start gap-3">
        {/* الشعار كتلة مربّعة تُثبّت بداية الصفّ - كان أيقونة ١٥ بكسل
            سابحة بين النصوص لا تُميَّز بلمحة */}
        {exp.platform && (
          <span className="card flex h-10 w-10 shrink-0 items-center justify-center bg-surface-raised">
            <PlatformLogo platform={exp.platform} size={20} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold tracking-tight text-text-primary">
              {exp.description}
            </span>
            <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10.5px] text-text-muted">
              {CHANGE_TYPE_KEYS[exp.changeType] ? tr(CHANGE_TYPE_KEYS[exp.changeType]) : exp.changeType}
            </span>
            {exp.source === "MANUAL" && (
              <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10.5px] text-text-muted">
                {tr("manualTag")}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={() => setEditing((v) => !v)}
                  className="card-inset p-1.5 text-text-muted hover:text-text-primary"
                  aria-label={tr("editAria")}>
            <Pencil size={13} />
          </button>
          <button onClick={() => setConfirmDelete(true)}
                  className="card-inset p-1.5 text-text-muted hover:text-critical"
                  aria-label={tr("deleteAria")}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {editing && (
        <div className="mb-3 flex flex-col gap-2.5 card-inset pad-sm">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={tr("descPlaceholder")}
                 className="field" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("notePlaceholder")}
                 className="field" />
          {/* كان العنوان في صفّ الخيارات نفسه وأعرضتها تتبع أطوال نصوصها،
              فيبدو العنوان خياراً خامساً و«٣ أيام» أصغر شأناً من «٣٠ يوماً».
              القاعدة العامّة الآن في `OptionGroup`. */}
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

      {/* 🔴 نفس فخّ «`.btn` على `div`» المتكرّر: `.btn-danger` تفرض خلفيةً
          حمراء صريحة تهزم `bg-critical/[0.06]`، و`.btn` تفرض `nowrap` -
          فيصير صفّ التأكيد شريطاً أحمر ممتلئاً يبدو زرّاً واحداً ضخماً
          بينما فيه زرّان حقيقيّان بداخله. */}
      {confirmDelete && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-critical/35 bg-critical/[0.06] p-3">
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

      {exp.campaignName && <p className="mb-2 text-[12px] text-text-muted">{tr("campaign", { name: exp.campaignName })}</p>}
      {exp.note && <p className="mb-2 text-[12px] italic text-text-muted">{exp.note}</p>}

      {exp.status === "RUNNING" ? (
        <p className="text-[12.5px] text-text-muted">
          {daysLeft > 0 ? tr("resultAfter", { n: daysLeft }) : tr("resultComputing")} — {tr("windowN", { n: exp.windowDays })}
        </p>
      ) : exp.status === "INCONCLUSIVE" || !exp.metricResults ? (
        <p className="text-[12.5px] text-text-muted">{tr("notEnough")}</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-2">
            {exp.trackedMetrics.map((k) => {
              const r = exp.metricResults![k];
              if (!r) return null;
              const def = EXPERIMENT_METRICS.find((m) => m.key === k);
              const pct = r.changePct;
              const good = pct === null ? null : def?.lowerIsBetter ? pct < 0 : pct > 0;
              const tone = good === null ? "var(--text-muted)" : good ? "var(--verified)" : "var(--critical)";
              return (
                <div key={k} className="card-inset px-3 py-2">
                  <div className="text-[11px] text-text-muted">{(locale === "en" ? def?.labelEn : def?.labelAr) ?? k}</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono text-[13px] text-text-primary">{r.before} → {r.after}</span>
                    {pct !== null && (
                      <span className="flex items-center gap-0.5 text-[11.5px] font-medium" style={{ color: tone }}>
                        {pct > 0 ? <TrendingUp size={11} /> : pct < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                        {Math.abs(pct)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: `color-mix(in srgb, ${conf.tone} 14%, transparent)`, color: conf.tone }}>
            {tr(conf.key)}
          </span>
        </>
      )}
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
