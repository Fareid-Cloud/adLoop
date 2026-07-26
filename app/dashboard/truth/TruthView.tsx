"use client";

// عرض قسم الحقيقة: لكل منصة صفٌّ يقارن الرقم المُعلن بالرقم المتحقق منه،
// بتصميم هادئ يعتمد على المقارنة المباشرة لا على كثرة العناصر.

import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";

export interface PlatformTruth {
  platform: string;
  hasData: boolean;
  cost: number;
  clicks: number;
  impressions: number;
  reported: number;
  verified: number;
  revenue: number;
  verificationRate: number;
  verificationChange: number | null;
  inflationRate: number;
  cplReported: number | null;
  cplVerified: number | null;
  wastedSpend: number;
  reportedSeries: number[];
  verifiedSeries: number[];
}

const PLATFORM_META: Record<string, { name: string; color: string }> = {
  GOOGLE_ADS: { name: "Google Ads", color: "#4285F4" },
  META_ADS: { name: "Meta Ads", color: "#0866FF" },
  TIKTOK_ADS: { name: "TikTok Ads", color: "#FE2C55" },
};

const num = (n: number) => n.toLocaleString("en-US");

/** رسم مزدوج: المُعلن مقابل المحقّق - الفجوة بينهما هي الرسالة */
function GapChart({ reported, verified }: { reported: number[]; verified: number[] }) {
  if (reported.length < 2) return null;
  const max = Math.max(...reported, ...verified, 1);
  const pts = (arr: number[]) =>
    arr.map((v, i) => `${(i / (arr.length - 1)) * 100},${34 - (v / max) * 30}`).join(" ");

  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-11 w-full">
      <polygon points={`0,36 ${pts(reported)} 100,36`} fill="var(--text-faint)" opacity="0.14" />
      <polyline points={pts(reported)} fill="none" stroke="var(--text-faint)" strokeWidth="1.4"
                strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
      <polyline points={pts(verified)} fill="none" stroke="var(--verified)" strokeWidth="2"
                vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function TruthView({
  workspaceName, currency, days, platforms,
}: {
  workspaceName: string;
  currency: string;
  days: number;
  platforms: PlatformTruth[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const active = platforms.filter((p) => p.hasData);
  const totals = active.reduce(
    (a, p) => ({
      cost: a.cost + p.cost,
      reported: a.reported + p.reported,
      verified: a.verified + p.verified,
      wasted: a.wasted + p.wastedSpend,
    }),
    { cost: 0, reported: 0, verified: 0, wasted: 0 }
  );
  const overallRate = totals.reported > 0 ? (totals.verified / totals.reported) * 100 : 0;

  function setDays(d: number) {
    const q = new URLSearchParams(params.toString());
    q.set("days", String(d));
    router.push(`/dashboard/truth?${q.toString()}`);
  }

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <div className="reveal mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] text-text-muted">{workspaceName}</div>
          <h1 className="flex items-center gap-2 text-[28px] font-semibold tracking-tight text-text-primary">
            <ShieldCheck size={24} className="text-verified" /> الحقيقة
          </h1>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-text-muted">
            ما تعلنه كل منصة مقابل ما تأكّد فعلاً عبر محادثة أو طلب حقيقي — الفارق بينهما هو ما تدفعه بلا مقابل.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] transition-colors ${
                      days === d ? "bg-accent font-medium text-white" : "text-text-muted hover:text-text-primary"
                    }`}>
              {d} يوم
            </button>
          ))}
        </div>
      </div>

      {active.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <ShieldCheck size={28} className="mx-auto mb-3 text-text-faint" />
          <p className="text-[14px] text-text-primary">لا توجد بيانات في هذه الفترة</p>
          <p className="mt-1 text-[12.5px] text-text-muted">اربط حساباً إعلانياً واختر حملاتك لتبدأ المقارنة.</p>
        </div>
      ) : (
        <>
          {/* الحصيلة الكلية */}
          <section className="reveal card-shadow mb-6 overflow-hidden rounded-2xl border border-border bg-surface"
                   style={{ animationDelay: "80ms" }}>
            <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:rtl:divide-x-reverse">
              <div className="p-5">
                <div className="text-[12px] text-text-muted">ما تعلنه المنصات</div>
                <div className="mt-1 font-mono text-[26px] font-semibold text-text-muted">{num(totals.reported)}</div>
                <div className="mt-0.5 text-[11.5px] text-text-faint">تحويلاً مُعلناً</div>
              </div>
              <div className="p-5">
                <div className="text-[12px] text-text-muted">ما تأكّد فعلاً</div>
                <div className="mt-1 font-mono text-[26px] font-semibold text-verified">{num(totals.verified)}</div>
                <div className="mt-0.5 text-[11.5px] text-text-faint">
                  نسبة التحقّق {Math.round(overallRate)}%
                </div>
              </div>
              <div className="p-5">
                <div className="text-[12px] text-text-muted">إنفاق بلا نتيجة مؤكدة</div>
                <div className="mt-1 font-mono text-[26px] font-semibold text-critical">
                  {num(totals.wasted)} <span className="text-[15px]">{currency}</span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-text-faint">خلال {days} يوماً</div>
              </div>
            </div>

            {/* شريط الفجوة */}
            <div className="border-t border-border px-5 py-4">
              <div className="mb-2 flex items-center justify-between text-[11.5px] text-text-muted">
                <span>المتحقق منه</span><span>المُعلن</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-surface-raised">
                <div className="h-full rounded-full bg-verified transition-all duration-700"
                     style={{ width: `${Math.min(overallRate, 100)}%` }} />
              </div>
            </div>
          </section>

          {/* لكل منصة */}
          <div className="flex flex-col gap-3">
            {active.map((p, i) => {
              const meta = PLATFORM_META[p.platform];
              const good = p.verificationRate >= 60;
              const tone = good ? "var(--verified)" : p.verificationRate >= 35 ? "var(--gap)" : "var(--critical)";
              const change = p.verificationChange;

              return (
                <section key={p.platform}
                         className="reveal card-shadow overflow-hidden rounded-2xl border border-border bg-surface"
                         style={{ animationDelay: `${160 + i * 90}ms` }}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl"
                            style={{ background: `color-mix(in srgb, ${meta.color} 13%, transparent)` }}>
                        <PlatformLogo platform={p.platform} size={19} />
                      </span>
                      <div>
                        <div className="text-[14px] font-semibold text-text-primary">{meta.name}</div>
                        <div className="text-[11.5px] text-text-muted">
                          {num(p.cost)} {currency} إنفاق · {num(p.clicks)} نقرة
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                            style={{ background: `color-mix(in srgb, ${tone} 13%, transparent)`, color: tone }}>
                        تحقّق {p.verificationRate}%
                      </span>
                      {change !== null && (
                        <span className="flex items-center gap-0.5 text-[11.5px] font-medium"
                              style={{ color: change > 0 ? "var(--verified)" : change < 0 ? "var(--critical)" : "var(--text-muted)" }}>
                          {change > 0 ? <TrendingUp size={12} /> : change < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                          {Math.abs(change)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.1fr]">
                    {/* المقارنات */}
                    <div className="flex flex-col gap-2.5">
                      <CompareRow label="التحويلات" reported={num(p.reported)} verified={num(p.verified)} />
                      <CompareRow
                        label="تكلفة العميل"
                        reported={p.cplReported !== null ? `${p.cplReported} ${currency}` : "—"}
                        verified={p.cplVerified !== null ? `${p.cplVerified} ${currency}` : "—"}
                        invert
                      />
                      <div className="flex items-center justify-between rounded-xl bg-surface-raised px-3 py-2.5">
                        <span className="text-[12px] text-text-muted">تضخيم المنصة</span>
                        <span className="font-mono text-[13px] font-semibold"
                              style={{ color: p.inflationRate > 40 ? "var(--critical)" : "var(--text-primary)" }}>
                          {p.inflationRate}%
                        </span>
                      </div>
                      {p.wastedSpend > 0 && (
                        <div className="flex items-center justify-between rounded-xl border border-critical/25 bg-critical/[0.05] px-3 py-2.5">
                          <span className="text-[12px] text-text-muted">إنفاق بلا نتيجة مؤكدة</span>
                          <span className="font-mono text-[13px] font-semibold text-critical">
                            {num(p.wastedSpend)} {currency}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* الرسم المزدوج */}
                    <div className="rounded-xl border border-border bg-surface-raised p-3">
                      <div className="mb-2 flex items-center gap-3 text-[11px] text-text-muted">
                        <span className="flex items-center gap-1.5">
                          <span className="h-0.5 w-4 rounded-full bg-verified" /> المتحقق
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-0.5 w-4 rounded-full bg-text-faint" style={{ opacity: .7 }} /> المُعلن
                        </span>
                      </div>
                      <GapChart reported={p.reportedSeries} verified={p.verifiedSeries} />
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CompareRow({
  label, reported, verified, invert = false,
}: {
  label: string; reported: string; verified: string; invert?: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface-raised px-3 py-2.5">
      <div className="mb-1.5 text-[11.5px] text-text-muted">{label}</div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[13px] text-text-muted line-through decoration-text-faint/50">
          {reported}
        </span>
        <span className="text-[11px] text-text-faint">←</span>
        <span className="font-mono text-[14px] font-semibold" style={{ color: invert ? "var(--gap)" : "var(--verified)" }}>
          {verified}
        </span>
      </div>
    </div>
  );
}
