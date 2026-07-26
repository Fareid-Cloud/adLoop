"use client";

// عرض المعمل: التجارب تُنشأ تلقائياً عند تنفيذ أي قرار، وتُقاس نتيجتها بعد
// اكتمال النافذة. الإضافة اليدوية ميزة إضافية لتجربة تغيير أجريته خارج
// المنتج (نص إعلان، صفحة هبوط، استهداف).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Beaker, Plus, TrendingUp, TrendingDown, Minus, X, Check, Clock } from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { EXPERIMENT_METRICS } from "@/lib/experimentMetrics";

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

const CHANGE_TYPE_LABEL: Record<string, string> = {
  BUDGET: "ميزانية", AD_COPY: "نص إعلان", LANDING_PAGE: "صفحة هبوط",
  TARGETING: "استهداف", BID_STRATEGY: "استراتيجية مزايدة",
  PAUSE: "إيقاف", AUTOMATION_RULE: "قاعدة أتمتة", OTHER: "أخرى",
};

const CONFIDENCE: Record<string, { label: string; tone: string }> = {
  RELIABLE: { label: "نتيجة موثوقة", tone: "var(--verified)" },
  PRELIMINARY: { label: "مؤشر أولي", tone: "var(--gap)" },
  INSUFFICIENT_DATA: { label: "بيانات غير كافية", tone: "var(--text-muted)" },
};

