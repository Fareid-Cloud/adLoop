// app/dashboard/diagnostics/tracking-coverage/TrackingCoverageClient.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

export interface PageRow {
  id: string;
  url: string;
  label: string | null;
  trackingDetected: boolean | null;
  lastCheckedAt: string | null;
  lastError: string | null;
}

export function TrackingCoverageClient({ workspaceId, pages }: { workspaceId: string; pages: PageRow[] }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    await fetch(`/api/workspaces/${workspaceId}/monitored-pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, label }),
    });
    setAdding(false);
    setUrl("");
    setLabel("");
    router.refresh();
  }

  async function handleRecheck(id: string) {
    setCheckingId(id);
    await fetch(`/api/monitored-pages/${id}/check`, { method: "POST" });
    setCheckingId(null);
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="mb-4 rounded-2xl bg-surface p-5">
        <input
          placeholder="رابط الصفحة (https://...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="mb-2 w-full rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
        />
        <input
          placeholder="اسم الصفحة (اختياري)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mb-2 w-full rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
        />
        <button
          type="submit"
          disabled={adding}
          className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs text-white disabled:opacity-50"
        >
          <Plus size={14} />
          {adding ? "جارٍ الفحص..." : "أضف وافحص"}
        </button>
      </form>

      {pages.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface px-8 py-12 text-center text-text-muted">
          لا توجد صفحات مُراقَبة بعد
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pages.map((page) => (
            <div key={page.id} className="flex items-center justify-between rounded-2xl bg-surface p-4">
              <div className="flex items-center gap-3">
                {page.trackingDetected ? (
                  <CheckCircle2 size={18} className="text-verified" />
                ) : (
                  <XCircle size={18} className="text-critical" />
                )}
                <div>
                  <div className="text-sm text-text-primary">{page.label || page.url}</div>
                  <div className="text-xs text-text-faint">
                    {page.trackingDetected
                      ? "التتبع موجود"
                      : page.lastError
                      ? `فشل الفحص: ${page.lastError}`
                      : "التتبع غير موجود على الصفحة دي"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRecheck(page.id)}
                disabled={checkingId === page.id}
                className="text-text-faint hover:text-text-primary"
              >
                <RefreshCw size={15} className={checkingId === page.id ? "animate-spin" : ""} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
