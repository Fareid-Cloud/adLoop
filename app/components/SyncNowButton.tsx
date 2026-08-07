"use client";

// زر المزامنة الفورية: يعمل في مكانه ويعرض النتيجة الحقيقية - نجاح، أو
// نجاح بلا بيانات بعد، أو فشل برسالته. الخطوة كانت تُحيل إلى الإعدادات
// حيث لا يوجد زر مزامنة إطلاقاً، فيعلق المستخدم بلا وسيلة للمتابعة.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { t, type Locale } from "@/lib/i18n/dictionary";

interface Outcome { platform: string; ok: boolean; error?: string }

export function SyncNowButton({
  workspaceId, label, className, locale,
}: {
  workspaceId: string;
  label: string;
  className?: string;
  locale: Locale;
}) {
  const tr = (k: string) => t(locale, `setup.${k}`);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [results, setResults] = useState<Outcome[]>([]);
  const [failed, setFailed] = useState(false);

  async function run() {
    setBusy(true);
    setSummary(null);
    setResults([]);
    setFailed(false);

    const res = await fetch(`/api/workspaces/${workspaceId}/sync`, { method: "POST" }).catch(() => null);
    setBusy(false);

    if (!res) { setFailed(true); setSummary(tr("syncNoServer")); return; }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setFailed(true); setSummary(data.error ?? tr("syncFailed")); return; }

    setSummary((locale === "en" ? data.summaryEn : data.summaryAr) ?? data.summaryAr ?? null);
    setResults(data.results ?? []);
    setFailed(!data.ok);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      <button onClick={run} disabled={busy} className={className}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        {busy ? tr("syncing") : label}
      </button>

      {summary && (
        <div
          className="rounded-xl border p-2.5"
          style={{
            borderColor: failed ? "color-mix(in srgb, var(--critical) 35%, transparent)" : "color-mix(in srgb, var(--verified) 35%, transparent)",
            background: failed ? "color-mix(in srgb, var(--critical) 6%, transparent)" : "color-mix(in srgb, var(--verified) 6%, transparent)",
          }}
        >
          <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-text-primary">
            {failed ? <AlertTriangle size={13} className="mt-0.5 shrink-0 text-critical" />
                    : <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-verified" />}
            {summary}
          </p>

          {/* نتيجة كل منصة على حدة - فشل واحدة لا يعني فشل الكل */}
          {results.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {results.map((r) => (
                <div key={r.platform} className="flex items-start gap-1.5 text-[11.5px]">
                  <PlatformLogo platform={r.platform} size={12} />
                  <span style={{ color: r.ok ? "var(--verified)" : "var(--critical)" }}>
                    {r.ok ? tr("syncOk") : r.error ?? tr("syncRowFailed")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
