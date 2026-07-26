"use client";

// اختيار نطاق اللوحة: كل المنصات أو منصة بعينها. عند اختيار منصة، تتغيّر
// كل أرقام الصفحة إليها، ويتلوّن الأكسنت بلون المنصة نفسها (Google أزرق،
// Meta أزرق، TikTok أحمر) عبر data-accent على غلاف الصفحة.

import { useRouter, useSearchParams } from "next/navigation";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { Layers } from "lucide-react";

const OPTIONS = [
  { value: "", labelAr: "كل المنصات", labelEn: "All platforms", color: null as string | null },
  { value: "GOOGLE_ADS", labelAr: "Google Ads", labelEn: "Google Ads", color: "#4285F4" },
  { value: "META_ADS", labelAr: "Meta Ads", labelEn: "Meta Ads", color: "#0866FF" },
  { value: "TIKTOK_ADS", labelAr: "TikTok Ads", labelEn: "TikTok Ads", color: "#FE2C55" },
];

const RANGES = [7, 30, 90];

export function PlatformSwitcher({ platform, days, locale }: { platform: string; days: number; locale: "ar" | "en" }) {
  const router = useRouter();
  const params = useSearchParams();
  const ar = locale === "ar";

  function go(next: { platform?: string; days?: number }) {
    const q = new URLSearchParams(params.toString());
    if (next.platform !== undefined) {
      next.platform ? q.set("platform", next.platform) : q.delete("platform");
    }
    if (next.days !== undefined) q.set("days", String(next.days));
    router.push(`/dashboard?${q.toString()}`);
  }

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map((o) => {
          const active = platform === o.value;
          return (
            <button
              key={o.value || "all"}
              onClick={() => go({ platform: o.value })}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors ${
                active ? "border-transparent text-white" : "border-border bg-surface text-text-muted hover:text-text-primary"
              }`}
              style={active ? { background: o.color ?? "var(--accent)" } : undefined}
            >
              {o.value ? <PlatformLogo platform={o.value} size={16} /> : <Layers size={15} />}
              {ar ? o.labelAr : o.labelEn}
            </button>
          );
        })}
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
        {RANGES.map((d) => (
          <button
            key={d}
            onClick={() => go({ days: d })}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] transition-colors ${
              days === d ? "bg-accent font-medium text-white" : "text-text-muted hover:text-text-primary"
            }`}
          >
            {ar ? `${d} يوم` : `${d}d`}
          </button>
        ))}
      </div>
    </div>
  );
}
