// app/components/PlatformBreakdown.tsx
//
// المنصات مجمّعة بشكل افتراضي (زي ما اتفقنا: المنصة فلتر مش تقسيم أساسي)،
// لكن قابلة للفصل بضغطة واحدة لو المستخدم عايز يشوف كل منصة لوحدها -
// طلب صريح: "خليها ممكن تظهر منفصلة لو حد حابب".

"use client";

import { useState } from "react";
import { GapMeter } from "./GapMeter";

interface PlatformData {
  platform: string;
  platformLabel: string;
  verified: number;
  reported: number;
}

export function PlatformBreakdown({ platforms }: { platforms: PlatformData[] }) {
  const [separated, setSeparated] = useState(false);

  const combined = platforms.reduce(
    (acc, p) => ({ verified: acc.verified + p.verified, reported: acc.reported + p.reported }),
    { verified: 0, reported: 0 }
  );

  return (
    <div className="rounded-2xl bg-surface p-6">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-[13px] text-text-muted">
          الحقيقة مقابل الظاهر — {separated ? "كل منصة على حدة" : "كل المنصات"} (آخر 30 يوم)
        </span>
        {platforms.length > 1 && (
          <button
            onClick={() => setSeparated((s) => !s)}
            className="rounded-full bg-surface-raised px-3 py-1 text-xs text-text-muted transition-colors hover:text-text-primary"
          >
            {separated ? "دمج المنصات" : "فصل المنصات"}
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
            />
          ))}
        </div>
      ) : (
        <GapMeter
          label="المحادثات"
          verifiedValue={combined.verified}
          reportedValue={combined.reported}
          size="lg"
        />
      )}
    </div>
  );
}
