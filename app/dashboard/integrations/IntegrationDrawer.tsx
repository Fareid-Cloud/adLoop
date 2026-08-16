"use client";

// app/dashboard/integrations/IntegrationDrawer.tsx
//
// لوحة تفاصيل المنصة. لوحة لصيقة لا نافذة تُغطّي الصفحة: المقارنة بين
// المنصات جزء من القرار، فحجب القائمة خلف طبقة معتمة يقطعها.
//
// كل رقم هنا مصدره حقيقي - لا تقدير ولا حشو. ما لا نملكه لا يُعرض أصلاً
// بدل عرض صفر يوحي بأن التكامل ميّت.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, CircleDot, Activity, Clock, Users, Megaphone, ShoppingBag,
  Database, RefreshCw, Radio, CalendarDays, KeyRound, ChevronLeft, ChevronRight, Plus, Pencil,
} from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import type { ActiveIntegration } from "@/lib/integrationsStatus";
import { t, relativeFromDate, durationFromHours, type Locale } from "@/lib/i18n/dictionary";

type DrawerTab = "overview" | "accounts" | "permissions" | "activity";

export function IntegrationDrawer({
  integration, locale, busy, onClose, onSync, onDisconnect, onDisconnectGrant, onManageCampaigns,
}: {
  integration: ActiveIntegration;
  locale: Locale;
  busy: boolean;
  onClose: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  /** فصل تسجيل دخولٍ بعينه - غير فصل المنصّة كلّها */
  onDisconnectGrant: (connectionId: string) => void;
  onManageCampaigns: () => void;
}) {
  const onAddAccount = onManageCampaigns;
  const tr = (k: string, vars?: Record<string, string | number>) =>
    t(locale, `integrations.${k}`, vars);
  const rel = (d: Date | string | null) => relativeFromDate(locale, d);

  const [tab, setTab] = useState<DrawerTab>("overview");
  const [confirming, setConfirming] = useState(false);

  // 🔴 كان `integration.entityLabelKey === "webhooks"` - دلالة غير مباشرة
  // على نوع التكامل بدل نوعه المصرَّح. أيّ تكامل متجر لا يحمل هذا المفتاح
  // بالحرف يُعامَل كمنصّة إعلانية، فيظهر له زرّ «اختر الحملات»؛ والضغط
  // عليه يرسل رمز متجر إلى مسار الحملات، فيقع في الافتراضيّ الصامت هناك
  // ويعود بـ«Google Ads غير مربوط» - رسالة عن منصّة لم يذكرها أحد، عن
  // تكامل لا حملات له أصلاً.
  //
  // `category` هي التصنيف المصرَّح في الكتالوج، وهي مصدر الحقيقة. الاستدلال
  // بخاصّية أخرى يصحّ حتى أوّل تكامل يخالفه - وقد خالفه.
  const isStore = integration.category === "ECOMMERCE";
  const tone =
    integration.health === "HEALTHY"
      ? { chip: "bg-verified/12 text-verified", bar: "var(--verified)" }
      : integration.health === "NEEDS_ATTENTION"
        ? { chip: "bg-gap/14 text-gap", bar: "var(--gap)" }
        : { chip: "bg-critical/12 text-critical", bar: "var(--critical)" };
  const statusKey =
    integration.health === "HEALTHY" ? "stConnected" : integration.health === "NEEDS_ATTENTION" ? "stAttention" : "stBroken";

  const Chevron = locale === "en" ? ChevronRight : ChevronLeft;

  return (
    <aside className="card-shadow flex h-fit max-h-[inherit] flex-col overflow-hidden card xl:sticky xl:top-4">
      {/* الرأس */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border p-4">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${integration.color} 12%, transparent)` }}
        >
          <PlatformLogo platform={integration.logoKey} size={17} />
        </span>
        <span className="flex-1 section-title">
          {locale === "en" ? integration.name : integration.nameAr}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tone.chip}`}>{tr(statusKey)}</span>
        <button
          onClick={onClose}
          aria-label={tr("closePanel")}
          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-text-primary"
        >
          <X size={16} />
        </button>
      </div>

      {/* تبويبات اللوحة */}
      <div className="flex shrink-0 gap-1 border-b border-border px-3">
        <DTab active={tab === "overview"} onClick={() => setTab("overview")} label={tr("drawerOverview")} />
        <DTab active={tab === "accounts"} onClick={() => setTab("accounts")} label={tr("drawerAccounts", { n: integration.accountCount })} />
        <DTab active={tab === "permissions"} onClick={() => setTab("permissions")} label={tr("drawerPermissions")} />
        <DTab active={tab === "activity"} onClick={() => setTab("activity")} label={tr("drawerActivity")} />
      </div>

      {/* الجسم وحده يتمرّر - الرأس والتبويبات فوقه ثابتان */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "overview" && (
          <div className="flex flex-col">
            <Row icon={CircleDot} label={tr("dStatus")}>
              <span className="flex items-center gap-1.5 text-text-primary">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.bar }} />
                {tr(statusKey)}
              </span>
            </Row>

            <Row icon={Activity} label={tr("dHealth")}>
              <span className="flex items-center gap-2">
                <span className="tabular-nums text-text-primary">{integration.healthPct}%</span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-raised">
                  <span className="block h-full rounded-full" style={{ width: `${integration.healthPct}%`, background: tone.bar }} />
                </span>
              </span>
            </Row>

            <Row icon={Clock} label={tr("dLastSync")}>
              <span className="text-text-primary">{rel(integration.lastSyncAt) ?? tr("neverSynced")}</span>
            </Row>

            <Row icon={Users} label={tr("dAccounts")}>
              <button onClick={() => setTab("accounts")} className="flex items-center gap-1 text-accent">
                <span className="tabular-nums">{integration.accountCount}</span>
                <Chevron size={13} />
              </button>
            </Row>

            <Row icon={isStore ? ShoppingBag : Megaphone} label={isStore ? tr("dOrders") : tr("dCampaigns")}>
              {isStore ? (
                <span className="tabular-nums text-text-primary">{integration.entityCount.toLocaleString("en-US")}</span>
              ) : (
                <button onClick={onManageCampaigns} className="flex items-center gap-1 text-accent">
                  <span className="tabular-nums">{integration.entityCount}</span>
                  <Chevron size={13} />
                </button>
              )}
            </Row>

            {/* صفوف مكتوبة فعلاً - دليل أن التكامل حيّ لا مجرّد متصل */}
            <Row icon={Database} label={tr("dRecords")}>
              <span className="tabular-nums text-text-primary">{integration.recordsLast7Days.toLocaleString("en-US")}</span>
            </Row>

            <Row icon={RefreshCw} label={tr("dSyncType")}>
              <span className="text-text-primary">{isStore ? tr("dSyncWebhook") : tr("dSyncScheduled")}</span>
            </Row>

            <Row icon={Radio} label={tr("dDataFlow")}>
              <span className={integration.health === "BROKEN" ? "text-critical" : "text-verified"}>
                {integration.health === "BROKEN" ? tr("dFlowStopped") : tr("dFlowLive")}
              </span>
            </Row>

            {integration.connectedAt && (
              <Row icon={CalendarDays} label={tr("dConnectedAt")}>
                <span className="tabular-nums text-text-primary">
                  {new Date(integration.connectedAt).toLocaleDateString(locale === "en" ? "en-GB" : "ar-EG")}
                </span>
              </Row>
            )}

            {integration.expiresAt && (
              <Row icon={KeyRound} label={tr("dExpiresAt")}>
                <span className="tabular-nums text-text-primary">
                  {new Date(integration.expiresAt).toLocaleDateString(locale === "en" ? "en-GB" : "ar-EG")}
                </span>
              </Row>
            )}

            {/* سبب الحالة مكتوب دائماً - لا شارة بلا تفسير */}
            <p className="card mt-3 bg-surface-raised/70 p-3 text-[12px] leading-relaxed text-text-muted">
              {t(locale, `integrations.${integration.healthReason.key}`, resolveVars(locale, integration.healthReason.vars))}
            </p>
          </div>
        )}

        {tab === "accounts" && (
          <div>
            <ul className="mb-3 flex flex-col gap-1.5">
              {integration.accounts.length === 0 ? (
                <li className="text-[12.5px] text-text-muted">{tr("hrNoCampaigns")}</li>
              ) : (
                integration.accounts.map((a) => (
                  <li key={a.id} className="card flex items-center justify-between gap-2 bg-surface-raised/70 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-text-primary" title={a.label}>
                      {a.label}
                    </span>
                    {!isStore && (
                      <span className="shrink-0 text-[11px] text-text-faint">
                        {a.campaignCount > 0 ? tr("accountCampaigns", { n: a.campaignCount }) : tr("accountNoCampaigns")}
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>

            {/* ==================== تسجيلات الدخول ====================

                منحةٌ واحدة قد تصل حسابات كثيرة (MCC في جوجل، Business في
                ميتا) - فالقائمة فوق هي الحسابات، وهذه هي المنح التي وصلتها.
                وحين تتعدّد، لا يفرّق بينها في الواجهة شيء: الشعار واحد
                والاسم واحد. فالتسمية هنا ليست زينة بل ما يجعل «افصل هذه»
                قراراً واعياً بدل مقامرة. */}
            {!isStore && integration.connectPath && integration.grants.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-faint">
                  {tr("grantsTitle")}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {integration.grants.map((g, i) => (
                    <GrantRow
                      key={g.id}
                      grant={g}
                      index={i}
                      locale={locale}
                      connectPath={integration.connectPath!}
                      canRemove={integration.grants.length > 1}
                      onRemove={() => onDisconnectGrant(g.id)}
                    />
                  ))}
                </ul>
                <a
                  href={`${integration.connectPath}?add=1`}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 card-inset py-2.5 text-[12.5px] font-medium text-text-primary transition-colors hover:border-accent hover:bg-accent/[0.07] hover:text-accent"
                >
                  <Plus size={14} /> {tr("addGrant")}
                </a>
                <p className="mt-2 text-[11px] leading-relaxed text-text-faint">{tr("addGrantHint")}</p>
              </div>
            )}

            {/* حسابات متعدّدة تحت ربط واحد: MCC في جوجل وBusiness في ميتا
                يعرضان عدّة حسابات إعلانية بنفس التفويض - فإضافة حساب هي
                اختيار حملات منه، لا تفويض جديد. */}
            {!isStore && (
              <>
                <button
                  onClick={onAddAccount}
                  // بلون الهوية عند الإشارة: الفعلُ إضافةٌ لا هدم، وهو
                  // ما يريده المستخدم غالباً حين يفتح الدرج. اللونُ يجعله
                  // مقصوداً بلا أن يصير زرّاً ممتلئاً يزاحم ما حوله.
                  className="flex w-full items-center justify-center gap-1.5 card-inset py-2.5 text-[12.5px] font-medium text-text-primary transition-colors hover:border-accent hover:bg-accent/[0.07] hover:text-accent"
                >
                  <Plus size={14} /> {tr("addAccount")}
                </button>
                <p className="mt-2 text-[11px] leading-relaxed text-text-faint">{tr("addAccountHint")}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-text-faint">{tr("reconnectDifferent")}</p>
              </>
            )}
          </div>
        )}

        {tab === "permissions" && (
          <ul className="flex flex-col gap-1.5">
            {integration.permissionKeys.map((k) => (
              <li key={k} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-text-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-faint" />
                {tr(k)}
              </li>
            ))}
          </ul>
        )}

        {tab === "activity" && (
          <ul className="flex flex-col gap-1.5">
            {integration.recentRuns.length === 0 ? (
              <li className="text-[12.5px] text-text-muted">{tr("noRuns")}</li>
            ) : (
              integration.recentRuns.map((run) => (
                <li key={run.id} className="card bg-surface-raised/70 px-3 py-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span
                      className={
                        run.status === "SUCCESS" ? "text-verified" : run.status === "FAILED" ? "text-critical" : "text-text-muted"
                      }
                    >
                      {run.status === "SUCCESS" ? tr("runSuccess") : run.status === "FAILED" ? tr("runFailed") : tr("runRunning")}
                    </span>
                    <span className="text-text-faint">{rel(run.startedAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11.5px] text-text-muted">
                    <span>{run.trigger === "MANUAL" ? tr("triggerManual") : tr("triggerCron")}</span>
                    {run.recordsWritten !== null && <span>{tr("rowsWritten", { n: run.recordsWritten })}</span>}
                  </div>
                  {run.errorMessage && <p className="mt-1 text-[11.5px] leading-relaxed text-critical">{run.errorMessage}</p>}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* الإجراءات */}
      <div className="flex flex-col gap-2 border-t border-border p-4">
        {!isStore && (
          <button
            onClick={onSync}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 card-inset py-2.5 text-[12.5px] font-medium text-text-primary disabled:opacity-50"
          >
            <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
            {busy ? tr("syncing") : tr("syncNow")}
          </button>
        )}

        {confirming ? (
          <div className="note border-critical/35 bg-critical/[0.06]">
            <p className="mb-2 text-[12px] leading-relaxed text-text-primary">{tr("confirmDisconnect")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 card py-1.5 text-[12px] text-text-muted"
              >
                {tr("cancel")}
              </button>
              <button
                onClick={onDisconnect}
                disabled={busy}
                className="btn btn-danger btn-sm flex-1"
              >
                {busy ? tr("disconnecting") : tr("disconnect")}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="btn btn-danger border border-critical/30 bg-critical/[0.06] text-critical"
          >
            {tr("disconnect")}
          </button>
        )}
      </div>
    </aside>
  );
}

/**
 * المحرّك يمرّر `since` بالساعات لا كنصّ - نصوغه هنا بلغة الواجهة. لو صيغ
 * في الخادم لانغلقت اللغة عند لحظة الحساب.
 */
function resolveVars(
  locale: Locale,
  vars: Record<string, string | number> | undefined
): Record<string, string | number> | undefined {
  if (!vars) return undefined;
  if (typeof vars.since !== "number") return vars;
  return { ...vars, since: durationFromHours(locale, vars.since) };
}

function DTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-2.5 py-2.5 text-[12px] font-medium transition-colors ${
        active ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function Row({
  icon: Icon, label, children,
}: {
  icon: typeof CircleDot;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2.5 text-[12.5px] last:border-0">
      <span className="flex items-center gap-2 text-text-muted">
        <Icon size={14} className="text-text-faint" />
        {label}
      </span>
      <span className="text-end font-medium">{children}</span>
    </div>
  );
}

/**
 * سطرُ تسجيل دخولٍ واحد.
 *
 * الاسم قابل للتحرير في مكانه لا في نافذة: تسميةُ منحةٍ فعلٌ صغير يُفعل
 * مرّةً عند إضافتها، ونافذةٌ كاملة له تجعله يبدو أثقل ممّا هو فيُؤجَّل -
 * ومنحةٌ بلا اسم هي أصل الالتباس الذي جاءت التسمية تحلّه.
 */
function GrantRow({
  grant, index, locale, connectPath, canRemove, onRemove,
}: {
  grant: ActiveIntegration["grants"][number];
  index: number;
  locale: Locale;
  connectPath: string;
  /** آخر منحةٍ باقية لا تُفصَل من هنا - فصلُها فصلٌ للمنصّة كلّها، وله زرّه */
  canRemove: boolean;
  onRemove: () => void;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) =>
    t(locale, `integrations.${k}`, vars);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(grant.label ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const router = useRouter();

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/connected-platforms/${grant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: value }),
    }).catch(() => null);
    setSaving(false);
    setEditing(false);
    if (res?.ok) router.refresh();
  }

  // اسمٌ افتراضيّ مرقَّم حتى يسمّيها المشترك - «تسجيل الدخول ١» يفرّق،
  // و«جوجل» مكرّرةً لا تفرّق.
  const shown = grant.label || tr("grantFallback", { n: index + 1 });
  const connectedRel = relativeFromDate(locale, grant.connectedAt);

  return (
    <li className="card bg-surface-raised/70 px-3 py-2.5">
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <input
              autoFocus
              value={value}
              maxLength={60}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") { setValue(grant.label ?? ""); setEditing(false); }
              }}
              placeholder={tr("grantNamePlaceholder")}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-[12.5px] text-text-primary outline-none focus:border-accent"
            />
            <button
              onClick={save}
              disabled={saving}
              className="shrink-0 rounded-lg px-2 py-1 text-[11.5px] font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {tr("grantSave")}
            </button>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-text-primary" title={shown}>
              {shown}
            </span>
            <button
              onClick={() => setEditing(true)}
              aria-label={tr("grantRename")}
              title={tr("grantRename")}
              className="shrink-0 rounded-lg p-1 text-text-faint hover:bg-surface hover:text-text-primary"
            >
              <Pencil size={13} />
            </button>
          </>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-text-faint">
        {/* `relativeFromDate` قد تُرجع null لتاريخٍ غائب - و`connectedAt` لا
            يغيب، لكن الصياغة تُبنى على ما يضمنه النوع لا على ما نتوقّعه. */}
        {connectedRel && <span>{tr("grantConnectedAt", { d: connectedRel })}</span>}
        {/* الحسابات تُكتشف عند فتح «اختر الحملات» - فقبله لا نعرفها، ولا
            نكتب صفراً يوحي بأنّ المنحة لا تصل شيئاً. */}
        {grant.reachableAccounts.length > 0 && (
          <span title={grant.reachableAccounts.map((a) => a.name ?? a.id).join(" · ")}>
            · {tr("grantReaches", { n: grant.reachableAccounts.length })}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <a
          href={`${connectPath}?reconnect=${encodeURIComponent(grant.id)}`}
          className="rounded-lg px-2 py-1 text-[11.5px] font-medium text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
        >
          {tr("grantReconnect")}
        </a>
        {canRemove && (
          <button
            // تأكيدٌ بضغطتين: فصلُ منحةٍ يوقف مزامنة حسابٍ حقيقيّ، وهو ما
            // لا يصحّ أن يقع بضغطةٍ عابرة على زرٍّ صغير بين زرَّين.
            onClick={() => (confirmRemove ? onRemove() : setConfirmRemove(true))}
            onBlur={() => setConfirmRemove(false)}
            className={`rounded-lg px-2 py-1 text-[11.5px] font-medium transition-colors ${
              confirmRemove
                ? "bg-critical/12 text-critical"
                : "text-text-muted hover:bg-surface hover:text-critical"
            }`}
          >
            {confirmRemove ? tr("grantRemoveConfirm") : tr("grantRemove")}
          </button>
        )}
      </div>
    </li>
  );
}
