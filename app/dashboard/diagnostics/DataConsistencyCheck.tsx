// app/dashboard/diagnostics/DataConsistencyCheck.tsx

"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function DataConsistencyCheck({ workspaceId,
  locale = "ar",
}: { workspaceId: string
  locale?: Locale;
}) {
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
        <span className="text-sm text-text-primary">{t(locale, "consistency.title")}</span>
        <button
          onClick={runCheck}
          disabled={loading}
          className="btn btn-secondary btn-sm"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? t(locale, "consistency.checking") : t(locale, "consistency.check")}
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
              ? t(locale, "consistency.match", { pct: String(result.discrepancyPct) })
              : t(locale, "consistency.mismatch", {
                  pct: String(result.discrepancyPct),
                  ours: String(result.storedClicks),
                  theirs: String(result.liveClicks),
                })}
          </span>
        </div>
      )}
    </div>
  );
}
