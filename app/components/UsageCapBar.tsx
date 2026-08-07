// app/components/UsageCapBar.tsx
//
// شريط سقف الاستهلاك.
//
// **لماذا شريط دائم لا إشعار وحده:** الإشعار يُقرأ مرّةً ويُغلق، ثمّ يقضي
// المستخدم أياماً يقرأ أرقاماً لا تتحرّك ولا يعرف لماذا. توقّف المزامنة
// حالةٌ مستمرّة، وما يستمرّ يُعرض حتى ينتهي.
//
// **القاعدة الحاكمة:** نقطة تمنع المستخدم تحمل معها الحلّ. الشريط يقول:
// ما توقّف، بأيّ رقم، ما الذي **لم** يتوقّف (بياناتك كلّها باقية)، ومتى
// يعود من تلقائه - ثمّ زرّ واحد لمن لا يريد الانتظار.
//
// **ولا يظهر إلّا عند ٨٠٪ فأعلى:** شريطٌ يعلن «استهلكت ١٢٪» يشغل مساحة
// دائمة بمعلومة لا قرار عندها.

import { AlertTriangle, ShieldAlert } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";
import type { UsageState } from "@/lib/usageCaps";

export function UsageCapBar({ state, locale }: { state: UsageState; locale: Locale }) {
  if (!state.blocked && state.pct < 80) return null;

  const vars = {
    pct: state.pct,
    spend: state.spendUsd.toLocaleString("en-US"),
    spendLimit: state.spendLimitUsd.toLocaleString("en-US"),
    conv: state.verifiedConversions.toLocaleString("en-US"),
    convLimit: state.verifiedLimit.toLocaleString("en-US"),
  };

  const title = t(locale, state.blocked ? "alerts.usageBlockedTitle" : "alerts.usageWarnTitle");
  const body = t(
    locale,
    state.blocked
      ? state.reason === "spend"
        ? "alerts.usageBlockedSpendBody"
        : "alerts.usageBlockedConvBody"
      : "alerts.usageWarnBody",
    vars
  );

  const Icon = state.blocked ? ShieldAlert : AlertTriangle;
  const tone = state.blocked
    ? { box: "border-critical/40 bg-critical/[0.07]", mark: "bg-critical/12 text-critical" }
    : { box: "border-gap/40 bg-gap/[0.07]", mark: "bg-gap/12 text-gap" };

  return (
    <div className={`mb-4 flex flex-wrap items-start gap-3 rounded-2xl border p-4 ${tone.box}`}>
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.mark}`}>
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-text-primary">{title}</div>
        <p className="mt-0.5 max-w-3xl text-[12.5px] leading-relaxed text-text-muted">{body}</p>
        {/* شريط النسبة: الرقم وحده مجرَّد، والامتلاء يُقرأ من طرف العين. */}
        <div className="mt-2.5 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-surface-raised">
          <div
            className={`h-full rounded-full ${state.blocked ? "bg-critical" : "bg-gap"}`}
            style={{ width: `${Math.min(100, state.pct)}%` }}
          />
        </div>
      </div>
      <a href="/dashboard/billing" className="btn btn-primary btn-sm shrink-0">
        {t(locale, "trialBar.upgrade")}
      </a>
    </div>
  );
}
