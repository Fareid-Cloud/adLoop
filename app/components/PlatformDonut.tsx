// app/components/PlatformDonut.tsx
//
// توزيع التحويلات المحقّقة حسب المنصة.
//
// الألوان من `platformMeta` لا من لوحة عامة بالفهرس. اللوحة السابقة كانت
// ترسم تيك توك أزرق وجوجل أخضر - ألوان لا علاقة لها بأي منصة، فتنهار
// الذاكرة البصرية التي يبنيها بقية المنتج (الشارات، كروت الربط، الفلاتر).
// تقارب أزرق جوجل وأزرق ميتا ليس مشكلة هنا: الشريحتان مفصولتان بفراغ،
// وكل سطر في الليجند يحمل شعار منصّته.

"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { platformMeta } from "@/lib/platformMeta";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function PlatformDonut({
  data,
  locale = "ar",
}: {
  data: { platform: string; value: number }[];
  locale?: Locale;
}) {
  const rows = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const meta = platformMeta(d.platform);
      return { ...d, label: meta.label, color: meta.color };
    });
  const total = rows.reduce((s, r) => s + r.value, 0);

  if (rows.length === 0 || total === 0) return null;

  return (
    <div className="card pad-lg">
      <div className="mb-3 text-[13px] text-text-muted">{t(locale, "home.donutTitle")}</div>
      <div className="flex items-center gap-4">
        <div className="relative h-[150px] w-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="label"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
                animationDuration={800}
              >
                {rows.map((r) => (
                  <Cell key={r.platform} fill={r.color} />
                ))}
              </Pie>
              <Tooltip
                // يخرج من إطار الرسم بدل أن يستقرّ فوق الرقم في المنتصف -
                // كان النصّان يتراكبان فلا يُقرأ أيّ منهما.
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 30 }}
                contentStyle={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 8px 24px rgb(0 0 0 / 0.18)",
                }}
                labelStyle={{ color: "var(--text-muted)" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-xl font-semibold text-verified">
              {total.toLocaleString("en-US")}
            </span>
            <span className="text-[10px] text-text-faint">{t(locale, "home.donutVerified")}</span>
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
              <span className="font-mono text-text-primary">
                {Math.round((r.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
