"use client";

// app/components/WelcomeGate.tsx
//
// بوابة الترحيب. النسخة السابقة كانت أربع شرائح نصّية وزرّ "التالي" -
// المستخدم يضغطه أربع مرّات فيخرج وقد أنجز **صفر خطوات**، ثم يقف أمام
// لوحة فارغة لا يعرف لماذا هي فارغة.
//
// **القاعدة الحاكمة هنا:** خطوة تطلب فعلاً لا تُتجاوَز إلا بالفعل. زرّ
// "التالي" يُعطَّل صراحةً ويُقال سبب تعطيله - لا يُترك المستخدم يضغط
// زرّاً ميّتاً يظنّه معطوباً. أما الشرائح التعريفية فالتالي فيها مشروع
// لأنها لا تطلب شيئاً أصلاً.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Link2, ListChecks, Rocket, Check, Loader2, ArrowLeft, RefreshCw,
} from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { CampaignPickerModal } from "@/app/components/CampaignPickerModal";
import { t, type Locale } from "@/lib/i18n/dictionary";

type Platform = "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS";

const PLATFORMS: { id: Platform; label: string; start: string; color: string }[] = [
  { id: "GOOGLE_ADS", label: "Google Ads", start: "/api/oauth/google-ads/start", color: "#1A73E8" },
  { id: "META_ADS", label: "Meta Ads", start: "/api/oauth/meta/start", color: "#0866FF" },
  { id: "TIKTOK_ADS", label: "TikTok Ads", start: "/api/oauth/tiktok/start", color: "#FE2C55" },
];

/** الشرائح: تعريفية (لا تطلب شيئاً) أو فعلية (لا تُتجاوَز بلا إنجاز) */
type SlideId = "welcome" | "gap" | "connect" | "campaigns" | "done";

const ICONS: Record<SlideId, typeof Rocket> = {
  welcome: Rocket, gap: ShieldCheck, connect: Link2, campaigns: ListChecks, done: Check,
};

const ORDER: SlideId[] = ["welcome", "gap", "connect", "campaigns", "done"];

