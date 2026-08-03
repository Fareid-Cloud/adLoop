// app/dashboard/reports/ReportActions.tsx

"use client";

import { useState } from "react";
import { Link2, Download } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function ReportActions({ workspaceId, locale = "ar" }: { workspaceId: string; locale?: Locale }) {
  const [copied, setCopied] = useState(false);

  async function handleShareLink() {
    const res = await fetch(`/api/workspaces/${workspaceId}/share-link`);
    if (res.ok) {
      const { url } = await res.json();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="no-print flex gap-2">
      <button
        onClick={handleShareLink}
        className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-1.5 text-xs text-text-muted hover:text-text-primary"
      >
        <Link2 size={14} />
        {copied ? t(locale, "ui.copied") : t(locale, "ui.shareLink")}
      </button>
      <a
        href={`/api/workspaces/${workspaceId}/export-csv`}
        className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-1.5 text-xs text-text-muted no-underline hover:text-text-primary"
      >
        <Download size={14} />
        {t(locale, "ui.export")} CSV
      </a>
    </div>
  );
}
