"use client";

// تدفّق الإعداد الأول: خطوتان حقيقيتان (ربط منصة ← اختيار حملات) لا تكتمل
// أيّ منهما إلا بالإنجاز الفعلي. لا قائمة جانبية ولا بقية البرنامج قبلها،
// لأن اللوحة بلا بيانات لا تعني شيئاً للمستخدم الجديد.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowLeft, Loader2 } from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { CampaignPickerModal } from "@/app/components/CampaignPickerModal";
import { SyncNowButton } from "@/app/components/SyncNowButton";

type Platform = "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS";

const PLATFORMS: { id: Platform; label: string; start: string; color: string }[] = [
  { id: "GOOGLE_ADS", label: "Google Ads", start: "/api/oauth/google-ads/start", color: "#4285F4" },
  { id: "META_ADS", label: "Meta Ads", start: "/api/oauth/meta/start", color: "#0866FF" },
  { id: "TIKTOK_ADS", label: "TikTok Ads", start: "/api/oauth/tiktok/start", color: "#FE2C55" },
];

const COPY = {
  ar: {
    brand: "AdLoop",
    stepOf: (a: number, b: number) => `الخطوة ${a} من ${b}`,
    t1: "اربط حسابك الإعلاني",
    d1: "نسحب بياناتك تلقائياً من المنصة مباشرة. يمكنك ربط أكثر من منصة، وتغيير ذلك لاحقاً في أي وقت.",
    t2: "اختر الحملات التي تتابعها",
    d2: "نتابع ما تختاره فقط — لوحة أوضح وتنبيهات أدق.",
    connected: "مرتبط",
    connect: "ربط",
    pick: "اختيار الحملات",
    skip: "تخطٍّ الآن",
    skipping: "جارٍ التخطي...",
    linked: (n: number) => `${n} حملة مرتبطة`,
    finish: "الدخول إلى اللوحة",
    note: "يمكنك التخطي والعودة لاحقاً، لكن اللوحة ستبقى فارغة حتى تربط حساباً.",
  },
  en: {
    brand: "AdLoop",
    stepOf: (a: number, b: number) => `Step ${a} of ${b}`,
    t1: "Connect your ad account",
    d1: "We pull your data straight from the platform. Connect more than one, and change it anytime later.",
    t2: "Choose campaigns to track",
    d2: "We track only what you pick — a cleaner dashboard and sharper alerts.",
    connected: "Connected",
    connect: "Connect",
    pick: "Choose campaigns",
    skip: "Skip for now",
    skipping: "Skipping...",
    linked: (n: number) => `${n} campaigns linked`,
    finish: "Go to dashboard",
    note: "You can skip and come back later, but the dashboard stays empty until an account is connected.",
  },
};

export function OnboardingFlow({
  workspaceId,
  connectStates,
  campaignCount,
  locale,
}: {
  workspaceId: string;
  connectStates: { platform: string; connected: boolean; campaignCount: number }[];
  campaignCount: number;
  locale: "ar" | "en";
}) {
  const router = useRouter();
  const c = COPY[locale];
  const ar = locale === "ar";
  const [picking, setPicking] = useState<Platform | null>(null);
  const [skipping, setSkipping] = useState(false);

  const connected = connectStates.filter((s) => s.connected);
  const step1Done = connected.length > 0;
  const step2Done = campaignCount > 0;

  async function skip() {
    setSkipping(true);
    await fetch("/api/user/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    }).catch(() => {});
    router.push("/dashboard");
  }

  return (
    <div dir={ar ? "rtl" : "ltr"} data-accent="blue" data-mode="light" className="min-h-screen bg-bg font-display">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
        <div className="mb-8">
          <div className="mb-6 text-[17px] font-bold tracking-tight text-text-primary">{c.brand}</div>
          <div className="mb-1.5 text-[12px] font-medium text-accent">
            {c.stepOf(step1Done ? 2 : 1, 2)}
          </div>
          <h1 className="mb-2 text-[26px] font-bold tracking-tight text-text-primary">
            {step1Done ? c.t2 : c.t1}
          </h1>
          <p className="text-[14px] leading-relaxed text-text-muted">{step1Done ? c.d2 : c.d1}</p>
        </div>

        {/* الخطوة 1 - ربط المنصات */}
        <div className="mb-3 flex flex-col gap-2.5">
          {PLATFORMS.map((p) => {
            const state = connectStates.find((s) => s.platform === p.id);
            const on = state?.connected ?? false;
            return (
              <a
                key={p.id}
                href={on ? undefined : p.start}
                className={`card-shadow flex items-center gap-3 rounded-2xl border p-4 no-underline transition-colors ${
                  on ? "border-verified/40 bg-verified/[0.06]" : "border-border bg-surface hover:border-border-visible"
                }`}
                style={on ? undefined : { cursor: "pointer" }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${p.color}1A` }}>
                  <PlatformLogo platform={p.id} size={20} />
                </span>
                <span className="flex-1 text-[14px] font-medium text-text-primary">{p.label}</span>
                {on ? (
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-verified">
                    <Check size={14} /> {c.connected}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-xl bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-white">
                    {c.connect}
                  </span>
                )}
              </a>
            );
          })}
        </div>

        {/* الخطوة 2 - اختيار الحملات (تظهر فقط بعد ربط منصة) */}
        {step1Done && (
          <div className="card-shadow mb-3 rounded-2xl border border-border bg-surface p-4">
            {step2Done ? (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[13.5px] font-medium text-verified">
                  <Check size={15} /> {c.linked(campaignCount)}
                </span>
                <button
                  onClick={() => setPicking(connected[0].platform as Platform)}
                  className="text-[12.5px] text-text-muted underline-offset-2 hover:underline"
                >
                  {c.pick}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[13.5px] text-text-muted">{c.t2}</span>
                <div className="flex flex-wrap gap-2">
                  {connected.map((s) => (
                    <button
                      key={s.platform}
                      onClick={() => setPicking(s.platform as Platform)}
                      className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white"
                    >
                      <PlatformLogo platform={s.platform} size={15} />
                      {c.pick}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* الخطوة 3 - مزامنة فورية، في مكانها لا في الإعدادات */}
        {step1Done && step2Done && (
          <div className="card-shadow mb-3 rounded-2xl border border-border bg-surface p-4">
            <div className="mb-2 text-[13.5px] text-text-primary">
              {ar ? "اسحب بياناتك الآن" : "Pull your data now"}
            </div>
            <p className="mb-3 text-[12.5px] leading-relaxed text-text-muted">
              {ar
                ? "المزامنة تعمل تلقائياً كل يوم. يمكنك تشغيلها الآن لترى أرقامك مباشرةً."
                : "Sync runs automatically every day. Run it now to see your numbers right away."}
            </p>
            <SyncNowButton
              workspaceId={workspaceId}
              label={ar ? "مزامنة الآن" : "Sync now"}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-[13px] font-medium text-text-primary disabled:opacity-60"
            />
          </div>
        )}

        {/* الإنهاء / التخطي */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <button onClick={skip} disabled={skipping} className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text-primary">
            {skipping && <Loader2 size={13} className="animate-spin" />}
            {skipping ? c.skipping : c.skip}
          </button>

          {step1Done && step2Done && (
            <a
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-medium text-white no-underline"
            >
              {c.finish}
              <ArrowLeft size={15} className="rtl:rotate-0 ltr:rotate-180" />
            </a>
          )}
        </div>

        <p className="mt-6 text-[12px] leading-relaxed text-text-faint">{c.note}</p>
      </div>

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
    </div>
  );
}
