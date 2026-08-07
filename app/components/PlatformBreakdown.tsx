// app/components/PlatformBreakdown.tsx
//
// المنصات مجمّعة بشكل افتراضي (زي ما اتفقنا: المنصة فلتر مش تقسيم أساسي)،
// لكن قابلة للفصل بضغطة واحدة لو المستخدم عايز يشوف كل منصة بمفردها -
// طلب صريح: "خليها ممكن تظهر منفصلة لو حد حابب".

"use client";

import { useState } from "react";
import { GapMeter } from "./GapMeter";
import { t, type Locale } from "@/lib/i18n/dictionary";

interface PlatformData {
  platform: string;
  platformLabel: string;
  verified: number;
  reported: number;
}

export function PlatformBreakdown({
  platforms,
  locale = "ar",
  days = 30,
}: {
  platforms: PlatformData[];
  locale?: Locale;
  days?: number;
}) {
  const [separated, setSeparated] = useState(false);

  const combined = platforms.reduce(
    (acc, p) => ({ verified: acc.verified + p.verified, reported: acc.reported + p.reported }),
    { verified: 0, reported: 0 }
  );

  return (
    <div className="card p-6">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-[13px] text-text-muted">
          {t(locale, "ui.splitHeading", {
            mode: t(locale, separated ? "ui.splitSeparated" : "ui.splitMerged"),
            days: String(days),
          })}
        </span>
        {platforms.length > 1 && (
          <button
            onClick={() => setSeparated((s) => !s)}
            className="rounded-full bg-surface-raised px-3 py-1 text-xs text-text-muted transition-colors hover:text-text-primary"
          >
            {t(locale, separated ? "ui.splitDoMerge" : "ui.splitDoSeparate")}
          </button>
        )}
      </div>

      {separated ? (
        <div className="flex flex-col gap-5">
          {platforms.map((p) => (
            <GapMeter
              key={p.platform}
              label={p.platformLabel}
              verifiedValue={p.verified}
              reportedValue={p.reported}
              locale={locale}
            />
          ))}
        </div>
      ) : (
        <GapMeter
          label={t(locale, "ui.conversations")}
          verifiedValue={combined.verified}
          reportedValue={combined.reported}
          size="lg"
          locale={locale}
        />
      )}
    </div>
  );
}
