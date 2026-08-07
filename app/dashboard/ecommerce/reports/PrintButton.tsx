"use client";

// زرّ الطباعة - مكوّن عميل صغير معزول عمداً، حتى تبقى صفحة التقرير كلها
// مكوّن خادم فلا تُشحن بياناتها إلى المتصفح.

import { Printer } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function PrintButton({ label, locale }: { label?: string; locale: Locale }) {
  const text = label ?? t(locale, "ui.print");
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 card px-3.5 py-2 text-[12.5px] font-medium text-text-primary transition-colors hover:bg-surface-raised"
    >
      <Printer size={14} />
      {text}
    </button>
  );
}
