"use client";

// بعد عودة المستخدم من ربط المنصة (?connection=success&platform=...) تُفتح
// نافذة اختيار الحملات تلقائياً في مكانه - دون إرساله إلى الإعدادات.
// هذا يزيل الخطوة المفقودة التي كانت توقف المستخدم بعد الربط مباشرة.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CampaignPickerModal } from "@/app/components/CampaignPickerModal";

type Platform = "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS";

const PARAM_TO_PLATFORM: Record<string, Platform> = {
  google_ads: "GOOGLE_ADS",
  meta: "META_ADS",
  meta_ads: "META_ADS",
  tiktok: "TIKTOK_ADS",
  tiktok_ads: "TIKTOK_ADS",
};

export function PostConnectCampaignPrompt({ workspaceId, locale = "ar" }: { workspaceId: string; locale?: "ar" | "en" }) {
  const params = useSearchParams();
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    if (params.get("connection") !== "success") return;
    const p = PARAM_TO_PLATFORM[params.get("platform") ?? ""];
    if (p) setPlatform(p);
  }, [params]);

  function close() {
    setPlatform(null);
    // ننظّف الرابط حتى لا تُفتح النافذة مجدداً عند التحديث
    router.replace("/dashboard");
  }

  if (!platform) return null;

  return (
    <CampaignPickerModal
      workspaceId={workspaceId}
      platform={platform}
      open
      onClose={close}
      onSaved={() => router.refresh()}
      locale={locale}
    />
  );
}
