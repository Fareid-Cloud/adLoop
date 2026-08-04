"use client";

// اختيار المنصة المراد ربطها في نافذة صغيرة بدل إرسال المستخدم إلى
// الإعدادات ليبحث عن الزر بنفسه. الربط نفسه يفتح صفحة المنصة (OAuth)
// وهو الوحيد الذي يجب أن يغادر التطبيق - وذلك بطبيعته لا يمكن تفاديه.

import { useState } from "react";
import { Plug, X } from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { t, type Locale } from "@/lib/i18n/dictionary";

const PLATFORMS = [
  { id: "GOOGLE_ADS", label: "Google Ads", start: "/api/oauth/google-ads/start", color: "#1A73E8" },
  { id: "META_ADS", label: "Meta Ads", start: "/api/oauth/meta/start", color: "#0866FF" },
  { id: "TIKTOK_ADS", label: "TikTok Ads", start: "/api/oauth/tiktok/start", color: "#FE2C55" },
];

export function ConnectPlatformLauncher({
  label, className, locale = "ar",
}: {
  label: string;
  className?: string;
  locale?: "ar" | "en";
}) {
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        <Plug size={13} /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
             onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
               className="pop-shadow w-full max-w-sm card pad-md">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="section-title">
                {ar ? t(locale, "ui.pickPlatformToConnect") : "Choose a platform"}
              </h3>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-text-muted hover:bg-surface-raised">
                <X size={16} />
              </button>
            </div>

            <p className="mb-4 text-[12.5px] leading-relaxed text-text-muted">
              {ar
                ? t(locale, "ui.pickPlatformHint")
                : "You'll approve on the platform's page, then come straight back to pick your campaigns."}
            </p>

            <div className="flex flex-col gap-2">
              {PLATFORMS.map((p) => (
                <a key={p.id} href={p.start}
                   className="flex items-center gap-3 card-inset pad-sm no-underline hover:border-accent">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{ background: `${p.color}1A` }}>
                    <PlatformLogo platform={p.id} size={19} />
                  </span>
                  <span className="text-[13.5px] font-medium text-text-primary">{p.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
