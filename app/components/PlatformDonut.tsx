// app/components/PlatformDonut.tsx
//
// توزيع التحويلات المحقّقة حسب المنصة. لون مميّز لكل شريحة (palette مرتّبة
// بالفهرس) عشان مفيش تصادم ألوان (Google/Meta الاتنين أزرق مثلاً)، وهوية
// المنصة بتبان من اللوجو في الليجند. كل المنصات اللي ليها قيمة بتظهر.
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { platformMeta } from "@/lib/platformMeta";
import { PlatformLogo } from "@/app/components/PlatformLogo";

// palette فئوية عالية التباين - كل عنصر مختلف بوضوح عن اللي جنبه
const PALETTE = ["#3B82F6", "#22C55E", "#A855F7", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#14B8A6"];

export function PlatformDonut({ data }: { data: { platform: string; value: number }[] }) {
  const rows = data
    .filter((d) => d.value > 0)
    .map((d, i) => ({ ...d, label: platformMeta(d.platform).label, color: PALETTE[i % PALETTE.length] }));
  const total = rows.reduce((s, r) => s + r.value, 0);

  if (rows.length === 0 || total === 0) return null;

  return (
    <div className="rounded-2xl card-shadow border border-border bg-surface p-6">
      <div className="mb-3 text-[13px] text-text-muted">التحويلات المحقّقة حسب المصدر</div>
      <div className="flex items-center gap-4">
        <div className="relative h-[150px] w-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none" animationDuration={800}>
                {rows.map((r) => (
                  <Cell key={r.platform} fill={r.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "var(--text-muted)" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-xl font-semibold text-verified">{total.toLocaleString("en-US")}</span>
            <span className="text-[10px] text-text-faint">محقّق ✓</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {rows.map((r) => (
            <div key={r.platform} className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2 text-text-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                <PlatformLogo platform={r.platform} size={15} />
                {r.label}
              </span>
              <span className="font-mono text-text-primary">{Math.round((r.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