export function WelcomeGate({
  locale,
  startStep = 0,
  workspaceId,
  connectStates,
  campaignCount,
}: {
  locale: Locale;
  startStep?: number;
  workspaceId: string;
  connectStates: { platform: string; connected: boolean; campaignCount: number }[];
  campaignCount: number;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `welcome.${k}`, v);
  const router = useRouter();

  const [i, setI] = useState(Math.min(startStep, ORDER.length - 1));
  const [closing, setClosing] = useState(false);
  const [picking, setPicking] = useState<Platform | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const connected = connectStates.filter((s) => s.connected);
  const connectDone = connected.length > 0;
  const campaignsDone = campaignCount > 0;

  const id = ORDER[i];
  const Icon = ICONS[id];

  // العودة من OAuth تُعيد تحميل الصفحة، فنقفز تلقائياً إلى أوّل خطوة
  // ناقصة بدل أن يبدأ المستخدم من الشريحة الأولى في كل مرّة.
  useEffect(() => {
    if (id === "connect" && connectDone) setI(ORDER.indexOf("campaigns"));
    else if (id === "campaigns" && campaignsDone) setI(ORDER.indexOf("done"));
  }, [connectDone, campaignsDone, id]);

  /** الشريحة الفعلية تُقفل حتى يتحقّق شرطها في قاعدة البيانات */
  const blockedReason: string | null =
    id === "connect" && !connectDone ? tr("blockConnect")
    : id === "campaigns" && !campaignsDone ? tr("blockCampaigns")
    : null;

  async function persist(body: object) {
    await fetch("/api/onboarding/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  async function finish() {
    setClosing(true);
    await persist({ step: ORDER.length, completed: true });
    router.refresh();
  }

  async function skip() {
    setClosing(true);
    await persist({ dismissed: true });
    router.refresh();
  }

  function next() {
    if (blockedReason) return;
    if (i === ORDER.length - 1) return finish();
    const n = i + 1;
    setI(n);
    void persist({ step: n });
  }

  if (closing) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg/85 px-4 backdrop-blur-sm">
      <div className="pop-shadow w-full max-w-md rounded-3xl border border-border bg-surface p-7">
        {/* مؤشّر التقدّم - الخطوات المنجزة فعلاً بلون مختلف عن المعروضة */}
        <div className="mb-5 flex gap-1.5">
          {ORDER.map((sid, idx) => {
            const realDone =
              sid === "connect" ? connectDone
              : sid === "campaigns" ? campaignsDone
              : idx < i;
            return (
              <span
                key={sid}
                className="h-1 flex-1 rounded-full transition-colors"
                style={{
                  background: realDone ? "var(--verified)" : idx === i ? "var(--accent)" : "var(--surface-raised)",
                }}
              />
            );
          })}
        </div>

        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent">
          <Icon size={21} />
        </span>

        <div className="mb-1.5 text-[12px] font-medium text-accent">
          {tr("stepOf", { a: i + 1, b: ORDER.length })}
        </div>
        <h1 className="mb-2 text-[24px] font-bold leading-snug tracking-tight text-text-primary">
          {tr(`${id}Title`)}
        </h1>
        <p className="mb-5 text-[13.5px] leading-relaxed text-text-muted">{tr(`${id}Body`)}</p>

        {/* ==================== الخطوة الفعلية: الربط ==================== */}
        {id === "connect" && (
          <div className="mb-5 flex flex-col gap-2">
            {PLATFORMS.map((p) => {
              const on = connectStates.find((s) => s.platform === p.id)?.connected ?? false;
              return (
                <a
                  key={p.id}
                  href={on ? undefined : p.start}
                  className={`flex items-center gap-3 rounded-xl border p-3 no-underline transition-colors ${
                    on ? "border-verified/40 bg-verified/[0.06]" : "border-border bg-surface-raised hover:border-accent"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${p.color}1A` }}>
                    <PlatformLogo platform={p.id} size={18} />
                  </span>
                  <span className="flex-1 text-[13.5px] font-medium text-text-primary">{p.label}</span>
                  {on ? (
                    <span className="flex items-center gap-1 text-[12px] font-medium text-verified">
                      <Check size={13} /> {tr("connected")}
                    </span>
                  ) : (
                    <span className="rounded-lg bg-accent px-3 py-1 text-[12px] font-medium text-white">{tr("connect")}</span>
                  )}
                </a>
              );
            })}
          </div>
        )}

        {/* ==================== الخطوة الفعلية: الحملات ==================== */}
        {id === "campaigns" && (
          <div className="mb-5 flex flex-col gap-2">
            {campaignsDone ? (
              <div className="flex items-center gap-2 rounded-xl border border-verified/40 bg-verified/[0.06] p-3 text-[13px] font-medium text-verified">
                <Check size={15} /> {tr("nLinked", { n: campaignCount })}
              </div>
            ) : (
              connected.map((s) => (
                <button
                  key={s.platform}
                  onClick={() => setPicking(s.platform as Platform)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised p-3 text-start transition-colors hover:border-accent"
                >
                  <PlatformLogo platform={s.platform} size={18} />
                  <span className="flex-1 text-[13.5px] font-medium text-text-primary">
                    {tr("pickFrom", { platform: PLATFORMS.find((p) => p.id === s.platform)?.label ?? s.platform })}
                  </span>
                  <span className="rounded-lg bg-accent px-3 py-1 text-[12px] font-medium text-white">{tr("pick")}</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* سبب التعطيل مكتوب - زرّ معطَّل بلا تفسير يُقرأ كعطل في البرنامج */}
        {blockedReason && (
          <div className="mb-4 flex items-start justify-between gap-2 rounded-xl bg-gap/[0.08] p-3">
            <p className="text-[12.5px] leading-relaxed text-text-muted">{blockedReason}</p>
            <button
              onClick={() => { setRefreshing(true); router.refresh(); setTimeout(() => setRefreshing(false), 900); }}
              className="flex shrink-0 items-center gap-1 text-[11.5px] text-accent"
            >
              {refreshing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              {tr("recheck")}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button onClick={skip} className="text-[13px] text-text-muted hover:text-text-primary">
            {tr("skip")}
          </button>

          <button
            onClick={next}
            disabled={blockedReason !== null}
            title={blockedReason ?? undefined}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {i === ORDER.length - 1 ? tr("finish") : tr("next")}
            <ArrowLeft size={15} className="rtl:rotate-0 ltr:rotate-180" />
          </button>
        </div>

        <p className="mt-5 text-[11.5px] leading-relaxed text-text-faint">{tr("note")}</p>
      </div>

      {picking && (
        <CampaignPickerModal
          workspaceId={workspaceId}
          platform={picking}
          open
          locale={locale === "en" ? "en" : "ar"}
          onClose={() => setPicking(null)}
          onSaved={() => { setPicking(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
