// app/dashboard/diagnostics/DataConsistencyCheck.tsx

"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export function DataConsistencyCheck({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    matches: boolean; storedClicks: number; liveClicks: number; discrepancyPct: number;
  } | null>(null);

  async function runCheck() {
    setLoading(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/data-consistency-check`);
    if (res.ok) setResult(await res.json());
    setLoading(false);
  }

  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-text-primary">تطابق البيانات مع جوجل</span>
        <button
          onClick={runCheck}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 text-xs text-text-muted disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "جارٍ الفحص..." : "افحص الآن"}
        </button>
      </div>

      {result && (
        <div className="flex items-center gap-2 text-xs">
          {result.matches ? (
            <CheckCircle2 size={14} className="text-verified" />
          ) : (
            <AlertCircle size={14} className="text-critical" />
          )}
          <span className={result.matches ? "text-text-muted" : "text-critical"}>
            {result.matches
              ? `متطابقة (فرق ${result.discrepancyPct}% ضمن الهامش الطبيعي)`
              : `فرق ${result.discrepancyPct}% — عندنا ${result.storedClicks} كليكة، جوجل بتقول ${result.liveClicks}`}
          </span>
        </div>
      )}
    </div>
  );
}
