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

  // 🔴 **الشغّال قبل الموقوف، مش مخلوطين بترتيب الإنشاء.**
  //
  // القاعدةُ الموقوفة والشغّالة كان شكلُهما واحداً إلّا مفتاحٌ صغير في
  // الآخر - فقارئُ الصفحة مضطرٌّ يفحص كلَّ بطاقة عشان يعرف إيه اللي
  // بيشتغل فعلاً على حسابه دلوقتي. وهو **السؤالُ الوحيد** اللي الصفحة
  // دي موجودةٌ عشانه.
  const live = rules.filter((r) => r.enabled);
  const paused = rules.filter((r) => !r.enabled);

  const card = (rule: RuleRow) => {
    const tone = ACTION_TONE[rule.action] ?? "var(--text-muted)";
    const isEditing = editing === rule.id;
    const scoped = rule.appliesTo === "SPECIFIC_CAMPAIGNS" && rule.specificCampaignIds.length > 0;

    return (
      // `group` عشان أزرارُ التعديل والحذف تهدا لحدّ ما المؤشّر يقرب.
      // تلاتُ أدواتٍ ظاهرة على كلّ بطاقة بتتحوّل لضوضاء لمّا البطاقات
      // تبقى عشرة - والمفتاحُ وحده هو اللي بيتداس كلّ يوم.
      <div key={rule.id} className={`card pad-md group ${rule.enabled ? "" : "opacity-70"}`}>
        {/* ═══ السطر الأوّل: الاسم والمفتاح ═══
            الاسمُ هو هويّةُ البطاقة فبياخد سطرَه، والمفتاحُ جنبه لأنّه
            الفعلُ الأكثر تكراراً. الشاراتُ تحتهما: بتوصف لا بتعرّف. */}
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-text-primary">
            {rule.name}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Toggle checked={rule.enabled} onChange={(v) => patch(rule.id, { enabled: v })} label={tr("enableRule")} />
            <button onClick={() => setEditing(isEditing ? null : rule.id)}
                    className="rounded-lg p-1.5 text-text-faint opacity-0 transition-opacity hover:text-text-primary focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={tr("editRule")}>
              <Pencil size={14} />
            </button>
            <button onClick={() => setConfirmDelete(rule.id)}
                    className="rounded-lg p-1.5 text-text-faint opacity-0 transition-opacity hover:text-critical focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={tr("deleteRule")}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
            <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
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

            {/* نطاق التطبيق بالأسماء لا بالمعرّفات. اتنين بدل تلاتة:
                البطاقةُ بقت نصَّ العرض، وتلاتُ أسماءِ حملات بتلفّ لسطرين. */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11.5px] text-text-faint">{tr("appliesTo")}</span>
              {scoped ? (
                rule.specificCampaignIds.slice(0, 2).map((cid) => (
                  <span key={cid} className="max-w-[150px] truncate rounded-full bg-surface-raised px-2 py-0.5 text-[11px] text-text-muted">
                    {nameOf(cid)}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] text-text-muted">
                  {tr("allCampaigns")}
                </span>
              )}
              {scoped && rule.specificCampaignIds.length > 2 && (
                <span className="text-[11px] text-text-faint">
                  +{rule.specificCampaignIds.length - 2}
                </span>
              )}
            </div>
          </>
        )}

        {confirmDelete === rule.id && (
          // بيتكدّس رأسياً لا `justify-between`: البطاقةُ بقت نصَّ العرض،
          // والصفُّ الأفقيّ كان بيلفّ فيبقى الزرُّ الأحمر تحت النصّ بلا
          // محاذاة.
          <div className="note mt-3 flex-col items-stretch gap-2 border-critical/35 bg-critical/[0.06]">
            <span className="flex items-center gap-2 text-[12.5px] text-text-primary">
              <AlertTriangle size={14} className="shrink-0 text-critical" />
              {tr("confirmDelete")}
            </span>
            <div className="flex justify-end gap-2">
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
  };

  return (
    <div className="flex flex-col gap-5">
      {live.length > 0 && (
        <section>
          <Heading label={tr("liveHeading")} count={live.length} tone="verified" />
          {/* عمودان من `lg` فصاعداً - البطاقةُ عرضُها ~٤٩٠ بكسل، وهو
              كافٍ لجملةِ الشرط وشاراتها. و`items-start` عشان فتحُ نموذج
              التعديل في بطاقةٍ ما يمطّش جارتها معاها. */}
          <div className="grid items-start gap-2.5 lg:grid-cols-2">
            {live.map(card)}
          </div>
        </section>
      )}

      {paused.length > 0 && (
        <section>
          <Heading label={tr("pausedHeading")} count={paused.length} tone="muted" note={tr("pausedNote")} />
          <div className="grid items-start gap-2.5 lg:grid-cols-2">
            {paused.map(card)}
          </div>
        </section>
      )}
    </div>
  );
}

/** عنوانُ مجموعةٍ بعدّادها - العددُ بيقول حجمَ اللي تحته قبل التمرير. */
function Heading({
  label, count, tone, note,
}: {
  label: string; count: number; tone: "verified" | "muted"; note?: string;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <h3 className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">{label}</h3>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
          tone === "verified" ? "bg-verified/12 text-verified" : "bg-surface-raised text-text-faint"
        }`}
      >
        {count}
      </span>
      {note && <span className="text-[11.5px] text-text-faint">{note}</span>}
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
