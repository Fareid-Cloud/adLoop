"use client";

// app/components/TrialBar.tsx
//
// شريط حالة الاشتراك أعلى اللوحة.
//
// **يظهر حين يعني شيئاً فقط.** شريط ترقية دائم يصير جزءاً من الأثاث
// فتتوقّف العين عن رؤيته، ويُفقد أثره في اليوم الذي يهمّ فعلاً. لذلك:
// صامت في أوّل أسبوع، ويشتدّ مع اقتراب النهاية.
//
// **الإلحاح متدرّج لا ثابت:** سبعة أيام معلومة هادئة، وثلاثة تحذير،
// ويوم واحد إنذار. الإلحاح من أوّل يوم يُقرأ كضغط بيع لا كتنبيه.

import { useState } from "react";
import Link from "next/link";
import { Sparkles, X, Clock, AlertTriangle, Zap } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";
import type { SubscriptionState } from "@/lib/entitlements";

export function TrialBar({
  state, trialDaysLeft, locale = "ar", planKey,
}: {
  state: SubscriptionState;
  trialDaysLeft: number | null;
  locale?: Locale;
  planKey: string;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `trialBar.${k}`, v);
  const [dismissed, setDismissed] = useState(false);

  // الأسبوع الأوّل صامت: المستخدم لم يصل إلى قيمة المنتج بعد، ومطالبته
  // بالدفع قبلها تُقرأ كإلحاح لا كعرض.
  const quiet = state === "TRIAL" && (trialDaysLeft ?? 99) > 7;
  if (dismissed || state === "ACTIVE" || quiet) return null;

  const days = trialDaysLeft ?? 0;
  const tone =
    state === "EXPIRED" || state === "FREE" ? "critical"
    : days <= 1 ? "critical"
    : days <= 3 ? "gap"
    : "accent";

  const Icon = tone === "critical" ? AlertTriangle : tone === "gap" ? Clock : Sparkles;

  const title =
    state === "TRIAL"
      ? days <= 1 ? tr("lastDay") : tr("daysLeft", { n: days })
      : state === "EXPIRED" ? tr("expiredTitle")
      : tr("freeTitle");

  const body =
    state === "TRIAL" ? tr("trialBody")
    : state === "EXPIRED" ? tr("expiredBody")
    : tr("freeBody");

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border p-3.5"
      style={{
        borderColor: `color-mix(in srgb, var(--${tone}) 35%, transparent)`,
        background: `color-mix(in srgb, var(--${tone}) 7%, transparent)`,
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in srgb, var(--${tone}) 14%, transparent)`, color: `var(--${tone})` }}
      >
        <Icon size={17} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-text-primary">{title}</div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-text-muted">{body}</div>
      </div>

      {/* عرض محدود المدّة يظهر في نافذة القرار وحدها - خصم دائم يُعلّم
          المستخدم أن السعر المعلن ليس السعر الحقيقي */}
      {state === "TRIAL" && days <= 3 && (
        <span className="shrink-0 rounded-lg bg-verified/12 px-2.5 py-1 text-[11.5px] font-medium text-verified">
          {tr("offer")}
        </span>
      )}

      <Link
        href="/dashboard/billing"
        className="btn btn-primary shrink-0"
      >
        <Zap size={14} />
        {state === "TRIAL" ? tr("upgrade") : tr("subscribe")}
      </Link>

      {/* الإخفاء متاح إلا في آخر يوم: بعده لا يُخفى ما يوقف الحساب غداً */}
      {days > 1 && state === "TRIAL" && (
        <button
          onClick={() => setDismissed(true)}
          aria-label={tr("dismiss")}
          className="shrink-0 rounded-lg p-1 text-text-faint hover:text-text-primary"
        >
          <X size={15} />
        </button>
      )}
      <span className="hidden">{planKey}</span>
    </div>
  );
}
