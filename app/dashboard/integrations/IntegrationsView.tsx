"use client";

// قسم التكاملات: نظرة عامة، التكاملات النشطة، المتاحة، وسجلّ النشاط.
//
// نقطة معمارية مقصودة: هذه الصفحة تستبدل التنقّل إلى الإعدادات. كان كل
// إجراء على أي ربط يُحيل إلى صفحة الإعدادات ثم يعود المستخدم أدراجه -
// هنا كل شيء في مكانه: الحالة والحسابات والصلاحيات والسجلّ والفصل.

import { useState } from "react";
import {
  Plug, CheckCircle2, AlertTriangle, Clock, Plus, ChevronLeft, Loader2, Activity,
} from "lucide-react";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { IntegrationDrawer } from "./IntegrationDrawer";
import { getCsrfHeader } from "@/lib/csrfClient";
import { INTEGRATION_CATEGORIES, type IntegrationDef } from "@/lib/integrationsCatalog";
import type { ActiveIntegration, IntegrationsOverview, SyncRunSummary } from "@/lib/integrationsStatus";

const HEALTH_DOT = {
  HEALTHY: "bg-verified",
  NEEDS_ATTENTION: "bg-gap",
  BROKEN: "bg-critical",
} as const;

const HEALTH_LABEL = {
  HEALTHY: "متصل",
  NEEDS_ATTENTION: "يحتاج انتباهاً",
  BROKEN: "متوقّف",
} as const;

/** الزمن النسبي يُحسب في العميل لا الخادم: الخادم يعرف لحظة البناء لا لحظة
 *  القراءة، فـ"منذ دقيقتين" المولَّدة على الخادم تصبح كذباً بعد ساعة. */
function relativeAr(input: Date | string | null): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  const diff = date.getTime() - Date.now();
  const future = diff > 0;
  const seconds = Math.floor(Math.abs(diff) / 1000);

  const fmt = (n: number, one: string, two: string, many: string) => {
    if (n === 1) return one;
    if (n === 2) return two;
    if (n <= 10) return `${n} ${many}`;
    return `${n} ${one}`;
  };

  let text: string;
  if (seconds < 60) return future ? "بعد لحظات" : "الآن";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) text = fmt(minutes, "دقيقة", "دقيقتين", "دقائق");
  else {
    const hours = Math.floor(minutes / 60);
    if (hours < 24) text = fmt(hours, "ساعة", "ساعتين", "ساعات");
    else {
      const days = Math.floor(hours / 24);
      if (days < 30) text = fmt(days, "يوم", "يومين", "أيام");
      else text = fmt(Math.floor(days / 30), "شهر", "شهرين", "أشهر");
    }
  }
  return future ? `خلال ${text}` : `منذ ${text}`;
}

