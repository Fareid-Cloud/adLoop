// app/dashboard/campaigns/creatives/ImageQualityButton.tsx

"use client";

import { useState } from "react";
import { ScanEye } from "lucide-react";

interface QualityResult {
  score: number;
  resolutionAssessment: string;
  textOverlayAssessment: string;
  professionalismAssessment: string;
  recommendation: string;
}

export function ImageQualityButton({
  imageUrl,
  platform,
}: {
  imageUrl: string;
  platform: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QualityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkQuality() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/creatives/quality-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, platform }),
    });

    if (res.ok) {
      setResult(await res.json());
    } else {
      const data = await res.json();
      setError(data.error ?? "حصل خطأ");
    }
    setLoading(false);
  }

  if (result) {
    return (
      <div className="mt-2 rounded-xl bg-surface-raised p-2 text-[10px] text-text-muted">
        <div className="mb-1 font-mono text-xs text-text-primary">جودة الصورة: {result.score}/100</div>
        <p>{result.textOverlayAssessment}</p>
        <p className="mt-1">{result.recommendation}</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        onClick={checkQuality}
        disabled={loading}
        className="flex items-center gap-1 text-[10px] text-text-faint hover:text-text-primary disabled:opacity-50"
      >
        <ScanEye size={11} />
        {loading ? "جارٍ التحليل..." : "افحص جودة الصورة"}
      </button>
      {error && <p className="mt-1 text-[10px] text-critical">{error}</p>}
    </div>
  );
}
