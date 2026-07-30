"use client";

// متصفّح قرارات الأتمتة: منصة ← فئة ← قرار ← نطاق الحملات.
// النسخة السابقة كانت قائمة مسطّحة من أربعة قوالب بلا تقسيم ولا نطاق.

import { useState } from "react";
import * as Icons from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import {
  RULE_CATEGORIES, templatesFor, countByCategory,
  type RulePlatform, type RuleCategoryId, type RuleTemplate,
} from "@/lib/automationCatalog";
import { t, type Locale } from "@/lib/i18n/dictionary";

// أسماء المنصات التجارية تبقى كما هي في اللغتين؛ "كل المنصات" وحدها تُترجَم.
const PLATFORM_TABS: { id: RulePlatform | null; label?: string; color: string }[] = [
  { id: null, color: "var(--accent)" },
  { id: "GOOGLE_ADS", label: "Google Ads", color: "#4285F4" },
  { id: "META_ADS", label: "Meta Ads", color: "#0866FF" },
  { id: "TIKTOK_ADS", label: "TikTok Ads", color: "#FE2C55" },
];


const ACTION_TONE: Record<string, string> = {
  PAUSE_CAMPAIGN: "var(--critical)",
  PAUSE_AD: "var(--critical)",
  REDUCE_BUDGET_PCT: "var(--gap)",
  INCREASE_BUDGET_PCT: "var(--verified)",
  ADJUST_BID_PCT: "var(--accent)",
  SEND_ALERT_ONLY: "var(--text-muted)",
};

const UNIT_SUFFIX: Record<string, string> = {
  currency: "", percent: "%", number: "", days: "days", minutes: "minutes", ratio: "x",
};