export function ExperimentsView({
  workspaceId, experiments, campaigns,
}: {
  workspaceId: string;
  experiments: ExperimentRow[];
  campaigns: { id: string; name: string; platform: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const running = experiments.filter((e) => e.status === "RUNNING");
  const done = experiments.filter((e) => e.status !== "RUNNING");

  return (
    <div>
      <div className="card-shadow mb-5 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start gap-3">
          <Beaker size={18} className="mt-0.5 shrink-0 text-accent" />
          <div className="flex-1">
            <h2 className="mb-1 text-[14px] font-semibold text-text-primary">كيف يعمل المعمل</h2>
            <p className="text-[12.5px] leading-relaxed text-text-muted">
              كل قرار تنفّذه — بموافقتك أو عبر قاعدة أتمتة — يُسجَّل هنا تلقائياً.
              بعد اكتمال نافذة القياس نقارن أداء الفترة التالية للتغيير بالفترة
              السابقة له مباشرة، بنفس الطول وعلى نفس الحملة، ونعرض الفرق لكل مؤشر.
            </p>
          </div>
          <button onClick={() => setAdding(true)} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-text-primary">
            <Plus size={14} /> تجربة يدوية
          </button>
        </div>
      </div>

      {experiments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Beaker size={26} className="mx-auto mb-3 text-text-faint" />
          <p className="text-[13.5px] text-text-primary">لا توجد تجارب بعد</p>
          <p className="mt-1 text-[12.5px] text-text-muted">
            ستظهر أول تجربة تلقائياً بمجرد تنفيذ أول قرار من صفحة القرارات.
          </p>
        </div>
      )}

      {running.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-text-muted">
            <Clock size={13} /> قيد القياس ({running.length})
          </h3>
          <div className="flex flex-col gap-2">
            {running.map((e) => <ExperimentCard key={e.id} exp={e} />)}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13px] font-medium text-text-muted">نتائج ({done.length})</h3>
          <div className="flex flex-col gap-2">
            {done.map((e) => <ExperimentCard key={e.id} exp={e} />)}
          </div>
        </section>
      )}

      {adding && (
        <ManualExperimentModal workspaceId={workspaceId} campaigns={campaigns} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}

function ExperimentCard({ exp }: { exp: ExperimentRow }) {
  const conf = CONFIDENCE[exp.confidenceLevel] ?? CONFIDENCE.INSUFFICIENT_DATA;
  const daysLeft = Math.max(
    0,
    exp.windowDays - Math.floor((Date.now() - new Date(exp.changedAt).getTime()) / 86400000)
  );

  return (
    <div className="card-shadow rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {exp.platform && <PlatformLogo platform={exp.platform} size={15} />}
        <span className="text-[13.5px] font-medium text-text-primary">{exp.description}</span>
        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10.5px] text-text-muted">
          {CHANGE_TYPE_LABEL[exp.changeType] ?? exp.changeType}
        </span>
        {exp.source === "MANUAL" && (
          <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10.5px] text-text-muted">يدوية</span>
        )}
      </div>

      {exp.campaignName && <p className="mb-2 text-[12px] text-text-muted">الحملة: {exp.campaignName}</p>}
      {exp.note && <p className="mb-2 text-[12px] italic text-text-muted">{exp.note}</p>}

      {exp.status === "RUNNING" ? (
        <p className="text-[12.5px] text-text-muted">
          {daysLeft > 0 ? `النتيجة بعد ${daysLeft} يوم` : "النتيجة قيد الحساب"} — نافذة {exp.windowDays} أيام
        </p>
      ) : exp.status === "INCONCLUSIVE" || !exp.metricResults ? (
        <p className="text-[12.5px] text-text-muted">
          لا توجد بيانات كافية على أحد جانبي التغيير للحكم على الأثر.
        </p>
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
                <div key={k} className="rounded-xl border border-border bg-surface-raised px-3 py-2">
                  <div className="text-[11px] text-text-muted">{def?.labelAr ?? k}</div>
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
            {conf.label}
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
    if (!description.trim()) { setError("اكتب وصفاً للتغيير الذي أجريته."); return; }
    if (metrics.length === 0) { setError("اختر مؤشراً واحداً على الأقل للمقارنة."); return; }
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
      setError(d.error ?? "تعذّر حفظ التجربة.");
      setSaving(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="pop-shadow flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="text-[15px] font-semibold text-text-primary">تسجيل تجربة يدوية</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <label className="mb-1.5 block text-[12.5px] text-text-muted">نوع التغيير</label>
          <select value={changeType} onChange={(e) => setChangeType(e.target.value)}
                  className="mb-4 w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-accent">
            {Object.entries(CHANGE_TYPE_LABEL).filter(([k]) => k !== "AUTOMATION_RULE").map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <label className="mb-1.5 block text-[12.5px] text-text-muted">الحملة (اختياري — بدونها نقيس على مستوى مساحة العمل)</label>
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
                  className="mb-4 w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-accent">
            <option value="">كل الحملات</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <label className="mb-1.5 block text-[12.5px] text-text-muted">وصف التغيير</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)}
                 placeholder="مثال: تغيير العنوان الرئيسي في صفحة الهبوط"
                 className="mb-4 w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-[13.5px] text-text-primary outline-none placeholder:text-text-faint focus:border-accent" />

          <label className="mb-1.5 block text-[12.5px] text-text-muted">ملاحظة (اختياري)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                    className="mb-4 w-full resize-none rounded-xl border border-border bg-surface-raised px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-accent" />

          <label className="mb-1.5 block text-[12.5px] text-text-muted">نافذة القياس</label>
          <div className="mb-4 flex gap-2">
            {[3, 7, 14, 30].map((d) => (
              <button key={d} onClick={() => setWindowDays(d)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-[12.5px] ${windowDays === d ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-muted"}`}>
                {d} أيام
              </button>
            ))}
          </div>

          <label className="mb-1.5 block text-[12.5px] text-text-muted">
            المؤشرات المقارَنة ({metrics.length} مختار)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {EXPERIMENT_METRICS.map((m) => {
              const on = metrics.includes(m.key);
              return (
                <button key={m.key}
                        onClick={() => setMetrics((p) => on ? p.filter((x) => x !== m.key) : [...p, m.key])}
                        className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[12px] ${on ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-muted"}`}>
                  {on && <Check size={11} />}{m.labelAr}
                </button>
              );
            })}
          </div>

          {error && <p className="mt-3 text-[12.5px] text-critical">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="rounded-xl border border-border bg-surface-raised px-4 py-2 text-[13px] text-text-muted">إلغاء</button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-accent px-5 py-2 text-[13px] font-medium text-white disabled:opacity-50">
            {saving ? "جارٍ الحفظ..." : "بدء القياس"}
          </button>
        </div>
      </div>
    </div>
  );
}
