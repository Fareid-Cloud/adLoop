"use client";

// زر يفتح نافذة اختيار الحملات في مكانه - يُستخدم في قائمة الإعداد
// وصفحات المنصات، بدل تحويل المستخدم إلى الإعدادات.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CampaignPickerModal } from "@/app/components/CampaignPickerModal";
import { PlatformLogo } from "@/app/components/PlatformLogo";

type Platform = "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS";

export function CampaignPickerLauncher({
  workspaceId,
  connectedPlatforms,
  label,
  className,
  locale = "ar",
}: {
  workspaceId: string;
  connectedPlatforms: Platform[];
  label: string;
  className?: string;
  locale?: "ar" | "en";
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [picking, setPicking] = useState<Platform | null>(null);
  const [choosing, setChoosing] = useState(false);

  function start() {
    // منصة واحدة مربوطة؟ نفتحها مباشرة. أكثر من واحدة؟ نسأل أيّها.
    if (connectedPlatforms.length === 1) setPicking(connectedPlatforms[0]);
    else setChoosing(true);
  }

  return (
    <>
      <button onClick={start} className={className}>{label}</button>

      {choosing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setChoosing(false)}>
          <div onClick={(e) => e.stopPropagation()} className="pop-shadow w-full max-w-xs rounded-2xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-[14px] font-semibold text-text-primary">
              {ar ? "اختر المنصة" : "Choose a platform"}
            </h3>
            <div className="flex flex-col gap-2">
              {connectedPlatforms.map((p) => (
                <button
                  key={p}
                  onClick={() => { setChoosing(false); setPicking(p); }}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-raised p-3 text-[13px] text-text-primary hover:border-accent"
                >
                  <PlatformLogo platform={p} size={18} />
                  {p === "GOOGLE_ADS" ? "Google Ads" : p === "META_ADS" ? "Meta Ads" : "TikTok Ads"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {picking && (
        <CampaignPickerModal
          workspaceId={workspaceId}
          platform={picking}
          open
          onClose={() => setPicking(null)}
          onSaved={() => router.refresh()}
          locale={locale}
        />
      )}
    </>
  );
}
