"use client";

// نافذة اختيار الحملات - تُفتح فور ربط المنصة (ومن الرئيسية وصفحة المنصة)
// بدل إجبار المستخدم على الذهاب إلى الإعدادات.
//
// ملاحظة مهمة: النسخة السابقة في الإعدادات كانت تتجاهل فشل الطلب بصمت
// (if (res.ok) بلا else)، فيظهر للمستخدم "لا شيء" دون أي تفسير. هنا كل
// حالة لها رسالة صريحة: تحميل، خطأ، لا توجد حملات، نجاح.

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Search, Check, AlertCircle, Loader2 } from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { t } from "@/lib/i18n/dictionary";

type Platform = "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS";

interface Campaign { id: string; name: string; status: string; recentlyActive: boolean }
interface Account {
  accountId: string;
  accountName: string;
  /** اسمُ تسجيل الدخول الذي وصل هذا الحساب - null قبل أن يسمّيه المشترك */
  connectionLabel?: string | null;
  campaigns: Campaign[];
}

const PLATFORM_LABEL: Record<Platform, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  TIKTOK_ADS: "TikTok Ads",
};

export function CampaignPickerModal({
  workspaceId,
  platform,
  open,
  onClose,
  onSaved,
  locale,
}: {
  workspaceId: string;
  platform: Platform;
  open: boolean;
  onClose: () => void;
  onSaved?: (count: number) => void;
  locale: "ar" | "en";
}) {
  const tr = (k: string, vars?: Record<string, string | number>) =>
    t(locale, `picker.${k}`, vars);
  const ar = locale === "ar";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  /** قنوات البيع المتاحة للنسبة - فارغة حين لا متجر مربوط */
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  /** القناة المختارة لكلّ حساب إعلانيّ. المفتاح `accountId`. */
  const [storeByAccount, setStoreByAccount] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [saving, setSaving] = useState(false);
  // تشخيص الاتصال: يظهر عند الفشل ليقول أين توقّف بالضبط بدل "لا توجد حملات"
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<{
    steps: Array<{ key: string; labelKey: string; ok: boolean | null; detailKey?: string; detailVars?: Record<string, string | number> }>;
    verdictKey: string;
    verdictVars?: Record<string, string | number>;
  } | null>(null);

  async function diagnose() {
    setDiagnosing(true);
    setDiagnosis(null);
    const res = await fetch("/api/oauth/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    }).catch(() => null);
    setDiagnosing(false);
    if (!res) return;
    const data = await res.json().catch(() => null);
    if (data?.steps) setDiagnosis(data);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/available-campaigns?platform=${platform}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? (ar ? tr("errFetch") : "Could not load campaigns."));
        setAccounts([]);
      } else {
        setAccounts(data.accounts ?? []);
        setStores(data.stores ?? []);
        // ما نُسب من قبل يظهر مختاراً: النافذة تعرض الحالة لا تعيد ضبطها.
        const prior: Record<string, string> = {};
        for (const a of data.accounts ?? []) {
          const hit = (a.campaigns ?? []).find((c: Campaign) => data.assigned?.[c.id]);
          if (hit) prior[a.accountId] = data.assigned[hit.id];
        }
        setStoreByAccount(prior);
        // الحملات النشطة مُحدَّدة مسبقاً - الاختيار الأكثر منطقية افتراضياً
        const preselect = new Set<string>();
        for (const a of data.accounts ?? []) {
          for (const c of a.campaigns) if (c.recentlyActive) preselect.add(c.id);
        }
        setSelected(preselect);
      }
    } catch {
      setError(ar ? tr("errServer") : "Could not reach the server.");
    }
    setLoading(false);
  }, [workspaceId, platform, ar]);

  useEffect(() => { if (open) load(); }, [open, load]);

  if (!open) return null;

  const visible = accounts.map((a) => ({
    ...a,
    campaigns: a.campaigns.filter(
      (c) => (!onlyActive || c.recentlyActive) && c.name.toLowerCase().includes(query.toLowerCase())
    ),
  })).filter((a) => a.campaigns.length > 0);

  const totalVisible = visible.reduce((s, a) => s + a.campaigns.length, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allIds = visible.flatMap((a) => a.campaigns.map((c) => c.id));
    const allOn = allIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const campaigns = accounts.flatMap((acc) =>
      acc.campaigns.filter((c) => selected.has(c.id)).map((c) => ({
        platform,
        externalAccountId: acc.accountId,
        externalCampaignId: c.id,
        campaignName: c.name,
        connectionId: storeByAccount[acc.accountId] ?? null,
      }))
    );
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/campaign-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaigns }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        // حدّ الحسابات يعود رمزاً لا جملة، لأنّ الرقمين (الحدّ والمطلوب)
        // يُصاغان بلغة القارئ لا بلغة الخادم. وعرضُ الرمز كما هو («plan_limit»)
        // يترك المشترك أمام رفضٍ لا يفهم سببه ولا يعرف مخرجه.
        setError(
          d.error === "plan_limit" && d.scope === "adAccounts"
            ? tr("errAdAccountLimit", { limit: d.limit, current: d.current })
            : d.error ?? (ar ? tr("errSave") : "Could not save campaigns.")
        );
        setSaving(false);
        return;
      }
      onSaved?.(campaigns.length);
      onClose();
    } catch {
      setError(ar ? tr("errServer") : "Could not reach the server.");
    }
    setSaving(false);
  }

  // 🔴 **نافذتان مرسومتان فوق بعضهما - لا اهتزاز.**
  //
  // كانت تُركَّب داخل شجرة مَن يفتحها. وبوّابة الترحيب غلافٌ ثابتٌ بطبقة
  // `z-[9999]` وخلفيّةٍ شبه شفّافة، وهذه كانت `z-[80]` - فتقع **داخله** لا
  // فوقه، فتُقرأ خلفيّتُه من خلالها ونصُّه من خلال نصّها: كلامان متراكبان
  // كما في لقطة المالك.
  //
  // ورفعُ الرقم وحده لا يكفي: عنصرٌ داخل سياق تكديسٍ خاصّ لا يعلوه مهما
  // بلغ رقمه. فتخرج من الشجرة إلى جذر المستند، وتُصلَّب خلفيّتُها (بلا
  // تضبيبٍ يُبقي ما تحتها مقروءاً) فلا يبقى إلّا هي.
  //
  // `typeof document` لأنّ التصيير على الخادم لا مستند فيه.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        dir={ar ? "rtl" : "ltr"}
        onClick={(e) => e.stopPropagation()}
        className="pop-shadow flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden card"
      >
        {/* الرأس */}
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-2.5">
            <PlatformLogo platform={platform} size={22} />
            <div>
              <h2 className="section-title">
                {ar ? tr("title") : "Choose campaigns to track"}
              </h2>
              <p className="text-[12px] text-text-muted">{PLATFORM_LABEL[platform]}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-text-primary" aria-label="close">
            <X size={18} />
          </button>
        </div>

        {/* أدوات التصفية */}
        {accounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
            <div className="relative min-w-[180px] flex-1">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-text-faint" style={{ insetInlineStart: 10 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ar ? tr("search") : "Search campaigns"}
                className="w-full card-inset py-2 text-[13px] text-text-primary outline-none placeholder:text-text-faint focus:border-accent"
                style={{ paddingInlineStart: 30, paddingInlineEnd: 10 }}
              />
            </div>
            <button
              onClick={() => setOnlyActive((v) => !v)}
              className={`rounded-lg border px-3 py-2 text-[12px] transition-colors ${
                onlyActive ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-muted"
              }`}
            >
              {ar ? tr("activeOnly") : "Active only"}
            </button>
            <button onClick={toggleAll} className="btn btn-secondary btn-sm">
              {ar ? tr("selectAll") : "Select all"}
            </button>
          </div>
        )}

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-12 text-text-muted">
              <Loader2 size={26} className="animate-spin" />
              <span className="text-[13px]">{ar ? tr("loading") : "Loading your campaigns..."}</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertCircle size={28} className="text-critical" />
              <p className="max-w-sm text-[13px] leading-relaxed text-text-primary">{error}</p>
              <div className="flex gap-2">
                <button onClick={load} className="btn btn-secondary">
                  {ar ? tr("retry") : "Try again"}
                </button>
                <button onClick={diagnose} disabled={diagnosing}
                        className="btn btn-primary">
                  {diagnosing ? (ar ? tr("testing") : "Testing...") : ar ? tr("testConnection") : "Test connection"}
                </button>
              </div>
            </div>
          )}

          {/* نتيجة تشخيص الاتصال - خطوة بخطوة */}
          {diagnosis && (
            <div className="mx-auto mt-4 max-w-md card-inset pad-md text-start">
              <p className="mb-3 text-[13px] font-medium text-text-primary">{t(locale, `connTest.${diagnosis.verdictKey}`, diagnosis.verdictVars)}</p>
              <ul className="flex flex-col gap-2">
                {diagnosis.steps.map((st: any) => (
                  <li key={st.key} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">
                      {st.ok === true ? <Check size={13} className="text-verified" />
                        : st.ok === false ? <AlertCircle size={13} className="text-critical" />
                        : <span className="block h-3 w-3 rounded-full border border-border" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] text-text-primary">{t(locale, `connTest.${st.labelKey}`)}</span>
                      {st.detailKey && <span className="block text-[11.5px] leading-relaxed text-text-muted">{t(locale, `connTest.${st.detailKey}`, st.detailVars)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && !error && totalVisible === 0 && (
            <div className="py-12 text-center text-[13px] text-text-muted">
              {accounts.length === 0
                ? ar ? tr("noneInAccount") : "No campaigns found in this account."
                : ar ? tr("noneMatching") : "No campaigns match the current filter."}
              {accounts.length === 0 && (
                <div className="mt-3">
                  <button onClick={diagnose} disabled={diagnosing}
                          className="btn btn-primary">
                    {diagnosing ? (ar ? tr("testing") : "Testing...") : ar ? tr("testConnection") : "Test connection"}
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && !error && visible.map((acc) => (
            <div key={acc.accountId} className="mb-5 last:mb-0">
              {/* اسمُ تسجيل الدخول بجانب اسم الحساب حين تتعدّد المنح - حسابان
                  متشابها الاسم تحت عميلين مختلفين لا يفرّق بينهما غيره. */}
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] font-medium text-text-muted">
                <span>{acc.accountName}</span>
                {acc.connectionLabel && (
                  <span className="text-[11px] font-normal text-text-faint">· {acc.connectionLabel}</span>
                )}
                {/* لا يظهر إلّا بقناتين: بقناةٍ واحدة لا خيار، والحقل
                    الذي لا بديل فيه ضجيج. */}
                {stores.length > 1 && (
                  <label className="ms-auto flex items-center gap-1.5 text-[11.5px] font-normal">
                    <span className="text-text-faint">{tr("sellsFor")}</span>
                    <select
                      value={storeByAccount[acc.accountId] ?? ""}
                      onChange={(e) =>
                        setStoreByAccount((prev) => ({ ...prev, [acc.accountId]: e.target.value }))
                      }
                      className="field py-1 text-[11.5px]"
                    >
                      <option value="">{tr("noStoreAssigned")}</option>
                      {stores.map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {acc.campaigns.map((c) => {
                  const on = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggle(c.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-start transition-colors ${
                        on ? "border-accent bg-accent/[0.07]" : "border-border bg-surface-raised hover:border-border-visible"
                      }`}
                    >
                      <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border ${on ? "border-accent bg-accent text-white" : "border-border"}`} style={{ height: 18, width: 18 }}>
                        {on && <Check size={12} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{c.name}</span>
                      {c.recentlyActive && (
                        <span className="shrink-0 rounded-full bg-verified/12 px-2 py-0.5 text-[10.5px] font-medium text-verified">
                          {ar ? tr("active") : "Active"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* التذييل */}
        <div className="flex items-center justify-between gap-3 border-t border-border p-4">
          <span className="text-[12.5px] text-text-muted">
            {ar ? tr("selectedCount", { n: selected.size }) : `${selected.size} selected`}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-secondary">
              {ar ? tr("later") : "Later"}
            </button>
            <button
              onClick={save}
              disabled={saving || selected.size === 0}
              className="btn btn-primary"
            >
              {saving ? (ar ? tr("saving") : "Saving...") : ar ? tr("save") : "Save & continue"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
