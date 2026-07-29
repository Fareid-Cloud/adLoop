"use client";

// عرض قسم الحقيقة.
//
// الترتيب مقصود ويتبع سؤال المستخدم لا بنية البيانات:
//   ١) ما حجم الفجوة؟            → شبكة المؤشّرات
//   ٢) أين تقع بالضبط؟           → مقارنة المنصات
//   ٣) من يستحق الفضل فعلاً؟     → مقارنة نماذج الإسناد
//   ٤) كيف تبدو الرحلة؟          → إحصاءات الرحلة والتسلسلات
//   ٥) ماذا نفعل بذلك؟           → إعادة رفع التحويلات للمنصات

import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck, Target, Wallet, Percent, AlertTriangle, TrendingUp, Users,
  GitBranch, Layers, Radar, Send, Gauge, Clock,
} from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { AttributionModelTable } from "./AttributionModelTable";
import type { TruthSnapshot } from "@/lib/truthKpis";

const PLATFORM_META: Record<string, { name: string; color: string }> = {
  GOOGLE_ADS: { name: "Google Ads", color: "#4285F4" },
  META_ADS: { name: "Meta Ads", color: "#0866FF" },
  TIKTOK_ADS: { name: "TikTok Ads", color: "#FE2C55" },
  SNAPCHAT_ADS: { name: "Snapchat Ads", color: "#FFFC00" },
};

const num = (n: number) => Math.round(n).toLocaleString("en-US");