export function IntegrationsView({
  overview,
  workspaceId,
}: {
  overview: IntegrationsOverview;
  workspaceId: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = overview.active.find((a) => a.key === openKey) ?? null;

  async function disconnect(key: string) {
    const target = overview.active.find((a) => a.key === key);
    if (!target) return;
    if (
      !window.confirm(
        `سيتوقّف تدفّق البيانات من ${target.name} فوراً، وتبقى البيانات التاريخية كما هي. متابعة؟`
      )
    ) {
      return;
    }
    setBusy("disconnect");
    setError(null);
    try {
      const res = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({ workspaceId, key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذّر فصل الربط");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر فصل الربط");
    } finally {
      setBusy(null);
    }
  }

  async function syncNow() {
    setBusy("sync");
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذّرت المزامنة");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّرت المزامنة");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 flex items-center gap-2.5 text-[26px] font-semibold text-text-primary">
        <Plug size={24} className="text-accent" />
        التكاملات
      </h1>
      <p className="mb-6 max-w-3xl text-[13px] leading-relaxed text-text-muted">
        كل مصادر بياناتك في مكان واحد. اضغط أي تكامل نشط لفتح تفاصيله الكاملة — الحالة والحسابات
        والصلاحيات وسجلّ المزامنة والفصل — دون مغادرة الصفحة.
      </p>

      {/* ============ نظرة عامة: أربعة مؤشّرات فقط ============ */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="تكاملات مربوطة"
          value={overview.connectedCount}
          icon={Plug}
          tone="accent"
        />
        <MetricCard
          label="روابط سليمة"
          value={overview.healthyCount}
          icon={CheckCircle2}
          tone="verified"
          caption={
            overview.connectedCount > 0
              ? { text: `من أصل ${overview.connectedCount}`, tone: "muted" }
              : undefined
          }
        />
        <MetricCard
          label="تحتاج انتباهاً"
          value={overview.needsAttentionCount}
          icon={AlertTriangle}
          tone={overview.needsAttentionCount > 0 ? "critical" : "neutral"}
          caption={
            overview.needsAttentionCount === 0
              ? { text: "لا توجد مشاكل حالياً", tone: "positive" }
              : { text: "اضغط التكامل لمعرفة السبب", tone: "negative" }
          }
        />
        <MetricCard
          label="آخر مزامنة"
          value={relativeAr(overview.lastSyncAt)}
          icon={Clock}
          tone="default"
          caption={
            overview.lastSyncAt
              ? undefined
              : { text: "لم تُسجَّل مزامنة بعد", tone: "muted" }
          }
        />
      </div>

      {error && !open && (
        <div className="mb-4 rounded-xl border border-critical/30 bg-critical/10 px-3 py-2 text-[12.5px] text-critical">
          {error}
        </div>
      )}

      {/* ============ التكاملات النشطة ============ */}
      <SectionHeading>التكاملات النشطة</SectionHeading>
      {overview.active.length === 0 ? (
        <p className="mb-8 rounded-2xl border border-border bg-surface p-4 text-[12.5px] text-text-muted">
          لا يوجد تكامل مربوط بعد. ابدأ بربط منصّة إعلانية من القائمة أدناه.
        </p>
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {overview.active.map((item) => (
            <ActiveCard key={item.key} item={item} onOpen={() => setOpenKey(item.key)} />
          ))}
        </div>
      )}

      {/* ============ التكاملات المتاحة ============ */}
      <SectionHeading>التكاملات المتاحة</SectionHeading>
      <div className="mb-8 flex flex-col gap-5">
        {INTEGRATION_CATEGORIES.map((cat) => {
          const items = overview.available.filter((i) => i.category === cat.key);
          if (items.length === 0) return null;
          return (
            <div key={cat.key}>
              <div className="mb-1 text-[13px] font-semibold text-text-primary">{cat.labelAr}</div>
              <p className="mb-2.5 text-[12px] text-text-faint">{cat.descriptionAr}</p>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <AvailableCard key={item.key} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ============ سجلّ النشاط ============ */}
      <SectionHeading>سجلّ المزامنة</SectionHeading>
      <div className="card-shadow rounded-2xl border border-border bg-surface p-4">
        {overview.recentActivity.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-text-muted">
            لم تُسجَّل أي عملية مزامنة بعد. تُسجَّل كل عملية تلقائياً — يدوية كانت أو مجدولة — فور
            تشغيلها.
          </p>
        ) : (
          <Timeline runs={overview.recentActivity} />
        )}
      </div>

      <IntegrationDrawer
        integration={open}
        onClose={() => { setOpenKey(null); setError(null); }}
        onDisconnect={disconnect}
        onSync={syncNow}
        busy={busy}
        error={error}
        relativeTime={relativeAr}
      />
    </div>
  );
}

function ActiveCard({ item, onOpen }: { item: ActiveIntegration; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="card-shadow group w-full rounded-2xl border border-border bg-surface p-4 text-start transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)` }}
          >
            {item.platform ? (
              <PlatformLogo platform={item.platform} size={18} />
            ) : (
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            )}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-medium text-text-primary">{item.name}</div>
            <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${HEALTH_DOT[item.health]}`} />
              {HEALTH_LABEL[item.health]}
            </div>
          </div>
        </div>
        <ChevronLeft
          size={15}
          className="mt-1 shrink-0 rotate-180 text-text-faint opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-0"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-[12px]">
        <div>
          <div className="text-text-faint">الحسابات</div>
          <div className="mt-0.5 font-medium tabular-nums text-text-primary">{item.accountCount}</div>
        </div>
        <div>
          <div className="text-text-faint">آخر مزامنة</div>
          <div className="mt-0.5 font-medium text-text-primary">{relativeAr(item.lastSyncAt)}</div>
        </div>
      </div>
    </button>
  );
}

function AvailableCard({ item }: { item: IntegrationDef }) {
  const soon = item.status === "SOON";

  const inner = (
    <div
      className={`flex h-full items-center gap-2.5 rounded-2xl border p-3.5 transition-all ${
        soon
          ? "cursor-default border-dashed border-border bg-surface/50 opacity-55"
          : "card-shadow border-border bg-surface hover:-translate-y-0.5 hover:ring-1 hover:ring-border"
      }`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: soon
            ? "var(--surface-raised)"
            : `color-mix(in srgb, ${item.color} 12%, transparent)`,
        }}
      >
        {item.platform && !soon ? (
          <PlatformLogo platform={item.platform} size={18} />
        ) : (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: soon ? "var(--text-faint)" : item.color }}
          />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-text-primary">{item.name}</div>
        <div className="truncate text-[11.5px] text-text-faint">{item.valueAr}</div>
      </div>

      {soon ? (
        <span className="shrink-0 rounded-md bg-surface-raised px-2 py-1 text-[11px] font-medium text-text-faint">
          قريباً
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-[12px] font-medium text-accent">
          <Plus size={12} />
          ربط
        </span>
      )}
    </div>
  );

  if (soon || !item.connectPath) return inner;

  return (
    <a href={item.connectPath} className="block h-full no-underline">
      {inner}
    </a>
  );
}

function Timeline({ runs }: { runs: SyncRunSummary[] }) {
  const PLATFORM_NAMES: Record<string, string> = {
    GOOGLE_ADS: "Google Ads",
    META_ADS: "Meta Ads",
    TIKTOK_ADS: "TikTok Ads",
    SNAPCHAT_ADS: "Snapchat Ads",
  };

  return (
    <div className="relative">
      {/* الخطّ الرأسي يربط الأحداث - يجعلها سلسلة زمنية لا قائمة منفصلة */}
      <div className="absolute bottom-2 top-2 start-[5px] w-px bg-border" aria-hidden />
      <div className="flex flex-col gap-3">
        {runs.map((run) => (
          <div key={run.id} className="relative flex items-start gap-3 ps-0">
            <span
              className={`relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-surface ${
                run.status === "SUCCESS"
                  ? "bg-verified"
                  : run.status === "FAILED"
                    ? "bg-critical"
                    : "bg-gap"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
                <span className="font-medium text-text-primary">
                  {PLATFORM_NAMES[run.platform] ?? run.platform}
                </span>
                <span
                  className={
                    run.status === "SUCCESS"
                      ? "text-verified"
                      : run.status === "FAILED"
                        ? "text-critical"
                        : "text-gap"
                  }
                >
                  {run.status === "SUCCESS" ? "نجحت" : run.status === "FAILED" ? "فشلت" : "قيد التشغيل"}
                </span>
                <span className="text-text-faint">{relativeAr(run.startedAt)}</span>
                <span className="text-text-faint">{run.trigger === "MANUAL" ? "يدوية" : "مجدولة"}</span>
                {run.recordsWritten !== null && run.recordsWritten > 0 && (
                  <span className="text-text-faint tabular-nums">
                    +{run.recordsWritten.toLocaleString("en-US")} صفّاً
                  </span>
                )}
              </div>
              {run.errorMessage && (
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-critical">{run.errorMessage}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-text-primary">
      <Activity size={15} className="text-text-muted" />
      {children}
    </h2>
  );
}
