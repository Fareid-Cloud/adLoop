// app/dashboard/reports/PrintButton.tsx

"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs text-white"
    >
      <Printer size={14} />
      طباعة / حفظ PDF
    </button>
  );
}