/** رسم مزدوج: المُعلن مقابل المتحقّق - الفجوة بينهما هي الرسالة */
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
  workspaceName,
  currency,
  snapshot,
}: {
  workspaceName: string;
  currency: string;
  snapshot: TruthSnapshot;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { totals, previousTotals, platforms, journey, sync } = snapshot;

  const active = platforms.filter((p) => p.hasData);

  function setDays(d: number) {
    const next = new URLSearchParams(params.toString());
    next.set("days", String(d));
    router.push(`/dashboard/truth?${next.toString()}`);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspaceName}</div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2.5 text-[26px] font-semibold text-text-primary">
          <ShieldCheck size={24} className="text-verified" />
          الحقيقة
        </h1>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                snapshot.days === d
                  ? "bg-accent/10 text-accent"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {d} يوماً
            </button>
          ))}
        </div>
      </div>
      <p className="mb-6 max-w-3xl text-[13px] leading-relaxed text-text-muted">
        الفارق بين ما تُعلنه المنصات وما تحقّق فعلاً. كل رقم هنا مبنيّ على تحويل تأكّد بمصدر مستقلّ
        (رسالة حقيقية، طلب مؤكَّد) لا على ما ادّعته المنصة لنفسها.
      </p>

      {/* ============ ١) شبكة المؤشّرات ============ */}
      <SectionTitle icon={Gauge}>مؤشّرات الحقيقة</SectionTitle>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="تحويلات معلَنة"
          value={num(totals.reported)}
          icon={Target}
          tone="neutral"
          verified={false}
          caption={{ text: "ما تقوله لوحات المنصات", tone: "muted" }}
        />
        <MetricCard
          label="تحويلات متحقّق منها"
          value={num(totals.verified)}
          icon={ShieldCheck}
          tone="verified"
          verified
          caption={{ text: "ما تأكّد بمصدر مستقلّ", tone: "positive" }}
        />
        <MetricCard
          label="نسبة التحقّق"
          value={totals.verificationRatePct}
          unit="%"
          icon={Percent}
          tone={totals.verificationRatePct >= 60 ? "verified" : totals.verificationRatePct >= 30 ? "gap" : "critical"}
          delta={
            totals.verificationChangePp !== null
              ? {
                  value: `${Math.abs(totals.verificationChangePp)} نقطة`,
                  direction: totals.verificationChangePp >= 0 ? "up" : "down",
                  positive: totals.verificationChangePp >= 0,
                  caption: "عن الفترة السابقة",
                }
              : undefined
          }
          bar={{ pct: totals.verificationRatePct }}
        />
        <MetricCard
          label="نسبة التضخّم"
          value={totals.inflationRatePct}
          unit="%"
          icon={AlertTriangle}
          tone={totals.inflationRatePct >= 50 ? "critical" : "gap"}
          caption={{ text: "من الأرقام المعلَنة لم يتأكّد", tone: "warning" }}
        />

        <MetricCard
          label="الإنفاق الكلّي"
          value={num(totals.cost)}
          unit={currency}
          icon={Wallet}
          tone="accent"
        />
        <MetricCard
          label="إنفاق بلا تحويل مؤكَّد"
          value={num(totals.wastedSpend)}
          unit={currency}
          icon={AlertTriangle}
          tone="critical"
          delta={
            previousTotals
              ? {
                  value: pctChange(previousTotals.wastedSpend, totals.wastedSpend),
                  direction: totals.wastedSpend >= previousTotals.wastedSpend ? "up" : "down",
                  positive: totals.wastedSpend < previousTotals.wastedSpend,
                  caption: "عن الفترة السابقة",
                }
              : undefined
          }
          caption={{
            text: `${pctOf(totals.wastedSpend, totals.cost)}% من إنفاقك`,
            tone: "negative",
          }}
        />
        <MetricCard
          label="تكلفة العميل المعلَنة"
          value={totals.cpaReported !== null ? num(totals.cpaReported) : "—"}
          unit={totals.cpaReported !== null ? currency : undefined}
          icon={Users}
          tone="neutral"
          verified={false}
        />
        <MetricCard
          label="تكلفة العميل الحقيقية"
          value={totals.cpaVerified !== null ? num(totals.cpaVerified) : "—"}
          unit={totals.cpaVerified !== null ? currency : undefined}
          icon={Users}
          tone="critical"
          verified
          caption={
            totals.cpaGapAmount !== null
              ? { text: `أغلى بـ${num(totals.cpaGapAmount)} ${currency} عن الرقم المعلَن`, tone: "negative" }
              : { text: "لا توجد تحويلات متحقّق منها بعد", tone: "muted" }
          }
        />

        <MetricCard
          label="العائد المعلَن"
          value={totals.roasReported !== null ? `${totals.roasReported}` : "—"}
          unit={totals.roasReported !== null ? "x" : undefined}
          icon={TrendingUp}
          tone="neutral"
          verified={false}
          caption={
            totals.roasReported === null
              ? { text: "يتطلّب ربط متجر لقراءة الإيراد", tone: "muted" }
              : undefined
          }
        />
        <MetricCard
          label="العائد المتحقّق"
          value={totals.roasVerified !== null ? `${totals.roasVerified}` : "—"}
          unit={totals.roasVerified !== null ? "x" : undefined}
          icon={TrendingUp}
          tone="verified"
          verified
        />
        <MetricCard
          label="رحلات متعددة اللمسات"
          value={journey.multiTouchRatePct}
          unit="%"
          icon={GitBranch}
          tone="accent"
          caption={{
            text: `متوسط ${journey.avgTouchesPerConversion} لمسة قبل التحويل`,
            tone: "muted",
          }}
        />
        <MetricCard
          label="رحلات عبر أكثر من منصة"
          value={journey.crossPlatformRatePct}
          unit="%"
          icon={Layers}
          tone="gap"
          caption={{
            text:
              journey.crossPlatformPaths > 0
                ? "لا يمكن لأي لوحة منصة منفردة أن تراها كاملة"
                : "لا توجد رحلات عابرة للمنصات في هذه الفترة",
            tone: journey.crossPlatformPaths > 0 ? "warning" : "muted",
          }}
        />
      </div>

      {/* ============ ٢) مقارنة المنصات ============ */}
      <SectionTitle icon={Radar}>الفجوة لكل منصة</SectionTitle>
      {active.length === 0 ? (
        <EmptyNote>لا توجد بيانات في هذه الفترة. اربط حساباً إعلانياً أو وسّع المدة.</EmptyNote>
      ) : (
        <>
          <div className="mb-3 grid gap-3 lg:grid-cols-2">
            {active.map((p) => {
              const meta = PLATFORM_META[p.platform] ?? { name: p.platform, color: "#888" };
              return (
                <div key={p.platform} className="card-shadow rounded-2xl border border-border bg-surface p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-text-primary">
                      <PlatformLogo platform={p.platform} size={16} />
                      {meta.name}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
                        p.verificationRatePct >= 60
                          ? "bg-verified/10 text-verified"
                          : p.verificationRatePct >= 30
                            ? "bg-gap/10 text-gap"
                            : "bg-critical/10 text-critical"
                      }`}
                    >
                      {p.verificationRatePct}% تحقّق
                    </span>
                  </div>

                  {/* شريط المقارنة المباشر - المعلَن كامل العرض، والمتحقّق جزء منه */}
                  <div className="mb-1 flex items-center justify-between text-[12px] text-text-faint">
                    <span>معلَن {num(p.reported)}</span>
                    <span className="text-verified">متحقّق {num(p.verified)}</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                    <div className="absolute inset-y-0 start-0 rounded-full bg-text-faint/30" style={{ width: "100%" }} />
                    <div
                      className="absolute inset-y-0 start-0 rounded-full bg-verified"
                      style={{ width: `${Math.min(100, p.verificationRatePct)}%` }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-[12px]">
                    <MiniStat label="الإنفاق" value={num(p.cost)} />
                    <MiniStat
                      label="تكلفة حقيقية"
                      value={p.cpaVerified !== null ? num(p.cpaVerified) : "—"}
                      hint={
                        p.cpaUnderstatementPct !== null
                          ? `أعلى بـ${p.cpaUnderstatementPct}% عن المعلَن`
                          : undefined
                      }
                    />
                    <MiniStat label="العائد" value={p.roasVerified !== null ? `${p.roasVerified}x` : "—"} />
                    <MiniStat label="بلا تأكيد" value={num(p.wastedSpend)} negative />
                  </div>

                  <div className="mt-2">
                    <GapChart reported={p.reportedSeries} verified={p.verifiedSeries} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mb-8 text-[12px] text-text-faint">
            الخطّ المتقطّع: ما أعلنته المنصة. الخطّ المتّصل: ما تأكّد فعلاً. المسافة بينهما هي ما تدفع ثمنه بلا مقابل مؤكَّد.
          </p>
        </>
      )}

      {/* ============ ٣) نماذج الإسناد ============ */}
      <SectionTitle icon={GitBranch}>من يستحق الفضل؟ — ثمانية نماذج جنباً إلى جنب</SectionTitle>
      {!snapshot.hasTouchpointData ? (
        <EmptyNote>
          لم تُسجَّل لمسات بعد، فلا يمكن حساب أي نموذج إسناد غير «آخر لمسة». المقارنة بين النماذج تتطلّب
          معرفة الرحلة كاملة لا نقطتها الأخيرة — يبدأ التقاطها فور تركيب وسم AdLoop على صفحاتك.
          {snapshot.totalTrackedConversions > 0 && (
            <>
              {" "}
              لدينا {num(snapshot.totalTrackedConversions)} تحويلاً مسجَّلاً في هذه الفترة، لكن بلا لمسات مرتبطة به.
            </>
          )}
        </EmptyNote>
      ) : (
        <div className="mb-8">
          <AttributionModelTable
            rows={snapshot.modelRows}
            channelRows={snapshot.channelRows}
            currency={currency}
            pathCoveragePct={snapshot.pathCoveragePct}
            conversionsWithoutTouches={snapshot.conversionsWithoutTouches}
            unbackedClaims={snapshot.unbackedClaims}
          />
        </div>
      )}

      {/* ============ ٣ب) المحرّك الاحتمالي - طبقة مكمّلة لا بديلة ============ */}
      {(snapshot.probabilistic.verifiedCount > 0 || snapshot.probabilistic.modeledCount > 0) && (
        <>
          <SectionTitle icon={Radar}>المحادثات التي وصلت بلا كود مطابق</SectionTitle>
          <div className="mb-3 card-shadow rounded-2xl border border-border bg-surface p-4">
            <p className="mb-3 text-[12.5px] leading-relaxed text-text-muted">
              طبقة مستقلّة عن نماذج الإسناد أعلاه وتكمّلها: تلك تسأل «من يستحقّ الفضل في الرحلة؟»،
              وهذه تسأل سؤالاً أضيق — «هذه محادثة وصلت بلا كود إطلاقاً، من أي منصة جاءت على الأرجح؟»
              (تطابق هاتف، ثم قرب زمني بتلاشٍ، ثم نمط ساعة، ثم نسبة أساس). المؤكَّد لا يُخلط بالمُرجَّح.
            </p>

            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="مؤكّدة بكود"
                value={num(snapshot.probabilistic.verifiedCount)}
                icon={ShieldCheck}
                tone="verified"
                verified
                caption={{ text: "الكود نفسه هو الدليل — يقين لا ترجيح", tone: "positive" }}
              />
              <MetricCard
                label="مُنسّبة احتمالياً"
                value={num(snapshot.probabilistic.modeledCount)}
                icon={GitBranch}
                tone="gap"
                verified={false}
                caption={{ text: "أفضل تقدير متاح، لا حقيقة مؤكَّدة", tone: "warning" }}
              />
              <MetricCard
                label="نسبة ما احتاج ترجيحاً"
                value={snapshot.probabilistic.modeledSharePct}
                unit="%"
                icon={Percent}
                tone={snapshot.probabilistic.modeledSharePct > 40 ? "critical" : "default"}
                bar={{ pct: snapshot.probabilistic.modeledSharePct }}
                caption={{
                  text:
                    snapshot.probabilistic.modeledSharePct > 40
                      ? "مرتفعة — أغلب العملاء يمسحون نصّ الرسالة الجاهز قبل الإرسال"
                      : "ضمن المعقول",
                  tone: snapshot.probabilistic.modeledSharePct > 40 ? "negative" : "muted",
                }}
              />
            </div>

            {snapshot.probabilistic.byPlatform.length > 0 && (
              <div>
                <div className="mb-2 text-[12.5px] font-medium text-text-muted">
                  توزيع الترجيح على المنصات
                </div>
                <div className="flex flex-col gap-2">
                  {snapshot.probabilistic.byPlatform.map((row) => {
                    const total = snapshot.probabilistic.byPlatform.reduce((s, r) => s + r.conversions, 0);
                    const pct = total > 0 ? (row.conversions / total) * 100 : 0;
                    return (
                      <div key={row.platform}>
                        <div className="mb-1 flex items-center justify-between text-[12px]">
                          <span className="flex items-center gap-1.5 text-text-primary">
                            <PlatformLogo platform={row.platform} size={13} />
                            {PLATFORM_META[row.platform]?.name ?? row.platform}
                          </span>
                          <span className="tabular-nums text-text-muted">
                            {row.conversions} ({Math.round(pct)}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                          <div className="h-full rounded-full bg-gap" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <p className="mb-8 text-[12px] leading-relaxed text-text-faint">
            الأرقام كسرية عمداً: المحادثة الواحدة تُوزَّع على أكثر من منصة بنسب احتمالية بدل إسنادها
            كاملةً لواحدة بثقة لا نملكها.
          </p>
        </>
      )}

      {/* ============ ٤) الرحلة ============ */}
      {journey.totalPaths > 0 && (
        <>
          <SectionTitle icon={Clock}>شكل الرحلة</SectionTitle>
          <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="رحلات مكتملة" value={num(journey.totalPaths)} icon={GitBranch} tone="accent" />
            <MetricCard
              label="متوسط اللمسات"
              value={journey.avgTouchesPerConversion}
              icon={Layers}
              tone="default"
              subLabel="لمسة لكل تحويل"
            />
            <MetricCard
              label="متوسط مدّة القرار"
              value={journey.avgDaysToConvert}
              unit="يوم"
              icon={Clock}
              tone="default"
              subLabel="من أول لمسة حتى الشراء"
            />
            <MetricCard
              label="رحلات بلمسة واحدة"
              value={journey.singleTouchPaths}
              icon={Target}
              tone="neutral"
              caption={{
                text: `${100 - journey.multiTouchRatePct}% من الرحلات`,
                tone: "muted",
              }}
            />
          </div>

          {journey.topSequences.length > 0 && (
            <div className="mb-8 card-shadow rounded-2xl border border-border bg-surface p-4">
              <div className="mb-3 text-[13px] font-medium text-text-muted">أكثر المسارات تكراراً</div>
              <div className="flex flex-col gap-2">
                {journey.topSequences.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {s.sequence.map((step, j) => (
                        <span key={j} className="flex items-center gap-1.5">
                          {j > 0 && <span className="text-text-faint">←</span>}
                          <span className="rounded-md bg-surface-raised px-2 py-0.5 text-[12px] text-text-primary">
                            {PLATFORM_META[step]?.name ?? channelLabel(step)}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-[12px] tabular-nums">
                      <span className="text-text-muted">{s.count} رحلة</span>
                      {s.revenue > 0 && (
                        <span className="font-medium text-verified">
                          {num(s.revenue)} {currency}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============ ٥) إعادة الرفع ============ */}
      <SectionTitle icon={Send}>إعادة رفع التحويلات للمنصات</SectionTitle>
      <div className="card-shadow rounded-2xl border border-border bg-surface p-4">
        {!sync.enabled ? (
          <div>
            <p className="mb-2 text-[13px] leading-relaxed text-text-primary">
              كشف الفجوة يجعلك أدرى، لكنه لا يغيّر شيئاً في المزاد بذاته.
            </p>
            <p className="mb-3 text-[12.5px] leading-relaxed text-text-muted">
              خوارزمية كل منصة تتعلّم ممّا تُطعمها إياه. حين ترى نقرات ورسائل عابرة فقط، تجلب المزيد منها.
              وحين نُعيد إليها العميل الدافع فعلاً عبر الخادم، تتغيّر دالّة التحسين لديها فتبحث عن أشباهه.
              التفعيل من الإعدادات، ويحتاج معرّف البكسل وتوكن الأحداث لكل منصة.
            </p>
            <a
              href="/dashboard/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-[12.5px] font-medium text-accent no-underline transition-colors hover:bg-accent/20"
            >
              <Send size={14} />
              تفعيل إعادة الرفع
            </a>
          </div>
        ) : (
          <>
            <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="أحداث مرفوعة" value={num(sync.sentEvents)} icon={Send} tone="verified" />
              <MetricCard
                label="متوسط جودة المطابقة"
                value={sync.avgMatchQuality !== null ? sync.avgMatchQuality : "—"}
                unit={sync.avgMatchQuality !== null ? "/10" : undefined}
                icon={Gauge}
                tone={
                  sync.avgMatchQuality === null ? "neutral"
                    : sync.avgMatchQuality >= 8 ? "verified"
                      : sync.avgMatchQuality >= 6 ? "gap" : "critical"
                }
                bar={sync.avgMatchQuality !== null ? { pct: sync.avgMatchQuality * 10 } : undefined}
              />
              <MetricCard
                label="تخطّي (مطابقة ضعيفة)"
                value={num(sync.skippedEvents)}
                icon={AlertTriangle}
                tone="gap"
              />
              <MetricCard label="فشل الرفع" value={num(sync.failedEvents)} icon={AlertTriangle} tone="critical" />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
              <span>المنصات المفعَّلة:</span>
              {sync.configuredPlatforms.length === 0 ? (
                <span className="text-gap">لا توجد منصة مضبوطة بالكامل بعد.</span>
              ) : (
                sync.configuredPlatforms.map((p) => (
                  <span key={p} className="flex items-center gap-1 rounded-md bg-surface-raised px-2 py-0.5">
                    <PlatformLogo platform={p} size={12} />
                    {PLATFORM_META[p]?.name ?? p}
                  </span>
                ))
              )}
            </div>

            {sync.topSkipReason && (
              <p className="mt-2 text-[12px] leading-relaxed text-text-faint">
                أكثر أسباب التخطّي تكراراً: {sync.topSkipReason}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Gauge; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-text-primary">
      <Icon size={16} className="text-text-muted" />
      {children}
    </h2>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-8 rounded-2xl border border-border bg-surface p-4 text-[12.5px] leading-relaxed text-text-muted">
      {children}
    </p>
  );
}

function MiniStat({
  label, value, hint, negative,
}: {
  label: string; value: string; hint?: string; negative?: boolean;
}) {
  return (
    <div>
      <div className="text-text-faint">{label}</div>
      <div className={`mt-0.5 font-medium tabular-nums ${negative ? "text-critical" : "text-text-primary"}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] leading-tight text-critical">{hint}</div>}
    </div>
  );
}

function pctOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function pctChange(prev: number, now: number): string {
  if (prev <= 0) return "—";
  return `${Math.abs(Math.round(((now - prev) / prev) * 100))}%`;
}

const CHANNEL_LABELS: Record<string, string> = {
  PAID_SEARCH: "بحث مدفوع",
  PAID_SOCIAL: "تواصل مدفوع",
  PAID_VIDEO: "فيديو مدفوع",
  ORGANIC_SEARCH: "بحث عضوي",
  ORGANIC_SOCIAL: "تواصل عضوي",
  DIRECT: "مباشر",
  REFERRAL: "إحالة",
  EMAIL: "بريد",
  CRM: "نظام العميل",
  OTHER: "أخرى",
};

function channelLabel(key: string): string {
  return CHANNEL_LABELS[key] ?? key;
}

export { CHANNEL_LABELS };
