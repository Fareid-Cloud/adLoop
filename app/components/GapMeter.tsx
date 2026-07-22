// app/components/GapMeter.tsx
//
// العنصر التوقيعي للمنتج كله - شريط بيوري في نفس اللقطة: الرقم اللي المنصة
// بتقوله (تعبئة شفافة بحد أصفر) مقابل الرقم المتحقق منه فعلياً (شريط أخضر
// ممتلئ فوقه). الفرق البصري بين الاتنين هو "الفجوة" نفسها.
//
// بيتبني تدريجياً أول ما يظهر في الشاشة (من صفر للقيمة الحقيقية) - مش
// بيظهر جاهز فجأة، بناءً على طلب صريح إن الجرافيكس تتحرك وتتبني قدام
// المستخدم مش تبان كصورة ثابتة.

"use client";

import { useEffect, useRef, useState } from "react";

interface GapMeterProps {
  label: string;
  verifiedValue: number;
  reportedValue: number;
  unit?: string;
  size?: "sm" | "lg";
}

export function GapMeter({
  label,
  verifiedValue,
  reportedValue,
  unit = "",
  size = "sm",
}: GapMeterProps) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // IntersectionObserver عشان الأنيميشن يشتغل لما العنصر فعلاً يبان في
    // الشاشة، مش أول ما الصفحة تحمّل بره حدود الشاشة
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(verifiedValue, reportedValue, 1);
  const verifiedPct = animated ? Math.min((verifiedValue / max) * 100, 100) : 0;
  const reportedPct = animated ? Math.min((reportedValue / max) * 100, 100) : 0;

  const gapPct =
    reportedValue > 0
      ? Math.round(((reportedValue - verifiedValue) / reportedValue) * 100)
      : 0;

  return (
    <div ref={ref} className="gap-meter" style={{ fontSize: size === "lg" ? 16 : 13 }}>
      <div className="flex items-baseline justify-between">
        <span className="text-text-muted">{label}</span>
        {gapPct > 0 && (
          <span className="font-mono text-xs text-gap">+{gapPct}%</span>
        )}
      </div>

      <div className="gap-meter-track" style={{ height: size === "lg" ? 14 : 8 }}>
        <div className="gap-meter-reported" style={{ width: `${reportedPct}%` }} />
        <div className="gap-meter-verified" style={{ width: `${verifiedPct}%` }} />
      </div>

      <div className="gap-meter-labels">
        <span className="verified">
          {verifiedValue.toLocaleString()}
          {unit} — متحقق
        </span>
        <span className="reported">
          {reportedValue.toLocaleString()}
          {unit} — معلن
        </span>
      </div>
    </div>
  );
}
