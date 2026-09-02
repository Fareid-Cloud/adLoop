"use client";

// app/admin/analytics/tabs/Charts.tsx
//
// الرسوم في اللوحة - **مكوّن عميل واحد لكل شكل، والتبويبات مكوّنات خادم.**
//
// Recharts محتاجة المتصفّح، فأي تبويب يستوردها مباشرةً بيتحوّل كله لمكوّن
// عميل - يعني كل استعلامات قاعدة البيانات فيه لازم تتنقل لمكان تاني.
// عزل الرسوم هنا بيخلّي التبويبات تفضل على الخادم زي ما هي.

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

/** ألوان دلالية من نفس متغيّرات النظام - مش لوحة ألوان تانية للوحة */
const TONE = {
  accent: "var(--accent)",
  verified: "var(--verified)",
  gap: "var(--gap)",
  critical: "var(--critical)",
  faint: "var(--text-faint)",
} as const;

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--text-primary)",
} as const;

export function AreaTrend({
  data,
  xKey,
  yKey,
  tone = "accent",
  height = 200,
  label,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  tone?: keyof typeof TONE;
  height?: number;
  label?: string;
}) {
  if (data.length < 2) {
    return <EmptyChart height={height} />;
  }
  const id = `fill-${yKey}-${tone}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TONE[tone]} stopOpacity={0.32} />
              <stop offset="100%" stopColor={TONE[tone]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} stroke={TONE.faint} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke={TONE.faint} fontSize={11} tickLine={false} axisLine={false} width={48} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v.toLocaleString("en-US"), label ?? yKey]} />
          <Area type="monotone" dataKey={yKey} stroke={TONE[tone]} strokeWidth={2} fill={`url(#${id})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarSeries({
  data,
  xKey,
  bars,
  height = 200,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  bars: Array<{ key: string; tone: keyof typeof TONE; label: string }>;
  height?: number;
}) {
  if (data.length === 0) return <EmptyChart height={height} />;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} stroke={TONE.faint} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke={TONE.faint} fontSize={11} tickLine={false} axisLine={false} width={48} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-raised)" }} />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.label} fill={TONE[b.tone]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const DONUT_COLORS = [TONE.accent, TONE.verified, TONE.gap, TONE.critical, "#8B95A3", "#5C6478"];

export function Donut({
  data,
  height = 200,
  emptyMessage = "Nothing to split yet — this fills in once there is something to divide.",
}: {
  data: Array<{ name: string; value: number }>;
  height?: number;
  /** ليه الدونات فاضية - بيختلف باختلاف اللي بتقسّمه. */
  emptyMessage?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyChart height={height} message={emptyMessage} />;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2} stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number, n: string) => [`${v.toLocaleString("en-US")} (${((v / total) * 100).toFixed(0)}%)`, n]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * **الغياب صريح مش رسم فاضي.**
 *
 * محاور بلا خطّ بتتقري "الرقم صفر"، والحقيقة غالباً "مافيش بيانات كفاية
 * بعد" - وهما قراءتان مختلفتان تماماً لمالك بيقيّم منتجه.
 */
/**
 * الحالة الفاضية للرسوم.
 *
 * **الرسالة بتتقال لا بتتفترض:** كانت واحدة لكلّ الرسوم - "Not enough
 * history yet to draw a trend" - وهي صحيحة للاتجاه الزمنيّ وغلط تماماً
 * تحت دونات "MRR بالباقة": مفيش تاريخ ولا اتجاه في السؤال ده أصلاً، فيه
 * "مافيش عملاء دافعين لسه". والقارئ بيدوّر على تاريخ ناقص وهو عنده مشكلة
 * تانية خالص.
 */
function EmptyChart({ height, message }: { height: number; message?: string }) {
  return (
    <div
      style={{ height }}
      className="flex w-full items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-[12px] text-text-faint"
    >
      {message ?? "Not enough history yet to draw a trend."}
    </div>
  );
}
