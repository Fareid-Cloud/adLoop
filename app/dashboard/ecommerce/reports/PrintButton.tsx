"use client";

// زرّ الطباعة - مكوّن عميل صغير معزول عمداً، حتى تبقى صفحة التقرير كلها
// مكوّن خادم فلا تُشحن بياناتها إلى المتصفح.

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[12.5px] font-medium text-text-primary transition-colors hover:bg-surface-2"
    >
      <Printer size={14} />
      طباعة أو حفظ PDF
    </button>
  );
}
