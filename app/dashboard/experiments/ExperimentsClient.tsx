// app/dashboard/experiments/ExperimentsClient.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export interface ExperimentRow {
  id: string;
  changeType: string;
  description: string;
  changedAt: string;
  confidenceLevel: "INSUFFICIENT_DATA" | "PRELIMINARY" | "RELIABLE";
  headline: string;
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  BUDGET: "ميزانية",
  AD_COPY: "نص إعلان",
  LANDING_PAGE: "صفحة هبوط",
  TARGETING: "استهداف",
  BID_STRATEGY: "استراتيجية مزايدة",
  OTHER: "أخرى",
};

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  INSUFFICIENT_DATA: { label: "بيانات غير كافية", color: "text-text-faint" },
  PRELIMINARY: { label: "مؤشر أولي", color: "text-gap" },
  RELIABLE: { label: "نتيجة موثوقة", color: "text-verified" },
};

export function ExperimentsClient({
  workspaceId,
  experiments,
}: {
  workspaceId: string;
  experiments: ExperimentRow[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ changeType: "BUDGET", description: "", measuredMetric: "cpl_verified" });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/workspaces/${workspaceId}/experiments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowForm(false);
    setForm({ changeType: "BUDGET", description: "", measuredMetric: "cpl_verified" });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs text-white"
        >
          <Plus size={14} />
          سجّل تعديل جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 rounded-2xl bg-surface p-5">
          <select
            value={form.changeType}
            onChange={(e) => setForm({ ...form, changeType: e.target.value })}
            className="mb-2 w-full rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
          >
            {Object.entries(CHANGE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input
            placeholder="وصف التعديل (مثلاً: زيادة ميزانية كامبين X من 500 لـ 650)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            className="mb-2 w-full rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
          />
          <select
            value={form.measuredMetric}
            onChange={(e) => setForm({ ...form, measuredMetric: e.target.value })}
            className="mb-3 w-full rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
          >
            <option value="cpl_verified">تكلفة العميل الحقيقية</option>
            <option value="cpl_raw">تكلفة العميل المعلنة</option>
            <option value="verified_conversions">عدد التحويلات الحقيقية</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-accent px-4 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </form>
      )}

      {experiments.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface px-8 py-12 text-center text-text-muted">
          لسه معملتش أي تجربة - سجّل أول تعديل تعمله عشان نبدأ نقيس أثره
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {experiments.map((exp) => {
            const conf = CONFIDENCE_LABELS[exp.confidenceLevel];
            return (
              <div key={exp.id} className="rounded-2xl bg-surface p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] text-text-muted">
                    {CHANGE_TYPE_LABELS[exp.changeType]}
                  </span>
                  <span className="text-xs text-text-faint">
                    {new Date(exp.changedAt).toLocaleDateString("ar")}
                  </span>
                </div>
                <div className="text-sm text-text-primary">{exp.description}</div>
                <div className={`mt-2 text-xs ${conf.color}`}>{exp.headline}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
