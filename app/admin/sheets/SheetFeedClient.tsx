"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Check, Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import { SHEET_DATASETS, DATASET_LABEL, type SheetDataset } from "@/lib/sheetFeed";

export function SheetFeedClient({ origin }: { origin: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [dataset, setDataset] = useState<SheetDataset>("sales");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formula, setFormula] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    if (!label.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ label: label.trim(), dataset }),
    }).catch(() => null);
    setBusy(false);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setError(data?.error ?? "Could not create the link.");
      return;
    }
    // الصيغة كاملةً لا الرابط وحده: اللصقُ المباشر في خليّة هو كلُّ ما
    // يلزم، فلا خطوةَ يخطئ فيها أحد بين نسخِ رابطٍ وكتابةِ دالّة.
    setFormula(`=IMPORTDATA("${origin}/api/sheets/${data.token}")`);
    setLabel("");
    router.refresh();
  }

  return (
    <div className="card pad-lg">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="feed-label" className="mb-1 block text-[11.5px] text-text-muted">Name</label>
          <input
            id="feed-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Sales pipeline sheet"
            className="field field-sm h-8 w-full"
          />
        </div>
        <div>
          <label htmlFor="feed-dataset" className="mb-1 block text-[11.5px] text-text-muted">Data</label>
          <select
            id="feed-dataset"
            value={dataset}
            onChange={(e) => setDataset(e.target.value as SheetDataset)}
            className="field field-sm h-8"
          >
            {SHEET_DATASETS.map((d) => (
              <option key={d} value={d}>{DATASET_LABEL[d]}</option>
            ))}
          </select>
        </div>
        <button onClick={create} disabled={busy || !label.trim()} className="btn btn-primary btn-sm h-8 px-3">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          <span className="ms-1.5">Create link</span>
        </button>
      </div>

      {error && <p role="alert" className="mt-2 text-[12px] text-critical">{error}</p>}

      {formula && (
        <div className="mt-3 rounded-xl border border-verified/30 bg-verified/8 p-3">
          <p className="m-0 text-[12.5px] font-medium text-text-primary">
            Paste this into any cell in your sheet:
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-surface px-2 py-1.5 text-[11px] text-text-muted">
              {formula}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(formula);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="btn-icon btn-sm shrink-0"
              aria-label="Copy"
            >
              {copied ? <Check size={14} className="text-verified" /> : <Copy size={14} />}
            </button>
          </div>
          {/* 🔴 التحذيرُ جنبَ الرابط لا في صفحةِ مساعدة: الرابطُ هو كلمةُ
              السرّ، والوقتُ الذي يُقرأ فيه هذا هو الوقتُ الذي يُنسَخ فيه. */}
          <p className="m-0 mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-gap">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Anyone with this link can read the data — it carries its own permission, because
            Sheets cannot send a header. It is shown once. Keep the sheet private, and revoke
            the link here if it ever leaves your hands.
          </p>
        </div>
      )}
    </div>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg p-1.5 text-text-faint transition-colors hover:text-critical"
        aria-label="Revoke"
      >
        <Trash2 size={14} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => setConfirming(false)} className="btn btn-sm">Cancel</button>
      <button
        onClick={async () => {
          setBusy(true);
          await fetch("/api/admin/sheets", {
            method: "DELETE",
            headers: { "Content-Type": "application/json", ...getCsrfHeader() },
            body: JSON.stringify({ id }),
          }).catch(() => {});
          setBusy(false);
          router.refresh();
        }}
        disabled={busy}
        className="btn btn-danger btn-sm"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : "Revoke"}
      </button>
    </div>
  );
}
