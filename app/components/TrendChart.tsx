// app/components/TrendChart.tsx
//
// رسم بياني تفاعلي حقيقي (مش صورة جاهزة) - بيتبني ويتحرك أول ما يظهر في
// الشاشة، مبني بـ Recharts. بيوضح اتجاه آخر 14 يوم للمحادثات الحقيقية
// مقابل المعلنة، عشان يجاوب سؤال "الوضع بيتحسن ولا بيتدهور؟" مش بس
// "الرقم دلوقتي كام".

"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface TrendPoint {
  date: string; // "MM/DD" مختصر للعرض
  verified: number;
  reported: number;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="verifiedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--verified)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--verified)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="reportedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gap)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--gap)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            stroke="var(--text-faint)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--text-muted)" }}
          />
          <Area
            type="monotone"
            dataKey="reported"
            stroke="var(--gap)"
            strokeWidth={1.5}
            fill="url(#reportedFill)"
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="verified"
            stroke="var(--verified)"
            strokeWidth={2}
            fill="url(#verifiedFill)"
            animationDuration={900}
            animationEasing="ease-out"
            animationBegin={150}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
