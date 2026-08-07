// app/dashboard/reports/ReportActions.tsx

"use client";

import { useState } from "react";
import { Link2, Download } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function ReportActions({ workspaceId, locale }: { workspaceId: string; locale: Locale }) {
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
        className="btn btn-ghost btn-sm"
      >
        <Link2 size={14} />
        {copied ? t(locale, "ui.copied") : t(locale, "ui.shareLink")}
      </button>
      <a
        href={`/api/workspaces/${workspaceId}/export-csv`}
        className="btn btn-ghost btn-sm"
      >
        <Download size={14} />
        {t(locale, "ui.export")} CSV
      </a>
    </div>
  );
}
