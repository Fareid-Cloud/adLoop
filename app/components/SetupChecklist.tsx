// app/components/SetupChecklist.tsx
//
// قائمة الإعداد: خطوات حقيقية تكتمل تلقائياً عند إنجازها فعلياً (وليس
// بالضغط على "التالي"). تظهر حتى تكتمل كل الخطوات ثم تختفي وحدها.

import type { SetupProgress } from "@/lib/setupProgress";
import { CampaignPickerLauncher } from "@/app/components/CampaignPickerLauncher";
import { Check, ArrowLeft } from "lucide-react";

export function SetupChecklist({
  progress,
  workspaceId,
  connectedPlatforms = [],
  locale = "ar",
}: {
  progress: SetupProgress;
  workspaceId: string;
  connectedPlatforms?: Array<"GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS">;
  locale?: "ar" | "en";
}) {
  if (progress.allDone) return null;
  const ar = locale === "ar";
  const pct = Math.round((progress.completedCount / progress.total) * 100);

  return (
    <section className="card-shadow mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-border p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-text-primary">
            {ar ? "أكمل إعداد حسابك" : "Finish setting up"}
          </h2>
          <span className="font-mono text-[13px] text-text-muted">
            {progress.completedCount}/{progress.total}
          </span>
        </div>
        <p className="mb-3 text-[13px] text-text-muted">
          {ar
            ? "تكتمل كل خطوة تلقائياً بمجرد إنجازها فعلياً — لا حاجة لتعليمها يدوياً."
            : "Each step completes automatically once it's actually done — nothing to check off manually."}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="divide-y divide-border">
        {progress.steps.map((s, i) => {
          const isNext = progress.nextStep?.id === s.id;
          return (
            <li key={s.id} className={`flex items-start gap-3 p-4 ${isNext ? "bg-accent/[0.04]" : ""}`}>
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  s.done
                    ? "bg-verified text-white"
                    : isNext
                    ? "bg-accent text-white"
                    : "border border-border bg-surface-raised text-text-faint"
                }`}
              >
                {s.done ? <Check size={13} /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className={`text-[14px] font-medium ${s.done ? "text-text-muted line-through" : "text-text-primary"}`}>
                  {ar ? s.titleAr : s.titleEn}
                </div>
                {!s.done && (
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-muted">{ar ? s.descAr : s.descEn}</p>
                )}
              </div>

              {!s.done && isNext && s.id === "campaigns" && connectedPlatforms.length > 0 ? (
                <CampaignPickerLauncher
                  workspaceId={workspaceId}
                  connectedPlatforms={connectedPlatforms}
                  locale={locale}
                  label={ar ? s.ctaAr : s.ctaEn}
                  className="shrink-0 rounded-xl bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white"
                />
              ) : !s.done && isNext ? (
                <a
                  href={s.ctaHref}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white no-underline transition-opacity hover:opacity-90"
                >
                  {ar ? s.ctaAr : s.ctaEn}
                  <ArrowLeft size={13} className="rtl:rotate-0 ltr:rotate-180" />
                </a>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
