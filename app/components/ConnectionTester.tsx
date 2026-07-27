"use client";

// فحص اتصال المنصة خطوة بخطوة. الغرض واحد: تحويل "لا توجد حملات" - وهي
// رسالة لا تُفيد بشيء - إلى تحديد دقيق لأين توقّف المسار، لأن كل سبب له
// حلٌّ مختلف تماماً (إعادة ربط، صلاحية ناقصة، حساب بلا حملات، إعداد ناقص
// من جهتنا).

import { useState } from "react";
import { Check, AlertCircle, Loader2, Stethoscope } from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";

interface Step { key: string; labelAr: string; ok: boolean | null; detailAr?: string }

export function ConnectionTester({
  platform, compact = false,
}: {
  platform: "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS";
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ steps: Step[]; verdictAr: string } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/oauth/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    }).catch(() => null);
    setBusy(false);
    if (!res) { setResult({ steps: [], verdictAr: "تعذّر الاتصال بالخادم." }); return; }
    const data = await res.json().catch(() => null);
    if (data) setResult({ steps: data.steps ?? [], verdictAr: data.verdictAr ?? data.error ?? "" });
  }

  const allOk = result?.steps.every((s) => s.ok !== false) ?? false;

  return (
    <div className={compact ? "" : "rounded-xl border border-border bg-surface-raised p-3"}>
      <button
        onClick={run}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] text-text-primary disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Stethoscope size={13} />}
        {busy ? "جارٍ الفحص..." : "فحص الاتصال"}
      </button>

      {result && (
        <div className="mt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium"
             style={{ color: allOk ? "var(--verified)" : "var(--critical)" }}>
            <PlatformLogo platform={platform} size={13} />
            {result.verdictAr}
          </p>
          <ul className="flex flex-col gap-1.5">
            {result.steps.map((s) => (
              <li key={s.key} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  {s.ok === true ? <Check size={12} className="text-verified" />
                    : s.ok === false ? <AlertCircle size={12} className="text-critical" />
                    : <span className="block h-3 w-3 rounded-full border border-border" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] text-text-primary">{s.labelAr}</span>
                  {s.detailAr && (
                    <span className="block text-[11px] leading-relaxed text-text-muted">{s.detailAr}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
