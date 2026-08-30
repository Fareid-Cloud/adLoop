"use client";

// القواعد المفعّلة: تشغيل/إيقاف، تعديل القيم، وحذف نهائي. الإيقاف وحده
// كان يترك القواعد تتراكم فتزدحم الصفحة بلا فائدة. ويُعرض نطاق كل قاعدة
// بالاسم (الحملات المطبَّق عليها) وشعار منصتها، لا رقماً مجرداً.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Pencil, Check, X, Layers, AlertTriangle } from "lucide-react";
import { Toggle } from "@/app/components/ui/Toggle";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";

export interface RuleRow {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  action: string;
  actionValue: number | null;
  enabled: boolean;
  requireApproval: boolean;
  platform: string | null;
  appliesTo: string;
  specificCampaignIds: string[];
  consecutiveDays: number;
}



// ألوان العلامات الرسمية - نفس القيم المستخدمة في بقيّة المنتج، فتُقرأ
// المنصة من لونها قبل قراءة اسمها.
const PLATFORM_TINT: Record<string, string> = {
  GOOGLE_ADS: "#1A73E8",
  META_ADS: "#0866FF",
  TIKTOK_ADS: "#FE2C55",
};

/** وحدة العتبة بحسب المقياس: مال، أو نسبة، أو مضاعِف. */
function thresholdUnit(metric: string, currency: string): string {
  if (metric === "TRUE_ROAS") return "x";
  if (metric.includes("RATE") || metric.includes("PCT")) return "%";
  return currency;
}

const ACTION_TONE: Record<string, string> = {
  PAUSE_CAMPAIGN: "var(--critical)", PAUSE_AD: "var(--critical)",
  REDUCE_BUDGET_PCT: "var(--gap)", INCREASE_BUDGET_PCT: "var(--verified)",
  ADJUST_BID_PCT: "var(--accent)", SEND_ALERT_ONLY: "var(--text-muted)",
};


