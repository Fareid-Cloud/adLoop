// app/dashboard/reports/PrintButton.tsx

"use client";

import { Printer } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function PrintButton({ locale }: { locale: Locale }) {
  return (
    <button
      onClick={() => window.print()}
      className="btn btn-primary btn-sm no-print rounded-full"
    >
      <Printer size={14} />
      {t(locale, "ui.print")}
    </button>
  );
}
