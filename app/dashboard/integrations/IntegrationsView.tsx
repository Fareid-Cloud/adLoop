"use client";

// app/dashboard/integrations/IntegrationsView.tsx
//
// ربط المنصات - نقطة واحدة لكل مصادر البيانات. القاعدة الصارمة التي تحكم
// هذه الصفحة: لا خطوة ربط واحدة تخرج إلى الإعدادات. كل ما يخصّ الربط أو
// اختيار الحملات يحدث هنا، إمّا في اللوحة الجانبية أو في نافذة الاختيار.
//
// اللوحة الجانبية لصيقة باليمين ولا تُغطّي الصفحة: المقارنة بين المنصات
// جزء من القرار، فإخفاء القائمة خلف طبقة معتمة يقطعها.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Link2, AlertTriangle, RefreshCw, BarChart3, Layers, Search,
  Plus, List, LayoutGrid, ChevronLeft, ChevronRight,
} from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { CampaignPickerModal } from "@/app/components/CampaignPickerModal";
import { IntegrationDrawer } from "./IntegrationDrawer";
import { INTEGRATION_CATEGORIES, type IntegrationDef } from "@/lib/integrationsCatalog";
import type { ActiveIntegration, IntegrationsOverview } from "@/lib/integrationsStatus";
import { t, relativeFromDate, type Locale } from "@/lib/i18n/dictionary";

type Tab = "connected" | "available" | "disconnected" | "all";
type ViewMode = "list" | "grid";

