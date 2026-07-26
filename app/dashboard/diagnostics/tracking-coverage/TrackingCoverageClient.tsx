// app/dashboard/diagnostics/tracking-coverage/TrackingCoverageClient.tsx

"use client";

// تغطية التتبع: الصفحات المُضافة هنا تُفحص تلقائياً وتؤثر على درجة
// التشخيص، لذلك يجب أن يكون ذلك مذكوراً صراحةً، وأن تتوفّر إمكانية
// الحذف - رابط أُضيف بالخطأ (أو يخص منافساً) كان سيبقى يخفض الدرجة
// إلى الأبد بلا وسيلة لإزالته.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, CheckCircle2, XCircle, RefreshCw, Trash2, Info,
  AlertTriangle, Loader2, ShieldCheck,
} from "lucide-react";

export interface PageRow {
  id: string;
  url: string;
  label: string | null;
  trackingDetected: boolean | null;
  adloopDetected: boolean | null;
  detectedSystems: string[];
  lastCheckedAt: string | null;
  lastError: string | null;
}

const SYSTEM_LABEL: Record<string, string> = {
  adloop: "AdLoop", gtm: "Tag Manager", gtag: "Google gtag", ga4: "Analytics 4",
  meta_pixel: "بيكسل ميتا", tiktok_pixel: "بيكسل تيك توك", snap_pixel: "بيكسل سناب",
  x_pixel: "بيكسل X", linkedin: "LinkedIn", hotjar: "Hotjar", clarity: "Clarity",
};