export function RuleCatalogBrowser({
  workspaceId,
  campaigns,
  currency,
  locale = "ar",
}: {
  workspaceId: string;
  campaigns: { id: string; name: string; platform: string }[];
  currency: string;
  locale?: Locale;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `autoRules.${k}`, vars);
  const [platform, setPlatform] = useState<RulePlatform | null>(null);
  const [category, setCategory] = useState<RuleCategoryId>("truth");
  const [chosen, setChosen] = useState<RuleTemplate | null>(null);

  const counts = countByCategory(platform);
  const list = templatesFor(platform, category);

  return (
    <div>
      {/* المنصة */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {PLATFORM_TABS.map((tab) => {
          const active = platform === tab.id;
          return (
            <button
              key={tab.id ?? "all"}
              onClick={() => setPlatform(tab.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors ${
                active ? "border-transparent text-white" : "border-border bg-surface text-text-muted hover:text-text-primary"
              }`}
              style={active ? { background: tab.color } : undefined}
            >
              {tab.id ? <PlatformLogo platform={tab.id} size={15} /> : <Icons.Layers size={14} />}
              {tab.label ?? tr("allPlatforms")}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
        {/* الفئات */}
        <aside className="flex flex-col gap-1">
          {RULE_CATEGORIES.map((cat) => {
            const Icon = (Icons as any)[cat.icon] ?? Icons.Circle;
            const active = category === cat.id;
            const n = counts[cat.id] ?? 0;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                disabled={n === 0}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-start transition-colors disabled:opacity-40 ${
                  active ? "border-accent bg-accent/[0.08]" : "border-border bg-surface hover:border-border-visible"
                }`}
              >
                <Icon size={16} className={active ? "text-accent" : "text-text-muted"} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[13px] font-medium ${active ? "text-accent" : "text-text-primary"}`}>
                    {cat.labelAr}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-surface-raised px-1.5 py-0.5 font-mono text-[10.5px] text-text-muted">{n}</span>
              </button>
            );
          })}
        </aside>

        {/* القرارات */}
        <div>
          <p className="mb-3 text-[12.5px] text-text-muted">
            {RULE_CATEGORIES.find((c) => c.id === category)?.descAr}
          </p>
          <div className="flex flex-col gap-2">
            {list.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setChosen(tpl)}
                className="card-shadow flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-start hover:border-accent"
              >
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: ACTION_TONE[tpl.action] }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-text-primary">{locale === "en" ? tpl.nameEn : tpl.nameAr}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-text-muted">{locale === "en" ? tpl.descEn : tpl.descAr}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-medium" style={{ background: `color-mix(in srgb, ${ACTION_TONE[tpl.action]} 14%, transparent)`, color: ACTION_TONE[tpl.action] }}>
                      {tr(`a${tpl.action}`)}{tpl.actionValue ? ` ${Math.abs(tpl.actionValue)}%` : ""}
                    </span>
                    <span className="rounded-full bg-surface-raised px-2 py-0.5 font-mono text-[10.5px] text-text-muted">
                      {tpl.operator === "GREATER_THAN" ? tr("greaterThan") : tr("lessThan")} {tpl.threshold}{UNIT_SUFFIX[tpl.unit] || (tpl.unit === "currency" ? ` ${currency}` : "")}
                    </span>
                    <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10.5px] text-text-muted">
                      {tr("consecutiveDays", { n: tpl.consecutiveDays })}
                    </span>
                    {tpl.platforms.length < 3 && (
                      <span className="flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-[10.5px] text-text-muted">
                        {tpl.platforms.map((p) => <PlatformLogo key={p} platform={p} size={11} />)}
                      </span>
                    )}
                  </span>
                </span>
                <Icons.Plus size={16} className="mt-0.5 shrink-0 text-text-faint" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {chosen && (
        <RuleConfigModal
          locale={locale}
          workspaceId={workspaceId}
          template={chosen}
          platform={platform}
          campaigns={campaigns}
          currency={currency}
          onClose={() => setChosen(null)}
        />
      )}
    </div>
  );
}

// ============ نافذة الضبط: العتبة + نطاق الحملات ============
function RuleConfigModal({
  workspaceId, template, platform, campaigns, currency, locale, onClose,
}: {
  workspaceId: string;
  template: RuleTemplate;
  platform: RulePlatform | null;
  campaigns: { id: string; name: string; platform: string }[];
  currency: string;
  locale: Locale;
  onClose: () => void;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `autoRules.${k}`, vars);
  const [threshold, setThreshold] = useState(template.threshold);
  const [days, setDays] = useState(template.consecutiveDays);
  const [actionValue, setActionValue] = useState(template.actionValue ?? 0);
  // منصة القاعدة تُختار هنا صراحةً قبل الحملات: كان الاعتماد على تبويب
  // الأعلى ضمنياً فيختار المستخدم حملات دون أن يعرف على أي منصة تُطبَّق.
  const [rulePlatform, setRulePlatform] = useState<RulePlatform | null>(
    platform ?? (template.platforms.length === 1 ? template.platforms[0] : null)
  );
  const [scope, setScope] = useState<"ALL_CAMPAIGNS" | "SPECIFIC_CAMPAIGNS">("ALL_CAMPAIGNS");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [requireApproval, setRequireApproval] = useState(template.requireApproval);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // حملات المنصات التي يصلح لها هذا القرار فقط
  const eligible = campaigns.filter(
    (c) => template.platforms.includes(c.platform as RulePlatform) &&
           (!rulePlatform || c.platform === rulePlatform)
  );

  async function save() {
    if (scope === "SPECIFIC_CAMPAIGNS" && picked.size === 0) {
      setError(tr("errPickCampaign"));
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/automation-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: locale === "en" ? template.nameEn : template.nameAr,
        templateId: template.id,
        metric: template.metric,
        operator: template.operator,
        threshold,
        consecutiveDays: days,
        attributionBasis: template.attributionBasis,
        action: template.action,
        actionValue: template.actionValue !== undefined ? actionValue : undefined,
        requireApproval,
        maxSingleJumpPct: template.maxSingleJumpPct,
        cooldownDays: template.cooldownDays,
        platform: rulePlatform ?? null,
        appliesTo: scope,
        specificCampaignIds: scope === "SPECIFIC_CAMPAIGNS" ? [...picked] : [],
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? tr("errSave"));
      setSaving(false);
      return;
    }
    onClose();
    location.reload();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="pop-shadow flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border p-5">
          <h2 className="text-[15px] font-semibold text-text-primary">{template.nameAr}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">{template.descAr}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* العتبة */}
          <label className="mb-1.5 block text-[12.5px] text-text-muted">
            {tr("conditionIs", { op: template.operator === "GREATER_THAN" ? tr("greaterThan") : tr("lessThan") })}
          </label>
          <div className="mb-4 flex items-center gap-2">
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-32 rounded-xl border border-border bg-surface-raised px-3 py-2 font-mono text-[14px] text-text-primary outline-none focus:border-accent"
            />
            <span className="text-[13px] text-text-muted">
              {template.unit === "currency" ? currency : UNIT_SUFFIX[template.unit] || ""}
            </span>
          </div>

          {/* الأيام */}
          <label className="mb-1.5 block text-[12.5px] text-text-muted">{tr("daysBeforeApply")}</label>
          <input
            type="number" min={1} max={30} value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="mb-4 w-32 rounded-xl border border-border bg-surface-raised px-3 py-2 font-mono text-[14px] text-text-primary outline-none focus:border-accent"
          />

          {/* قيمة الإجراء */}
          {template.actionValue !== undefined && (
            <>
              <label className="mb-1.5 block text-[12.5px] text-text-muted">
                {tr("actionByPct", { action: tr(`a${template.action}`) })}
              </label>
              <input
                type="number" value={actionValue}
                onChange={(e) => setActionValue(Number(e.target.value))}
                className="mb-4 w-32 rounded-xl border border-border bg-surface-raised px-3 py-2 font-mono text-[14px] text-text-primary outline-none focus:border-accent"
              />
            </>
          )}

          {/* المنصة - قبل النطاق مباشرة */}
          <label className="mb-1.5 block text-[12.5px] text-text-muted">{tr("platform")}</label>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => { setRulePlatform(null); setPicked(new Set()); }}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] transition-colors ${
                rulePlatform === null ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-muted"
              }`}
            >
              <Icons.Layers size={14} /> {tr("allPlatforms")}
            </button>
            {template.platforms.map((p) => (
              <button
                key={p}
                onClick={() => { setRulePlatform(p); setPicked(new Set()); }}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] transition-colors ${
                  rulePlatform === p ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-muted"
                }`}
              >
                <PlatformLogo platform={p} size={14} />
                {p === "GOOGLE_ADS" ? "Google" : p === "META_ADS" ? "Meta" : "TikTok"}
              </button>
            ))}
          </div>

          {/* نطاق الحملات */}
          <label className="mb-1.5 block text-[12.5px] text-text-muted">{tr("scope")}</label>
          <div className="mb-3 flex gap-2">
            {([["ALL_CAMPAIGNS", tr("allCampaigns")], ["SPECIFIC_CAMPAIGNS", tr("specificCampaigns")]] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setScope(v)}
                className={`flex-1 rounded-xl border px-3 py-2 text-[12.5px] transition-colors ${
                  scope === v ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-muted"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {scope === "SPECIFIC_CAMPAIGNS" && (
            <div className="mb-4 max-h-52 overflow-y-auto rounded-xl border border-border p-2">
              {eligible.length === 0 ? (
                <p className="p-3 text-center text-[12.5px] text-text-muted">{tr("noCampaignsForPlatform")}</p>
              ) : (
                eligible.map((c) => {
                  const on = picked.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setPicked((prev) => {
                        const n = new Set(prev);
                        n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                        return n;
                      })}
                      className={`mb-1 flex w-full items-center gap-2.5 rounded-lg p-2.5 text-start last:mb-0 ${on ? "bg-accent/[0.08]" : "hover:bg-surface-raised"}`}
                    >
                      <span className={`flex items-center justify-center rounded-md border ${on ? "border-accent bg-accent text-white" : "border-border"}`} style={{ height: 16, width: 16 }}>
                        {on && <Icons.Check size={11} />}
                      </span>
                      <PlatformLogo platform={c.platform} size={13} />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-primary">{c.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* الموافقة */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-surface-raised p-3">
            <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="block text-[12.5px] font-medium text-text-primary">{tr("askApprovalBefore")}</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-text-muted">
                {tr("askApprovalHint")}
              </span>
            </span>
          </label>

          {error && <p className="mt-3 text-[12.5px] text-critical">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="rounded-xl border border-border bg-surface-raised px-4 py-2 text-[13px] text-text-muted">{tr("cancel")}</button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-accent px-5 py-2 text-[13px] font-medium text-white disabled:opacity-50">
            {saving ? tr("saving") : tr("activateRule")}
          </button>
        </div>
      </div>
    </div>
  );
}
