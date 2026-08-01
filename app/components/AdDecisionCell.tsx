"use client";

// app/components/AdDecisionCell.tsx
//
// عمود القرار بجوار كل إعلان. ثلاثة أزرار تنفّذ فعلياً على المنصة، لا
// تُسجّل نيّة فحسب.
//
// تأكيد بضغطتين مقصود: الضغطة الأولى تحوّل الزرّ إلى «تأكيد؟» لأربع ثوانٍ.
// هذه عمليات كتابة على حساب إعلاني حقيقي (إيقاف إعلان، زيادة ميزانية) -
// ضغطة واحدة بالخطأ تكلّف مالاً فعلياً. نفس النمط المعتمد في صفحة القرارات.

import type { LucideIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { TrendingUp, PauseCircle, MinusCircle, Loader2, Check, Lock, AlertTriangle } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import { t, type Locale } from "@/lib/i18n/dictionary";

export type Decision = "SCALE" | "HOLD" | "PAUSE";

export interface AdDecisionCellProps {
  locale?: Locale;
  workspaceId: string;
  adId: string;
  decision: Decision;
  reason: string;
  executable: boolean;
  blockedReason: string | null;
  cooldownDaysRemaining: number;
  lastAppliedDecision: Decision | null;
  scaleIncreasePct: number;
  scaleAffectsSiblings: boolean;
}

const CONFIRM_WINDOW_MS = 4000;

const STYLES: Record<string, { labelKey: string; icon: LucideIcon; className: string; confirmClassName: string }> = {
  SCALE: {
    labelKey: "scale",
    icon: TrendingUp,
    className:
      "border-success/40 bg-success/10 text-success hover:bg-success/20 hover:ring-2 hover:ring-success/25",
    confirmClassName: "border-success bg-success text-white",
  },
  HOLD: {
    labelKey: "hold",
    icon: MinusCircle,
    className:
      "border-border bg-surface-2 text-text-muted hover:bg-surface-3 hover:ring-2 hover:ring-border",
    confirmClassName: "border-text-muted bg-text-muted text-white",
  },
  PAUSE: {
    labelKey: "pause",
    icon: PauseCircle,
    className:
      "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 hover:ring-2 hover:ring-danger/25",
    confirmClassName: "border-danger bg-danger text-white",
  },
};

export function AdDecisionCell(props: AdDecisionCellProps) {
  const locale: Locale = props.locale ?? "ar";
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `adCell.${k}`, vars);
  const {
    workspaceId, adId, decision, reason, executable, blockedReason,
    cooldownDaysRemaining, lastAppliedDecision, scaleIncreasePct, scaleAffectsSiblings,
  } = props;

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const style = STYLES[decision];
  const Icon = style.icon;

  // ==== قرار سابق لم تكتمل مدّة تقييمه ====
  if (cooldownDaysRemaining > 0 && lastAppliedDecision) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-text-muted">
          <Lock className="h-3.5 w-3.5" />
          {tr("measuring", { decision: tr(STYLES[lastAppliedDecision].labelKey) })}
        </span>
        <span className="text-[11px] leading-tight text-text-muted">
          {tr("reassessIn", { n: cooldownDaysRemaining })}
        </span>
      </div>
    );
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-xs font-medium text-success">
        <Check className="h-3.5 w-3.5" />
        {done}
      </span>
    );
  }

  async function run() {
    setBusy(true);
    setError(null);
    setConfirming(false);
    try {
      const res = await fetch("/api/creatives/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({ workspaceId, adId, decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tr("failed"));
      setDone(data.message ?? tr("applied"));
    } catch (err) {
      // الفشل يظهر كما هو - إخفاؤه يجعل المستخدم يظن أن التغيير حدث
      setError(err instanceof Error ? err.message : tr("failed"));
    } finally {
      setBusy(false);
    }
  }

  function handleClick() {
    if (busy) return;
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    void run();
  }

  const disabled = !executable || busy;

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={executable ? reason : (blockedReason ?? reason)}
        className={[
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          disabled
            ? "cursor-not-allowed border-border bg-surface-2 text-text-muted opacity-60"
            : confirming
              ? style.confirmClassName
              : style.className,
        ].join(" ")}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
        {busy ? tr("applying") : confirming ? tr("confirm") : tr(style.labelKey)}
      </button>

      {/* الأثر الجانبي يُقال قبل التنفيذ لا بعده */}
      {executable && decision === "SCALE" && (
        <span className="text-[11px] leading-tight text-text-muted">
          {tr("scaleOn", { pct: scaleIncreasePct ?? 0, target: scaleAffectsSiblings ? tr("targetAdset") : tr("targetCampaign") })}
        </span>
      )}

      {!executable && blockedReason && (
        <span className="max-w-[220px] text-[11px] leading-tight text-text-muted">{blockedReason}</span>
      )}

      {error && (
        <span className="inline-flex max-w-[220px] items-start gap-1 text-[11px] leading-tight text-danger">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
}
