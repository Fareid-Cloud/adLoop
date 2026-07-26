// app/components/ConnectPlatforms.tsx
//
// ربط المنصات من مكانه الطبيعي: الداشبورد نفسه وصفحة كل منصة - مش "روح
// للإعدادات". كارت لكل منصة بلوجوها ولونها، وزر ربط مباشر (OAuth)، وحالة
// واضحة لو مربوطة بالفعل.

import { PlatformLogo } from "@/app/components/PlatformLogo";
import { Check, Plus } from "lucide-react";

export const PLATFORM_CONNECT: Record<string, { label: string; color: string; start: string }> = {
  GOOGLE_ADS: { label: "Google Ads", color: "#4285F4", start: "/api/oauth/google-ads/start" },
  META_ADS: { label: "Meta Ads", color: "#0866FF", start: "/api/oauth/meta/start" },
  TIKTOK_ADS: { label: "TikTok Ads", color: "#FE2C55", start: "/api/oauth/tiktok/start" },
};

export interface ConnectState {
  platform: string;
  connected: boolean;
  campaignCount: number;
}

function Card({ s }: { s: ConnectState }) {
  const meta = PLATFORM_CONNECT[s.platform];
  if (!meta) return null;

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
            <Check size={11} /> متصل
          </span>
        )}
      </div>

      {!s.connected ? (
        <>
          <p className="mb-4 text-[13px] leading-relaxed text-text-muted">
            اربط حسابك لسحب الإنفاق والحملات تلقائياً، ومقارنة أرقام المنصة بالتحويلات المتحقّقة.
          </p>
          <a
            href={meta.start}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white no-underline transition-opacity hover:opacity-90"
            style={{ background: meta.color }}
          >
            <Plus size={15} /> ربط {meta.label}
          </a>
        </>
      ) : needsCampaigns ? (
        <>
          <p className="mb-4 text-[13px] leading-relaxed text-text-muted">
            الحساب مربوط ✓ — تبقّت خطوة واحدة: اختر الحملات التي تريد متابعتها.
          </p>
          <a
            href="/dashboard/settings?tab=workspace"
            className="card-shadow inline-flex w-full items-center justify-center rounded-xl border border-border bg-surface-raised py-2.5 text-sm font-medium text-text-primary no-underline"
          >
            اختيار الحملات
          </a>
        </>
      ) : (
        <p className="text-[13px] text-text-muted">
          {s.campaignCount} حملة متابَعة — تُزامَن يومياً تلقائياً.
        </p>
      )}
    </div>
  );
}

export function ConnectPlatforms({
  states,
  title = "اربط منصاتك الإعلانية",
  subtitle = "اربط حساباتك لتبدأ رؤية أرقامك الحقيقية في مكان واحد.",
  onlyUnconnected = false,
}: {
  states: ConnectState[];
  title?: string;
  subtitle?: string;
  onlyUnconnected?: boolean;
}) {
  const shown = onlyUnconnected ? states.filter((s) => !s.connected || s.campaignCount === 0) : states;
  if (shown.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-1 text-[15px] font-semibold text-text-primary">{title}</h2>
      <p className="mb-3 text-[13px] text-text-muted">{subtitle}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s) => (
          <Card key={s.platform} s={s} />
        ))}
      </div>
    </section>
  );
}

// كارت مفرد - لصفحة منصة بعينها
export function ConnectSinglePlatform({ state }: { state: ConnectState }) {
  return (
    <div className="mx-auto max-w-md">
      <Card s={state} />
    </div>
  );
}