export function TrackingCoverageClient({ workspaceId, pages }: { workspaceId: string; pages: PageRow[] }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    setError(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/monitored-pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim(), label: label.trim() }),
    }).catch(() => null);
    setAdding(false);
    if (!res || !res.ok) {
      const d = res ? await res.json().catch(() => ({})) : {};
      setError((d as any).error ?? "تعذّر إضافة الصفحة.");
      return;
    }
    setUrl(""); setLabel("");
    router.refresh();
  }

  async function recheck(id: string) {
    setBusyId(id);
    await fetch(`/api/monitored-pages/${id}/check`, { method: "POST" }).catch(() => {});
    setBusyId(null);
    router.refresh();
  }

  async function recheckAll() {
    setBusyId("all");
    await fetch("/api/diagnostics/scan", { method: "POST" }).catch(() => {});
    setBusyId(null);
    router.refresh();
  }

  async function remove(id: string) {
    setBusyId(id);
    await fetch(`/api/monitored-pages/${id}`, { method: "DELETE" }).catch(() => {});
    setBusyId(null);
    setConfirmDelete(null);
    router.refresh();
  }

  return (
    <div>
      {/* توضيح أثر الإضافة - كان غائباً تماماً */}
      <div className="card-shadow mb-4 flex items-start gap-2.5 rounded-2xl border border-border bg-surface p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-accent" />
        <p className="text-[12.5px] leading-relaxed text-text-muted">
          الصفحات المُضافة هنا نعتبرها <span className="font-medium text-text-primary">صفحاتك أنت</span>،
          ونفحصها تلقائياً في كل دورة فحص. نتيجتها تؤثر مباشرةً على درجة صحة الحساب في صفحة التشخيص —
          فلا تُضف روابط لا تملكها أو تخصّ منافسين. يمكنك حذف أي صفحة في أي وقت.
        </p>
      </div>

      <form onSubmit={handleAdd} className="card-shadow mb-4 rounded-2xl border border-border bg-surface p-5">
        <div className="mb-3 grid gap-2.5 sm:grid-cols-[2fr_1fr]">
          <input
            value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="رابط الصفحة (example.com أو https://example.com)"
            className="rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-[13.5px] text-text-primary outline-none placeholder:text-text-faint focus:border-accent"
          />
          <input
            value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="اسم مختصر (اختياري)"
            className="rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-[13.5px] text-text-primary outline-none placeholder:text-text-faint focus:border-accent"
          />
        </div>
        {error && <p className="mb-2 text-[12.5px] text-critical">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="submit" disabled={adding || !url.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-white disabled:opacity-45">
            <Plus size={14} /> {adding ? "جارٍ الإضافة..." : "إضافة صفحة"}
          </button>

          {pages.length > 0 && (
            <button type="button" onClick={recheckAll} disabled={busyId === "all"}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-4 py-2 text-[13px] text-text-primary disabled:opacity-50">
              {busyId === "all" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {busyId === "all" ? "جارٍ فحص كل الصفحات..." : "فحص كل الصفحات الآن"}
            </button>
          )}
        </div>
      </form>

      {pages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <ShieldCheck size={26} className="mx-auto mb-3 text-text-faint" />
          <p className="text-[13.5px] text-text-primary">لم تُضف أي صفحة للمراقبة بعد</p>
          <p className="mt-1 text-[12.5px] text-text-muted">
            أضف صفحات الهبوط التي تستقبل زياراتك الإعلانية لنتحقّق من وسوم التتبع عليها.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {pages.map((p) => {
            const complete = p.adloopDetected === true;
            const partial = p.trackingDetected === true && !complete;
            const tone = p.lastError ? "var(--text-muted)"
              : complete ? "var(--verified)"
              : partial ? "var(--gap)" : "var(--critical)";

            return (
              <div key={p.id} className="card-shadow rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      {p.lastError ? <AlertTriangle size={15} style={{ color: tone }} />
                        : complete ? <CheckCircle2 size={15} style={{ color: tone }} />
                        : <XCircle size={15} style={{ color: tone }} />}
                      <span className="text-[13.5px] font-medium text-text-primary">{p.label || p.url}</span>
                    </div>
                    {p.label && <p className="mb-1 truncate text-[11.5px] text-text-faint">{p.url}</p>}

                    <p className="text-[12.5px] leading-relaxed" style={{ color: tone }}>
                      {p.lastError ? p.lastError
                        : complete ? "التتبع مكتمل — وسم AdLoop موجود."
                        : partial ? "التتبع يعمل، لكن وسم AdLoop غير موجود — بدونه لا نربط النقرة بالمحادثة."
                        : p.trackingDetected === false ? "لم يُعثر على أي وسم تتبع في مصدر الصفحة."
                        : "لم تُفحص بعد."}
                    </p>

                    {p.detectedSystems?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.detectedSystems.map((sys) => (
                          <span key={sys}
                                className={`rounded-full px-2 py-0.5 text-[10.5px] ${
                                  sys === "adloop" ? "bg-verified/12 text-verified" : "bg-surface-raised text-text-muted"
                                }`}>
                            {SYSTEM_LABEL[sys] ?? sys}
                          </span>
                        ))}
                      </div>
                    )}

                    {p.lastCheckedAt && (
                      <p className="mt-2 text-[11px] text-text-faint">آخر فحص: {p.lastCheckedAt}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => recheck(p.id)} disabled={busyId === p.id}
                            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3 py-2 text-[12px] text-text-primary disabled:opacity-50">
                      {busyId === p.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      {busyId === p.id ? "جارٍ الفحص" : "فحص"}
                    </button>
                    <button onClick={() => setConfirmDelete(p.id)}
                            className="rounded-xl border border-border bg-surface-raised p-2 text-text-muted hover:text-critical"
                            aria-label="حذف الصفحة">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {confirmDelete === p.id && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-critical/35 bg-critical/[0.06] p-3">
                    <span className="text-[12.5px] text-text-primary">
                      إزالة هذه الصفحة من المراقبة؟ لن تُفحص بعدها ولن تؤثر على درجة التشخيص.
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmDelete(null)}
                              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] text-text-muted">
                        إلغاء
                      </button>
                      <button onClick={() => remove(p.id)} disabled={busyId === p.id}
                              className="rounded-lg bg-critical px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">
                        حذف
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