export function IntegrationsView({
  overview,
  workspaceId,
  locale = "ar",
}: {
  overview: IntegrationsOverview;
  workspaceId: string;
  locale?: Locale;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) =>
    t(locale, `integrations.${k}`, vars);
  const rel = (d: Date | string | null) => relativeFromDate(locale, d);

  const router = useRouter();
  const [tab, setTab] = useState<Tab>("connected");
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [selectedKey, setSelectedKey] = useState<string | null>(
    overview.active[0]?.key ?? null
  );
  const [pickerPlatform, setPickerPlatform] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const selected = overview.active.find((a) => a.key === selectedKey) ?? null;

  // الاسم المعروض يتبع لغة الواجهة، والبحث يطابق الاسمين معاً حتى لا يفشل
  // بحث المستخدم لأنه كتب "جوجل" بينما الواجهة إنجليزية.
  const nameOf = (i: { name: string; nameAr: string }) => (locale === "en" ? i.name : i.nameAr);
  const matches = (i: { name: string; nameAr: string; category: string }) => {
    if (category !== "all" && i.category !== category) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return i.name.toLowerCase().includes(q) || i.nameAr.includes(query.trim());
  };

  const connected = useMemo(
    () => overview.active.filter((a) => a.health !== "BROKEN").filter(matches),
    [overview.active, category, query, locale]
  );
  const broken = useMemo(
    () => overview.active.filter((a) => a.health === "BROKEN").filter(matches),
    [overview.active, category, query, locale]
  );
  const available = useMemo(
    () => overview.available.filter(matches),
    [overview.available, category, query, locale]
  );
  const soon = useMemo(
    () => overview.soon.filter(matches),
    [overview.soon, category, query, locale]
  );

  const rows = tab === "connected" ? connected : tab === "disconnected" ? broken : tab === "all" ? [...connected, ...broken] : [];

  async function disconnect(key: string) {
    setBusy(key);
    const res = await fetch("/api/integrations/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, key }),
    }).catch(() => null);
    setBusy(null);
    if (res?.ok) router.refresh();
  }

  async function syncNow(platform: string | null) {
    if (!platform) return;
    setBusy(platform);
    const res = await fetch(`/api/workspaces/${workspaceId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    }).catch(() => null);
    setBusy(null);
    if (res?.ok) router.refresh();
  }

  return (
    <div className="mx-auto max-w-[1400px] pb-12">
      {/* ==================== الرأس ==================== */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-text-primary">{tr("title")}</h1>
          <p className="mt-1 text-[13px] text-text-muted">{tr("subtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-text-faint" style={{ insetInlineStart: 11 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("search")}
              className="w-56 rounded-xl border border-border bg-surface py-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-faint focus:border-accent"
              style={{ paddingInlineStart: 32, paddingInlineEnd: 12 }}
            />
          </div>
          <button
            onClick={() => setTab("available")}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-medium text-white"
          >
            <Plus size={15} /> {tr("addIntegration")}
          </button>
        </div>
      </header>

      {/* ==================== المؤشّرات ==================== */}
      <div className="card-shadow mb-5 grid gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={Link2} tone="verified" value={String(overview.connectedCount)} label={tr("kpiConnected")} caption={tr("kpiConnectedCaption")} />
        <Kpi
          icon={AlertTriangle}
          tone={overview.needsAttentionCount > 0 ? "gap" : "muted"}
          value={String(overview.needsAttentionCount)}
          label={tr("kpiAttention")}
          caption={overview.needsAttentionCount > 0 ? tr("kpiAttentionCaption") : tr("kpiAttentionOk")}
        />
        <Kpi
          icon={RefreshCw}
          tone="accent"
          value={rel(overview.lastSyncAt) ?? "—"}
          label={tr("kpiLastSync")}
          caption={overview.lastSyncAt ? tr("kpiLastSyncCaption") : tr("kpiLastSyncNone")}
        />
        <Kpi
          icon={BarChart3}
          tone="accent"
          value={overview.successRatePct === null ? "—" : `${overview.successRatePct}%`}
          label={tr("kpiSuccessRate")}
          caption={tr("kpiSuccessRateCaption")}
        />
        <Kpi icon={Layers} tone="muted" value={String(overview.totalAccounts)} label={tr("kpiAccounts")} caption={tr("kpiAccountsCaption")} />
      </div>

      {/* ==================== التبويبات والتصفية ==================== */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <nav className="flex flex-wrap gap-1">
          <TabButton active={tab === "connected"} onClick={() => setTab("connected")} label={tr("tabConnected", { n: connected.length })} />
          <TabButton active={tab === "available"} onClick={() => setTab("available")} label={tr("tabAvailable", { n: available.length })} />
          <TabButton active={tab === "disconnected"} onClick={() => setTab("disconnected")} label={tr("tabDisconnected", { n: broken.length })} />
          <TabButton active={tab === "all"} onClick={() => setTab("all")} label={tr("tabAll")} />
        </nav>

        <div className="flex items-center gap-2 pb-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-[12.5px] text-text-primary outline-none"
          >
            <option value="all">{tr("allCategories")}</option>
            {INTEGRATION_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{locale === "en" ? c.labelEn : c.labelAr}</option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-xl border border-border">
            <IconToggle active={view === "list"} onClick={() => setView("list")} icon={List} title={tr("viewList")} />
            <IconToggle active={view === "grid"} onClick={() => setView("grid")} icon={LayoutGrid} title={tr("viewGrid")} />
          </div>
        </div>
      </div>

      {/* ==================== القائمة + اللوحة ==================== */}
      <div className={selected && tab !== "available" ? "grid gap-4 xl:grid-cols-[1fr_380px]" : ""}>
        <div className="min-w-0">
          {tab === "available" ? (
            <AvailableGrid
              items={available}
              soon={soon}
              locale={locale}
              tr={tr}
              nameOf={nameOf}
              onPick={(def) => {
                // القاعدة: لا توجيه إلى الإعدادات. الربط إمّا OAuth مباشر،
                // أو نافذة اختيار حملات تُفتح في مكانها.
                if (def.connectPath?.startsWith("/api/")) window.location.href = def.connectPath;
                else if (def.platform) setPickerPlatform(def.platform);
              }}
            />
          ) : rows.length === 0 ? (
            <EmptyBox
              title={query || category !== "all" ? tr("noMatch") : tab === "disconnected" ? tr("noneDisconnected") : tr("noneConnected")}
              body={query || category !== "all" || tab === "disconnected" ? null : tr("noneConnectedBody")}
            />
          ) : view === "list" ? (
            <div className="card-shadow overflow-hidden rounded-2xl border border-border bg-surface">
              {rows.map((item, i) => (
                <IntegrationRow
                  key={item.key}
                  item={item}
                  first={i === 0}
                  selected={item.key === selectedKey}
                  locale={locale}
                  tr={tr}
                  rel={rel}
                  nameOf={nameOf}
                  onOpen={() => setSelectedKey(item.key)}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((item) => (
                <IntegrationCard
                  key={item.key}
                  item={item}
                  selected={item.key === selectedKey}
                  locale={locale}
                  tr={tr}
                  rel={rel}
                  nameOf={nameOf}
                  onOpen={() => setSelectedKey(item.key)}
                />
              ))}
            </div>
          )}
        </div>

        {selected && tab !== "available" && (
          <IntegrationDrawer
            integration={selected}
            locale={locale}
            busy={busy === selected.key || busy === selected.platform}
            onClose={() => setSelectedKey(null)}
            onSync={() => syncNow(selected.platform)}
            onDisconnect={() => disconnect(selected.key)}
            onManageCampaigns={() => selected.platform && setPickerPlatform(selected.platform)}
          />
        )}
      </div>

      {/* ==================== المتاحة (شريط أسفل) ==================== */}
      {tab !== "available" && available.length > 0 && (
        <section className="card-shadow mt-6 rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-text-primary">{tr("availableTitle")}</h2>
              <p className="mt-0.5 text-[12.5px] text-text-muted">{tr("availableSubtitle")}</p>
            </div>
            <button onClick={() => setTab("available")} className="flex items-center gap-1 text-[12.5px] font-medium text-accent">
              {tr("viewAllAvailable")}
              {locale === "en" ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {available.slice(0, 6).map((def) => (
              <AvailableCard
                key={def.key}
                def={def}
                locale={locale}
                tr={tr}
                nameOf={nameOf}
                onPick={() => {
                  if (def.connectPath?.startsWith("/api/")) window.location.href = def.connectPath;
                  else if (def.platform) setPickerPlatform(def.platform);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {pickerPlatform && (
        <CampaignPickerModal
          open
          workspaceId={workspaceId}
          platform={pickerPlatform as never}
          locale={locale}
          onClose={() => setPickerPlatform(null)}
          onSaved={() => { setPickerPlatform(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ==================== بطاقة مؤشّر ====================

const TONE_BG: Record<string, string> = {
  verified: "bg-verified/12 text-verified",
  gap: "bg-gap/14 text-gap",
  accent: "bg-accent/12 text-accent",
  muted: "bg-surface-raised text-text-muted",
};

function Kpi({
  icon: Icon, tone, value, label, caption,
}: {
  icon: typeof Link2;
  tone: keyof typeof TONE_BG | string;
  value: string;
  label: string;
  caption: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-surface-raised/60 p-3.5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[tone] ?? TONE_BG.muted}`}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[19px] font-semibold leading-tight text-text-primary">{value}</div>
        <div className="mt-0.5 text-[12.5px] font-medium text-text-primary">{label}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-text-faint">{caption}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
        active ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function IconToggle({
  active, onClick, icon: Icon, title,
}: { active: boolean; onClick: () => void; icon: typeof List; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`px-2.5 py-2 ${active ? "bg-accent text-white" : "bg-surface text-text-muted hover:text-text-primary"}`}
    >
      <Icon size={15} />
    </button>
  );
}

