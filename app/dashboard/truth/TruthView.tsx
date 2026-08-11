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
import { Sparkline } from "@/app/components/ui/Sparkline";
import { AttributionModelTable } from "./AttributionModelTable";
import type { TruthSnapshot } from "@/lib/truthKpis";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";
import { PageHeader } from "@/app/components/ui/PageHeader";

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
  locale,
  periodSlot,
}: {
  workspaceName: string;
  currency: string;
  snapshot: TruthSnapshot;
  locale: Locale;
  /** منتقي الفترة الموحَّد - يُبنى في الصفحة (خادم) ويُمرَّر إلى هنا */
  periodSlot?: React.ReactNode;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `truthPage.${k}`, v);
  const router = useRouter();
  const params = useSearchParams();
  const { totals, previousTotals, platforms, journey, sync } = snapshot;

  const active = platforms.filter((p) => p.hasData);

  return (
    <div className="mx-auto max-w-6xl">
      {/* الرأس المشترك لا رأسٌ خاصّ: كانت الأيقونة هنا مرسومةً داخل `<h1>`
          بحجمٍ ولونٍ يخصّان هذه الصفحة وحدها، فبدت مختلفةً عن كلّ قسم آخر.
          `PageHeader` يعطي الشكل نفسه لكلّ الأقسام - وهو المطلوب.

          🔴 وأزرار المدّة: كانت ثلاثة (٧ / ٣٠ / ٩٠) خاصّة بهذه الصفحة،
          بينما `PeriodBar` الموحَّد مستورَدٌ ولا يُصيَّر. أداتان تتحكّمان في
          المدّة نفسها ولا تعرف إحداهما الأخرى. الموحَّد وحده يبقى. */}
      <PageHeader
        icon={ShieldCheck}
        tone="verified"
        eyebrow={workspaceName}
        title={tr("heading")}
        description={tr("lead")}
        actions={periodSlot}
      />

      {/* ============ ١) شبكة المؤشّرات ============ */}
      <SectionTitle icon={Gauge}>{tr("kpis")}</SectionTitle>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={tr("reportedCard")}
          value={num(totals.reported)}
          icon={Target}
          tone="neutral"
          verified={false}
          caption={{ text: tr("reportedCardHint"), tone: "muted" }}
          explainKey="reportedConversions"
          locale={locale}
          trend={<Sparkline values={totals.reportedSeries} tone="accent" />}
        />
        <MetricCard
          label={tr("verifiedCard")}
          value={num(totals.verified)}
          icon={ShieldCheck}
          tone="verified"
          verified
          caption={{ text: tr("verifiedCardHint"), tone: "positive" }}
          explainKey="verifiedConversions"
          locale={locale}
          // الاتّجاه بلون التحقّق: الخطّ يقول «إلى أين يسير الرقم»، وهي
          // معلومةٌ لا يحملها الرقم وحده.
          trend={<Sparkline values={totals.verifiedSeries} tone="verified" />}
        />
        <MetricCard
          label={tr("verificationRate")}
          value={totals.verificationRatePct}
          unit="%"
          icon={Percent}
          tone={totals.verificationRatePct >= 60 ? "verified" : totals.verificationRatePct >= 30 ? "gap" : "critical"}
          delta={
            totals.verificationChangePp !== null
              ? {
                  value: tr("points", { n: Math.abs(totals.verificationChangePp) }),
                  direction: totals.verificationChangePp >= 0 ? "up" : "down",
                  positive: totals.verificationChangePp >= 0,
                  caption: tr("vsPrev"),
                }
              : undefined
          }
          bar={{ pct: totals.verificationRatePct }}
          explainKey="verificationRate"
          locale={locale}
        />
        <MetricCard
          label={tr("inflationCard")}
          value={totals.inflationRatePct}
          unit="%"
          icon={AlertTriangle}
          tone={totals.inflationRatePct >= 50 ? "critical" : "gap"}
          caption={{ text: tr("inflationCardHint"), tone: "warning" }}
          explainKey="inflationRate"
          locale={locale}
        />

        <MetricCard
          label={tr("totalSpend")}
          value={num(totals.cost)}
          unit={currency}
          icon={Wallet}
          tone="accent"
          explainKey="cost"
          locale={locale}
        />
        <MetricCard
          label={tr("wastedSpend")}
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
                  caption: tr("vsPrevPeriod"),
                }
              : undefined
          }
          caption={{ text: tr("wastedHint", { pct: pctOf(totals.wastedSpend, totals.cost) }), tone: "negative" }}
          explainKey="wastedSpend"
          locale={locale}
        />
        <MetricCard
          label={tr("cpaReported")}
          value={totals.cpaReported !== null ? num(totals.cpaReported) : "—"}
          unit={totals.cpaReported !== null ? currency : undefined}
          icon={Users}
          tone="neutral"
          verified={false}
          explainKey="cpaReported"
          locale={locale}
        />
        <MetricCard
          label={tr("cpaVerified")}
          value={totals.cpaVerified !== null ? num(totals.cpaVerified) : "—"}
          unit={totals.cpaVerified !== null ? currency : undefined}
          icon={Users}
          tone="critical"
          verified
          caption={
            totals.cpaGapAmount !== null
              ? { text: tr("cpaGap", { amount: `${num(totals.cpaGapAmount)} ${currency}` }), tone: "negative" }
              : { text: tr("noVerifiedYet"), tone: "muted" }
          }
          explainKey="cpaVerified"
          locale={locale}
        />

        <MetricCard
          label={tr("roasReported")}
          value={totals.roasReported !== null ? `${totals.roasReported}` : "—"}
          unit={totals.roasReported !== null ? "x" : undefined}
          icon={TrendingUp}
          tone="neutral"
          verified={false}
          caption={
            totals.roasReported === null
              ? { text: tr("roasNeedsStore"), tone: "muted" }
              : undefined
          }
          explainKey="roas"
          locale={locale}
        />
        <MetricCard
          label={tr("roasVerified")}
          value={totals.roasVerified !== null ? `${totals.roasVerified}` : "—"}
          unit={totals.roasVerified !== null ? "x" : undefined}
          icon={TrendingUp}
          tone="verified"
          verified
          explainKey="roas"
          locale={locale}
        />
        <MetricCard
          label={tr("multiTouch")}
          value={journey.multiTouchRatePct}
          unit="%"
          icon={GitBranch}
          tone="accent"
          caption={{ text: tr("multiTouchHint", { n: journey.avgTouchesPerConversion }), tone: "muted" }}
          explainKey="multiTouch"
          locale={locale}
        />
        <MetricCard
          label={tr("crossPlatform")}
          value={journey.crossPlatformRatePct}
          unit="%"
          icon={Layers}
          tone="gap"
          caption={{
            text: journey.crossPlatformPaths > 0 ? tr("crossPlatformWarn") : tr("crossPlatformNone"),
            tone: journey.crossPlatformPaths > 0 ? "warning" : "muted",
          }}
          explainKey="crossPlatform"
          locale={locale}
        />
      </div>

      {/* ============ ٢) مقارنة المنصات ============ */}
      <SectionTitle icon={Radar}>{tr("gapPerPlatform")}</SectionTitle>
      {active.length === 0 ? (
        <EmptyNote>{tr("gapEmpty")}</EmptyNote>
      ) : (
        <>
          <div className="mb-3 grid gap-3 lg:grid-cols-2">
            {active.map((p) => {
              const meta = PLATFORM_META[p.platform] ?? { name: p.platform, color: "#888" };
              return (
                <div key={p.platform} className="card pad-md">
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
                      {tr("verifiedPct", { pct: p.verificationRatePct })}
                    </span>
                  </div>

                  {/* شريط المقارنة المباشر - المعلَن كامل العرض، والمتحقّق جزء منه */}
                  <div className="mb-1 flex items-center justify-between text-[12px] text-text-faint">
                    <span>{tr("reportedShort", { n: num(p.reported) })}</span>
                    <span className="text-verified">{tr("verifiedShortN", { n: num(p.verified) })}</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                    <div className="absolute inset-y-0 start-0 rounded-full bg-text-faint/30" style={{ width: "100%" }} />
                    <div
                      className="absolute inset-y-0 start-0 rounded-full bg-verified"
                      style={{ width: `${Math.min(100, p.verificationRatePct)}%` }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 border-t border-border pt-3 text-[12px]">
                    <MiniStat label={tr("colSpend")} value={num(p.cost)} />
                    <MiniStat
                      label={tr("colRealCpa")}
                      value={p.cpaVerified !== null ? num(p.cpaVerified) : "—"}
                      hint={
                        p.cpaUnderstatementPct !== null
                          ? tr("higherBy", { pct: p.cpaUnderstatementPct })
                          : undefined
                      }
                    />
                    <MiniStat label={tr("colRoas")} value={p.roasVerified !== null ? `${p.roasVerified}x` : "—"} />
                    <MiniStat label={tr("colUnconfirmed")} value={num(p.wastedSpend)} negative />
                  </div>

                  <div className="mt-2">
                    <GapChart reported={p.reportedSeries} verified={p.verifiedSeries} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mb-8 text-[12px] text-text-faint">
            {tr("chartLegend")}
          </p>
        </>
      )}

      {/* ============ ٣) نماذج الإسناد ============ */}
      <SectionTitle icon={GitBranch}>{tr("modelsHeading")}</SectionTitle>
      {!snapshot.hasTouchpointData ? (
        <EmptyNote>
          {tr("modelsEmpty")}
          {snapshot.totalTrackedConversions > 0 && (
            <> {tr("modelsEmptyCount", { n: num(snapshot.totalTrackedConversions) })}</>
          )}
        </EmptyNote>
      ) : (
        <div className="mb-8">
          <AttributionModelTable
            locale={locale}
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
          <SectionTitle icon={Radar}>{tr("probHeading")}</SectionTitle>
          <div className="mb-3 card pad-md">
            <p className="mb-3 text-[12.5px] leading-relaxed text-text-muted">
              {tr("probLead")}
            </p>

            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <MetricCard
                label={tr("probVerified")}
                value={num(snapshot.probabilistic.verifiedCount)}
                icon={ShieldCheck}
                tone="verified"
                verified
                caption={{ text: tr("probVerifiedHint"), tone: "positive" }}
                explainKey="probVerified"
                locale={locale}
              />
              <MetricCard
                label={tr("probModeled")}
                value={num(snapshot.probabilistic.modeledCount)}
                icon={GitBranch}
                tone="gap"
                verified={false}
                caption={{ text: tr("probModeledHint"), tone: "warning" }}
                explainKey="probModeled"
                locale={locale}
              />
              <MetricCard
                label={tr("probShare")}
                value={snapshot.probabilistic.modeledSharePct}
                unit="%"
                icon={Percent}
                tone={snapshot.probabilistic.modeledSharePct > 40 ? "critical" : "default"}
                bar={{ pct: snapshot.probabilistic.modeledSharePct }}
                caption={{
                  text: snapshot.probabilistic.modeledSharePct > 40 ? tr("probShareHigh") : tr("probShareOk"),
                  tone: snapshot.probabilistic.modeledSharePct > 40 ? "negative" : "muted",
                }}
                explainKey="probShare"
                locale={locale}
              />
            </div>

            {snapshot.probabilistic.byPlatform.length > 0 && (
              <div>
                <div className="mb-2 text-[12.5px] font-medium text-text-muted">
                  {tr("probDist")}
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
            {tr("probNote")}
          </p>
        </>
      )}

      {/* ============ ٤) الرحلة ============ */}
      {journey.totalPaths > 0 && (
        <>
          <SectionTitle icon={Clock}>{tr("journeyHeading")}</SectionTitle>
          <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label={tr("journeyPaths")} value={num(journey.totalPaths)} icon={GitBranch} tone="accent"
          explainKey="journeyPaths"
          locale={locale}
        />
            <MetricCard
              label={tr("journeyAvgTouches")}
              value={journey.avgTouchesPerConversion}
              icon={Layers}
              tone="default"
              subLabel={tr("journeyAvgTouchesSub")}
              explainKey="journeyAvgTouches"
              locale={locale}
            />
            <MetricCard
              label={tr("journeyDuration")}
              value={journey.avgDaysToConvert}
              unit={t(locale, "inventory.daysUnit", { n: "" }).trim()}
              icon={Clock}
              tone="default"
              subLabel={tr("journeyDurationSub")}
              explainKey="journeyDuration"
              locale={locale}
            />
            <MetricCard
              label={tr("journeySingle")}
              value={journey.singleTouchPaths}
              icon={Target}
              tone="neutral"
              caption={{
                text: tr("journeySinglePct", { pct: 100 - journey.multiTouchRatePct }),
                tone: "muted",
              }}
              explainKey="journeySingle"
              locale={locale}
            />
          </div>

          {journey.topSequences.length > 0 && (
            <div className="mb-8 card pad-md">
              <div className="mb-3 text-[13px] font-medium text-text-muted">{tr("topSequences")}</div>
              <div className="flex flex-col gap-2">
                {journey.topSequences.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {s.sequence.map((step, j) => (
                        <span key={j} className="flex items-center gap-1.5">
                          {j > 0 && <span className="text-text-faint">←</span>}
                          <span className="rounded-md bg-surface-raised px-2 py-0.5 text-[12px] text-text-primary">
                            {/* رمز منصّة يُترجَم بلغة القارئ، وما عداه اسم
                                قناة له مفتاحه. `PLATFORM_META` هو اختبار
                                «هل هذا رمز منصّة» لا مصدر الاسم - اسمه فيه
                                إنجليزيّ ثابت، وكان يفرض «Meta Ads» على
                                الواجهة العربية. */}
                            {PLATFORM_META[step] ? platformLabel(locale, step) : channelName(locale, step)}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-[12px] tabular-nums">
                      <span className="text-text-muted">{tr("pathsUnit", { n: s.count })}</span>
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
      <SectionTitle icon={Send}>{tr("syncHeading")}</SectionTitle>
      <div className="card pad-md">
        {!sync.enabled ? (
          <div>
            <p className="mb-2 text-[13px] leading-relaxed text-text-primary">
              {tr("syncPitch1")}
            </p>
            <p className="mb-3 text-[12.5px] leading-relaxed text-text-muted">
              {tr("syncPitch2")}
            </p>
            {/* الإعداد نفسه يعيش في تبويب «رفع التحويلات» داخل الإعدادات -
                معرّف البكسل ورمز الأحداث لكل منصّة. الزرّ كان يقود إلى
                «ربط المنصّات»، وهي شاشة OAuth لا علاقة لها بهذين الحقلين،
                فيصل المستخدم إلى مكان لا يجد فيه ما وُعِد به. */}
            <a
              href="/dashboard/settings?tab=conversionSync"
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-[12.5px] font-medium text-accent no-underline transition-colors hover:bg-accent/20"
            >
              <Send size={14} />
              {tr("syncEnable")}
            </a>
          </div>
        ) : (
          <>
            <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label={tr("syncSent")} value={num(sync.sentEvents)} icon={Send} tone="verified"
          explainKey="syncSent"
          locale={locale}
        />
              <MetricCard
                label={tr("syncQuality")}
                value={sync.avgMatchQuality !== null ? sync.avgMatchQuality : "—"}
                unit={sync.avgMatchQuality !== null ? "/10" : undefined}
                icon={Gauge}
                tone={
                  sync.avgMatchQuality === null ? "neutral"
                    : sync.avgMatchQuality >= 8 ? "verified"
                      : sync.avgMatchQuality >= 6 ? "gap" : "critical"
                }
                bar={sync.avgMatchQuality !== null ? { pct: sync.avgMatchQuality * 10 } : undefined}
                explainKey="syncQuality"
                locale={locale}
              />
              <MetricCard
                label={tr("syncSkipped")}
                value={num(sync.skippedEvents)}
                icon={AlertTriangle}
                tone="gap"
                explainKey="syncSkipped"
                locale={locale}
              />
              <MetricCard label={tr("syncFailed")} value={num(sync.failedEvents)} icon={AlertTriangle} tone="critical"
          explainKey="syncFailed"
          locale={locale}
        />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
              <span>{tr("syncPlatforms")}</span>
              {sync.configuredPlatforms.length === 0 ? (
                <span className="text-gap">{tr("syncNoPlatforms")}</span>
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
                {tr("syncTopSkip", { reason: sync.topSkipReason })}
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
    <h2 className="mb-3 flex items-center gap-2 section-title">
      <Icon size={16} className="text-text-muted" />
      {children}
    </h2>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-8 card pad-md text-[12.5px] leading-relaxed text-text-muted">
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

const CHANNEL_KEYS: Record<string, string> = {
  PAID_SEARCH: "chPaidSearch",
  PAID_SOCIAL: "chPaidSocial",
  PAID_VIDEO: "chPaidVideo",
  ORGANIC_SEARCH: "chOrganicSearch",
  ORGANIC_SOCIAL: "chOrganicSocial",
  DIRECT: "chDirect",
  REFERRAL: "chReferral",
  EMAIL: "chEmail",
  CRM: "chCrm",
  OTHER: "chOther",
};

export { CHANNEL_KEYS };

/** قناة غير معروفة تُعرض كما وردت لا كفراغ */
function channelName(locale: Locale, channel: string): string {
  const key = CHANNEL_KEYS[channel];
  return key ? t(locale, `campPages.${key}`) : channel;
}
