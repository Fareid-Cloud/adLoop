// app/components/ConnectPlatforms.tsx
//
// ربط المنصات من مكانه الطبيعي: اللوحة نفسها وصفحة كل منصة - لا "اذهب إلى
// الإعدادات". كارت لكل منصة بشعارها ولونها، وزرّ ربط مباشر (OAuth)، وحالة
// واضحة إن كانت مربوطة بالفعل.
//
// **لا رابط واحد هنا يخرج إلى الإعدادات.** خطوة الربط تُنفَّذ في مكانها:
// إمّا OAuth مباشر، أو نافذة اختيار حملات تفتح فوق الصفحة.

import { PlatformLogo } from "@/app/components/PlatformLogo";
import { CampaignPickerLauncher } from "@/app/components/CampaignPickerLauncher";
import { Check, Plus } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

type AdPlatform = "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS";

export const PLATFORM_CONNECT: Record<string, { label: string; color: string; start: string }> = {
  GOOGLE_ADS: { label: "Google Ads", color: "#1A73E8", start: "/api/oauth/google-ads/start" },
  META_ADS: { label: "Meta Ads", color: "#0866FF", start: "/api/oauth/meta/start" },
  TIKTOK_ADS: { label: "TikTok Ads", color: "#FE2C55", start: "/api/oauth/tiktok/start" },
};

export interface ConnectState {
  platform: string;
  connected: boolean;
  campaignCount: number;
}

function Card({
  s, workspaceId, locale,
}: {
  s: ConnectState;
  workspaceId: string;
  locale: Locale;
}) {
  const meta = PLATFORM_CONNECT[s.platform];
  if (!meta) return null;

  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `setup.${k}`, v);
  const needsCampaigns = s.connected && s.campaignCount === 0;

  return (
    <div
      className="card-shadow relative overflow-hidden rounded-2xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5"
      style={{ ["--pc" as string]: meta.color } as React.CSSProperties}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: meta.color }} />
      <div className="mb-3 flex items-center gap-2.5">
        <PlatformLogo platform={s.platform} size={26} />
        <span className="text-[15px] font-semibold text-text-primary">{meta.label}</span>
        {s.connected && (
          <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-verified/12 px-2 py-0.5 text-[11px] font-medium text-verified">
            <Check size={11} /> {tr("connected")}
          </span>
        )}
      </div>

      {!s.connected ? (
        <>
          <p className="mb-4 text-[13px] leading-relaxed text-text-muted">{tr("connectHint")}</p>
          <a
            href={meta.start}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white no-underline transition-opacity hover:opacity-90"
            style={{ background: meta.color }}
          >
            <Plus size={15} /> {tr("connectCta", { platform: meta.label })}
          </a>
        </>
      ) : needsCampaigns ? (
        <>
          <p className="mb-4 text-[13px] leading-relaxed text-text-muted">{tr("oneStepLeft")}</p>
          <CampaignPickerLauncher
            workspaceId={workspaceId}
            connectedPlatforms={[s.platform as AdPlatform]}
            locale={locale}
            label={tr("selectCampaigns")}
            className="card-shadow inline-flex w-full items-center justify-center rounded-xl border border-border bg-surface-raised py-2.5 text-sm font-medium text-text-primary"
          />
        </>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-text-muted">{tr("nTracked", { n: s.campaignCount })}</p>
          {/* إضافة حساب آخر تحت نفس الربط - حسابات MCC/Business المتعدّدة */}
          <CampaignPickerLauncher
            workspaceId={workspaceId}
            connectedPlatforms={[s.platform as AdPlatform]}
            locale={locale}
            label={tr("addAccount")}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-raised py-2 text-[12.5px] font-medium text-text-muted"
          />
        </>
      )}
    </div>
  );
}

export function ConnectPlatforms({
  states,
  workspaceId,
  locale = "ar",
  title,
  subtitle,
  onlyUnconnected = false,
}: {
  states: ConnectState[];
  workspaceId: string;
  locale?: Locale;
  title?: string;
  subtitle?: string;
  onlyUnconnected?: boolean;
}) {
  const shown = onlyUnconnected ? states.filter((s) => !s.connected || s.campaignCount === 0) : states;
  if (shown.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-1 text-[15px] font-semibold text-text-primary">
        {title ?? t(locale, "setup.connectTitle")}
      </h2>
      <p className="mb-3 text-[13px] text-text-muted">
        {subtitle ?? t(locale, "setup.connectSubtitle")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s) => (
          <Card key={s.platform} s={s} workspaceId={workspaceId} locale={locale} />
        ))}
      </div>
    </section>
  );
}

/** كارت مفرد - لصفحة منصة بعينها */
export function ConnectSinglePlatform({
  state, workspaceId, locale = "ar",
}: {
  state: ConnectState;
  workspaceId: string;
  locale?: Locale;
}) {
  return (
    <div className="mx-auto max-w-md">
      <Card s={state} workspaceId={workspaceId} locale={locale} />
    </div>
  );
}