// ==================== صفّ منصة ====================

function healthTone(h: string): { chip: string; bar: string; dot: string } {
  if (h === "HEALTHY") return { chip: "bg-verified/12 text-verified", bar: "var(--verified)", dot: "var(--verified)" };
  if (h === "NEEDS_ATTENTION") return { chip: "bg-gap/14 text-gap", bar: "var(--gap)", dot: "var(--gap)" };
  return { chip: "bg-critical/12 text-critical", bar: "var(--critical)", dot: "var(--critical)" };
}

function statusKey(h: string): string {
  return h === "HEALTHY" ? "stConnected" : h === "NEEDS_ATTENTION" ? "stAttention" : "stBroken";
}

function IntegrationRow({
  item, first, selected, locale, tr, rel, nameOf, onOpen,
}: {
  item: ActiveIntegration;
  first: boolean;
  selected: boolean;
  locale: Locale;
  tr: (k: string, v?: Record<string, string | number>) => string;
  rel: (d: Date | string | null) => string | null;
  nameOf: (i: { name: string; nameAr: string }) => string;
  onOpen: () => void;
}) {
  const tone = healthTone(item.health);
  const broken = item.health === "BROKEN";
  const catLabel = INTEGRATION_CATEGORIES.find((c) => c.key === item.category);

  return (
    <div
      className={`flex flex-wrap items-center gap-4 px-4 py-3.5 ${first ? "" : "border-t border-border/60"} ${
        selected ? "bg-accent/[0.045]" : ""
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)` }}>
        <PlatformLogo platform={item.logoKey} size={19} />
      </span>

      <div className="min-w-[140px] flex-1">
        <div className="text-[14px] font-medium text-text-primary">{nameOf(item)}</div>
        <div className="mt-0.5 text-[12px] text-text-muted">
          {catLabel ? (locale === "en" ? catLabel.labelEn : catLabel.labelAr) : ""}
        </div>
      </div>

      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${tone.chip}`}>
        {tr(statusKey(item.health))}
      </span>

      <div className="w-[110px] shrink-0">
        <div className="text-[15px] font-semibold text-text-primary">{item.accountCount}</div>
        <div className="text-[11.5px] text-text-muted">{tr("colAccounts")}</div>
        <div className="mt-0.5 text-[11px] text-text-faint">
          {item.entityLabelKey === "campaigns"
            ? tr("nCampaigns", { n: item.entityCount })
            : tr("nWebhooks", { n: item.entityCount })}
        </div>
      </div>

      <div className="w-[110px] shrink-0">
        <div className="text-[15px] font-semibold text-text-primary">{item.healthPct}%</div>
        <div className="text-[11.5px] text-text-muted">{tr("colHealth")}</div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full rounded-full" style={{ width: `${item.healthPct}%`, background: tone.bar }} />
        </div>
      </div>

      <div className="w-[130px] shrink-0">
        <div className="text-[13px] font-medium text-text-primary">
          {rel(item.lastSyncAt) ?? tr("neverSynced")}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
          {tr("colLastSync")}
        </div>
        {broken && <div className="mt-0.5 text-[11px] text-critical">{tr("reconnectRequired")}</div>}
      </div>

      <button
        onClick={onOpen}
        className={`flex shrink-0 items-center gap-1 rounded-xl px-3.5 py-2 text-[12.5px] font-medium ${
          broken ? "bg-accent/12 text-accent" : "border border-border bg-surface-raised text-text-primary"
        }`}
      >
        {broken ? tr("fixNow") : tr("manage")}
        {locale === "en" ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </div>
  );
}

function IntegrationCard({
  item, selected, locale, tr, rel, nameOf, onOpen,
}: {
  item: ActiveIntegration;
  selected: boolean;
  locale: Locale;
  tr: (k: string, v?: Record<string, string | number>) => string;
  rel: (d: Date | string | null) => string | null;
  nameOf: (i: { name: string; nameAr: string }) => string;
  onOpen: () => void;
}) {
  const tone = healthTone(item.health);
  return (
    <button
      onClick={onOpen}
      className={`card-shadow rounded-2xl border bg-surface p-4 text-start ${selected ? "border-accent" : "border-border"}`}
    >
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)` }}>
          <PlatformLogo platform={item.logoKey} size={17} />
        </span>
        <span className="flex-1 text-[13.5px] font-medium text-text-primary">{nameOf(item)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${tone.chip}`}>{tr(statusKey(item.health))}</span>
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
        <div className="h-full rounded-full" style={{ width: `${item.healthPct}%`, background: tone.bar }} />
      </div>
      <div className="flex justify-between text-[11.5px] text-text-muted">
        <span>{item.healthPct}% · {item.accountCount} {tr("colAccounts")}</span>
        <span>{rel(item.lastSyncAt) ?? tr("neverSynced")}</span>
      </div>
    </button>
  );
}

// ==================== المتاحة ====================

function AvailableGrid({
  items, soon, locale, tr, nameOf, onPick,
}: {
  items: IntegrationDef[];
  soon: IntegrationDef[];
  locale: Locale;
  tr: (k: string, v?: Record<string, string | number>) => string;
  nameOf: (i: { name: string; nameAr: string }) => string;
  onPick: (def: IntegrationDef) => void;
}) {
  if (items.length === 0 && soon.length === 0) return <EmptyBox title={tr("noneAvailable")} body={null} />;

  return (
    <div className="flex flex-col gap-6">
      {INTEGRATION_CATEGORIES.map((cat) => {
        const live = items.filter((i) => i.category === cat.key);
        const later = soon.filter((i) => i.category === cat.key);
        if (live.length === 0 && later.length === 0) return null;
        return (
          <section key={cat.key}>
            <h3 className="text-[14px] font-semibold text-text-primary">{locale === "en" ? cat.labelEn : cat.labelAr}</h3>
            <p className="mb-2.5 mt-0.5 text-[12px] text-text-muted">{locale === "en" ? cat.descriptionEn : cat.descriptionAr}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {live.map((def) => (
                <AvailableCard key={def.key} def={def} locale={locale} tr={tr} nameOf={nameOf} onPick={() => onPick(def)} />
              ))}
              {later.map((def) => (
                <AvailableCard key={def.key} def={def} locale={locale} tr={tr} nameOf={nameOf} onPick={null} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AvailableCard({
  def, locale, tr, nameOf, onPick,
}: {
  def: IntegrationDef;
  locale: Locale;
  tr: (k: string, v?: Record<string, string | number>) => string;
  nameOf: (i: { name: string; nameAr: string }) => string;
  onPick: (() => void) | null;
}) {
  // "قريباً" باهت وغير قابل للضغط عمداً: ادّعاء تكامل غير مبنيّ يكتشفه
  // المستخدم في أول ضغطة، فيفقد الثقة في بقية الأرقام أيضاً.
  const disabled = onPick === null;
  const cat = INTEGRATION_CATEGORIES.find((c) => c.key === def.category);

  return (
    <div
      className={`card-shadow flex w-[260px] shrink-0 flex-col rounded-2xl border border-border bg-surface p-4 sm:w-auto ${
        disabled ? "opacity-45" : ""
      }`}
    >
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${def.color} 12%, transparent)` }}>
          <PlatformLogo platform={def.logoKey} size={17} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium text-text-primary">{nameOf(def)}</div>
          <div className="text-[11.5px] text-text-muted">{cat ? (locale === "en" ? cat.labelEn : cat.labelAr) : ""}</div>
        </div>
      </div>

      <p className="mb-3 flex-1 text-[12px] leading-relaxed text-text-muted">
        {disabled ? tr("soonHint") : locale === "en" ? def.valueEn : def.valueAr}
      </p>

      {disabled ? (
        <span className="rounded-xl border border-border bg-surface-raised py-2 text-center text-[12.5px] text-text-faint">
          {tr("soon")}
        </span>
      ) : (
        <button onClick={onPick} className="rounded-xl bg-accent py-2 text-[12.5px] font-medium text-white">
          {tr("connect")}
        </button>
      )}
    </div>
  );
}

function EmptyBox({ title, body }: { title: string; body: string | null }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <p className="text-[13.5px] text-text-primary">{title}</p>
      {body && <p className="mt-1 text-[12.5px] text-text-muted">{body}</p>}
    </div>
  );
}