export function ActiveRulesList({
  workspaceId, rules, campaigns, locale, currency,
}: {
  workspaceId: string;
  rules: RuleRow[];
  campaigns: { id: string; name: string; platform: string }[];
  locale: Locale;
  /** عملة المساحة - العتبة المالية بلا عملة رقمٌ لا معنى له */
  currency: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const nameOf = (id: string) => campaigns.find((c) => c.id === id)?.name ?? id;

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    await fetch(`/api/workspaces/${workspaceId}/automation-rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    setBusy(null);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(id);
    await fetch(`/api/workspaces/${workspaceId}/automation-rules/${id}`, { method: "DELETE" }).catch(() => {});
    setBusy(null);
    setConfirmDelete(null);
    router.refresh();
  }

  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `autoRules.${k}`, vars);

  if (rules.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-[13px] text-text-muted">
        {tr("noneActive")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rules.map((rule) => {
        const tone = ACTION_TONE[rule.action] ?? "var(--text-muted)";
        const isEditing = editing === rule.id;
        const scoped = rule.appliesTo === "SPECIFIC_CAMPAIGNS" && rule.specificCampaignIds.length > 0;

        return (
          <div key={rule.id} className="card pad-md">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  {rule.platform ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-surface-raised px-2 py-0.5">
                      <PlatformLogo platform={rule.platform} size={13} />
                      <span className="text-[11px] font-medium" style={{ color: PLATFORM_TINT[rule.platform] ?? "var(--text-muted)" }}>
                        {platformLabel(locale, rule.platform)}
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                      <Layers size={12} /> {tr("allPlatforms")}
                    </span>
                  )}
                  <span className="text-[13.5px] font-medium text-text-primary">{rule.name}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                        style={{ background: `color-mix(in srgb, ${tone} 13%, transparent)`, color: tone }}>
                    {tr(`a${rule.action}`)}
                    {rule.actionValue ? ` ${Math.abs(rule.actionValue)}%` : ""}
                  </span>
                  {rule.requireApproval && (
                    <span className="rounded-full bg-gap/12 px-2 py-0.5 text-[10.5px] font-medium text-gap">
                      {tr("needsApproval")}
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <EditRow rule={rule} locale={locale} busy={busy === rule.id} onCancel={() => setEditing(null)}
                           onSave={(body) => { patch(rule.id, body); setEditing(null); }} />
                ) : (
                  <>
                    <p className="text-[12.5px] text-text-muted">
                      {tr(`m${rule.metric}`)}{" "}
                      {rule.operator === "GREATER_THAN" ? tr("greaterThan") : tr("lessThan")}{" "}
                      {/* 🔴 **العتبة كانت رقماً عارياً: «أكبر من ٣٠».**
                          ثلاثون ماذا؟ العتبة مالية في «تكلفة العميل»، ونسبة
                          مئوية في «نسبة التضخيم»، ومضاعِف في «العائد». ورقمٌ
                          يوقف حملةً يجب أن يقول وحدته قبل قيمته. */}
                      <span className="font-mono text-text-primary">
                        {rule.threshold}
                        <span className="ms-1 text-[11px] font-normal text-text-muted">
                          {thresholdUnit(rule.metric, currency)}
                        </span>
                      </span>
                      {" · "}{tr("consecutiveDays", { n: rule.consecutiveDays })}
                    </p>

                    {/* نطاق التطبيق بالأسماء لا بالمعرّفات */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11.5px] text-text-faint">{tr("appliesTo")}</span>
                      {scoped ? (
                        rule.specificCampaignIds.slice(0, 3).map((cid) => (
                          <span key={cid} className="max-w-[190px] truncate rounded-full bg-surface-raised px-2 py-0.5 text-[11px] text-text-muted">
                            {nameOf(cid)}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] text-text-muted">
                          {tr("allCampaigns")}
                        </span>
                      )}
                      {scoped && rule.specificCampaignIds.length > 3 && (
                        <span className="text-[11px] text-text-faint">
                          +{rule.specificCampaignIds.length - 3}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <Toggle checked={rule.enabled} onChange={(v) => patch(rule.id, { enabled: v })} label={tr("enableRule")} />
                <button onClick={() => setEditing(isEditing ? null : rule.id)}
                        className="card-inset p-2 text-text-muted hover:text-text-primary"
                        aria-label={tr("editRule")}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => setConfirmDelete(rule.id)}
                        className="card-inset p-2 text-text-muted hover:text-critical"
                        aria-label={tr("deleteRule")}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {confirmDelete === rule.id && (
              <div className="note mt-3 justify-between border-critical/35 bg-critical/[0.06]">
                <span className="flex items-center gap-2 text-[12.5px] text-text-primary">
                  <AlertTriangle size={14} className="text-critical" />
                  {tr("confirmDelete")}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(null)}
                          className="card px-3 py-1.5 text-[12px] text-text-muted">
                    {tr("cancel")}
                  </button>
                  <button onClick={() => remove(rule.id)} disabled={busy === rule.id}
                          className="btn btn-danger btn-sm">
                    {busy === rule.id ? tr("deleting") : tr("del")}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EditRow({
  rule, busy, onSave, onCancel, locale,
}: {
  rule: RuleRow;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
  onCancel: () => void;
  locale: Locale;
}) {
  const tr = (k: string) => t(locale, `autoRules.${k}`);
  const [threshold, setThreshold] = useState(rule.threshold);
  const [days, setDays] = useState(rule.consecutiveDays);
  const [actionValue, setActionValue] = useState(rule.actionValue ?? 0);
  const [requireApproval, setRequireApproval] = useState(rule.requireApproval);

  return (
    <div className="mt-2 flex flex-wrap items-end gap-3 card-inset pad-sm">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-text-muted">{tr("threshold")}</span>
        <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
               className="field field-sm w-24 font-mono" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-text-muted">{tr("daysRow")}</span>
        <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))}
               className="field field-sm w-20 font-mono" />
      </label>
      {rule.actionValue !== null && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">{tr("actionPct")}</span>
          <input type="number" value={actionValue} onChange={(e) => setActionValue(Number(e.target.value))}
                 className="field field-sm w-20 font-mono" />
        </label>
      )}
      <label className="flex items-center gap-2 pb-1.5 text-[12px] text-text-primary">
        <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />
        {tr("askApproval")}
      </label>

      <div className="flex gap-1.5 pb-0.5">
        <button
          onClick={() => onSave({
            threshold, consecutiveDays: days, requireApproval,
            ...(rule.actionValue !== null ? { actionValue } : {}),
          })}
          disabled={busy}
          className="btn btn-primary btn-sm"
        >
          <Check size={13} /> {tr("save")}
        </button>
        <button onClick={onCancel} className="card p-1.5 text-text-muted">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
