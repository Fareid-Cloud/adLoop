"use client";

// app/dashboard/integrations/StoreConnectDialog.tsx
//
// 🔴 **زرّ «ربط» على أيّ متجر لم يكن يفعل شيئاً.**
//
// جوجل وميتا وتيك توك لها `connectPath` يبدأ بـ`/api/` فتذهب إلى OAuth.
// والمتاجر الخمسة `connectPath` عندها صفحة التكاملات **نفسها**، فالنقر
// يسقط إلى فرعٍ لا يفتح شيئاً إلّا لمتجرٍ مربوطٍ سلفاً. أي أنّ المستخدم
// كان يضغط زرّاً معطّلاً بلا رسالة - والمنتج كلّه يقوم على بيانات المتجر.
// وكان مكتوباً في الكود «فجوة معروفة غير مصلَحة»، وهذا إصلاحها.
//
// ═══ لماذا يُولَّد السرّ ولا يُطلَب ═══
//
// أوّل ما يخطر نموذجٌ فيه حقلٌ فارغ اسمه «سرّ الويب هوك». وهو يطلب من
// صاحب متجرٍ أن يخترع سرّاً، فيكتب `12345678` أو اسم متجره - فيصير حارسُ
// بياناته المالية كلمةً يخمّنها أيّ أحد. فنولّده نحن: ٣٢ بايتاً من مولّد
// المتصفّح المعتمد للتعمية، ويبقى دور المستخدم أن **ينسخ**.
//
// وهذا تطبيقٌ للقاعدة الحاكمة: النقطة التي تمنع المستخدم من المتابعة
// تحمل حلّها معها. فالنافذة ليست استمارةً تسأل، بل ثلاث خطواتٍ منفَّذة:
// هذا رابطك، وهذا سرّك، وهذا موضعهما في لوحة متجرك بالاسم.

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, Loader2 } from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import type { IntegrationDef } from "@/lib/integrationsCatalog";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { authSpecFor } from "@/lib/ecommerce/webhookAuth";

/** شريحة المسار لكلّ منصّة - **يجب أن تطابق `SLUG_TO_PLATFORM`** في
 *  `app/api/webhooks/ecommerce/[platform]/route.ts` حرفاً بحرف، وإلّا
 *  نسخ المستخدم رابطاً يردّ ٤٠٤ ولا يعرف لماذا. */
const SLUG: Record<string, string> = {
  SALLA: "salla",
  SHOPIFY: "shopify",
  ZID: "zid",
  WOOCOMMERCE: "woocommerce",
  EASY_ORDERS: "easy-orders",
};

/** أين يقع إعداد الويب هوك في لوحة كلّ منصّة - خطوةٌ لا يعرفها صاحب
 *  المتجر عادةً، وغيابها يحوّل نافذةً كاملةً إلى طريقٍ مسدود. */
const WHERE_KEY: Record<string, string> = {
  SALLA: "whereSalla",
  SHOPIFY: "whereShopify",
  ZID: "whereZid",
  WOOCOMMERCE: "whereWoo",
  EASY_ORDERS: "whereEasyOrders",
};

function generateSecret(): string {
  // `crypto.getRandomValues` لا `Math.random`: الثاني ليس عشوائياً بمعنى
  // التعمية، وهذا السرّ هو ما يمنع أيّ أحدٍ من تلفيق مبيعاتٍ في حسابك.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function StoreConnectDialog({
  def, workspaceId, locale, onClose, onConnected,
}: {
  def: IntegrationDef;
  workspaceId: string;
  locale: Locale;
  onClose: () => void;
  onConnected: () => void;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) =>
    t(locale, `storeConnect.${k}`, vars);

  const platform = def.platform ?? "";
  const slug = SLUG[platform] ?? "";
  // 🔴 **مَن يولّد السرّ يختلف باختلاف المنصّة.** كانت النافذة تولّد
  // سرّاً للخمس وتقول «الصقه في متجرك» - وهو صحيحٌ لووكومرس وحدها.
  // أمّا شوبيفاي وسلّة وإيزي أوردرز فتولّد أسرارها بنفسها: فالسرّ الذي
  // نولّده لا مكان له في لوحاتها، وكلّ ويب هوك يُرفض بـ401 بلا سبب ظاهر.
  const spec = authSpecFor(platform);
  const weGenerate = spec?.direction !== "they_generate";

  // يُولَّد مرّةً واحدة لعمر النافذة: توليده مع كلّ تصيير يعني أنّ ما
  // نسخه المستخدم قبل ثانيةٍ ليس ما سيُحفظ.
  const [generatedSecret] = useState(generateSecret);
  // زد وحدها: مصادقةٌ أساسية باسمٍ وكلمة مرور، فالاسم يُولَّد معه.
  const [username] = useState(() => "adloop-" + generateSecret().slice(0, 10));
  const [pastedSecret, setPastedSecret] = useState("");
  const secret = weGenerate ? generatedSecret : pastedSecret.trim();
  const [storeName, setStoreName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  // 🔴 ووكومرس وحدها تصادق بمفتاحٍ **وسرّ** (Consumer key + secret)، و
  // `priceSync` يرفض العمل بلا الاثنين (`needsSetup`). فحقلٌ واحدٌ هنا كان
  // يعني أنّ تحديث الأسعار على ووكومرس لا يعمل أبداً من الواجهة - والخانة
  // موجودة في الـAPI أصلاً، فكان النقص في النموذج وحده.
  const [apiSecret, setApiSecret] = useState("");
  const needsSecret = platform === "WOOCOMMERCE";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"url" | "secret" | "username" | null>(null);

  const webhookUrl = useMemo(
    () =>
      typeof window === "undefined"
        ? ""
        : window.location.origin + "/api/webhooks/ecommerce/" + slug,
    [slug]
  );

  async function copy(text: string, which: "url" | "secret" | "username") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // إذن الحافظة يُرفض أحياناً. الحقل قابلٌ للتحديد يدوياً، فلا يُعرض
      // خطأٌ على فشلٍ له بديلٌ ظاهرٌ أمام المستخدم مباشرةً.
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces/" + workspaceId + "/ecommerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          webhookSecret: secret,
          webhookUsername: spec?.needsUsername ? username : undefined,
          storeName: storeName.trim() || undefined,
          storeUrl: storeUrl.trim() || undefined,
          apiToken: apiToken.trim() || undefined,
          apiSecret: needsSecret ? apiSecret.trim() || undefined : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // رسالة الخادم أدقّ من أيّ رسالةٍ عامّة هنا: هي التي تعرف أنّ
        // الباقة لا تسمح بمتجرٍ آخر مثلاً، وتلك معلومةٌ لا تخمين.
        setError(data.error || tr("saveFailed"));
        return;
      }
      onConnected();
    } catch {
      setError(tr("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  // إلى `document.body`: النافذة تُفتح من داخل بطاقةٍ لها سياق تراصٍّ
  // خاصّ، فتظهر تحتها لو صُيّرت في مكانها - العلّة نفسها التي أُصلحت في
  // نافذة بوّابة الترحيب.
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg pad-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <PlatformLogo platform={platform} size={28} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-text-primary">
                {tr("title", { store: locale === "en" ? def.name : def.nameAr })}
              </div>
              <div className="text-[12px] text-text-muted">{tr("subtitle")}</div>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon shrink-0" aria-label={tr("close")}>
            <X size={16} />
          </button>
        </div>

        <Step
          n={1}
          title={tr("step1")}
          hint={t(locale, "storeConnect." + (WHERE_KEY[platform] ?? "step1"))}
        >
          <CopyField
            value={webhookUrl}
            onCopy={() => copy(webhookUrl, "url")}
            done={copied === "url"}
            label={tr("copy")}
          />
        </Step>

        <Step
          n={2}
          title={weGenerate ? tr("step2") : tr("step2Paste")}
          hint={t(locale, "storeConnect." + (spec?.hintKey ?? "step2Hint"))}
        >
          {weGenerate ? (
            <>
              {/* زد: الاسم وكلمة المرور يُلصقان معاً في لوحتها -
                  واحدٌ منهما وحده لا يثبت شيئاً. */}
              {spec?.needsUsername && (
                <div className="mb-2">
                  <p className="mb-1 text-[11.5px] text-text-muted">{tr("basicUsername")}</p>
                  <CopyField
                    value={username}
                    mono
                    onCopy={() => copy(username, "username")}
                    done={copied === "username"}
                    label={tr("copy")}
                  />
                </div>
              )}
              {spec?.needsUsername && (
                <p className="mb-1 text-[11.5px] text-text-muted">{tr("basicPassword")}</p>
              )}
              <CopyField
                value={generatedSecret}
                mono
                onCopy={() => copy(generatedSecret, "secret")}
                done={copied === "secret"}
                label={tr("copy")}
              />
            </>
          ) : (
            // الاتّجاه معكوس: المنصّة ولّدته، فالمشترك ينسخ منها إلينا.
            <input
              className="field w-full font-mono"
              placeholder={tr("pasteSecretPlaceholder")}
              value={pastedSecret}
              onChange={(e) => setPastedSecret(e.target.value)}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Step>

        <Step n={3} title={tr("step3")} hint={tr("step3Hint")}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="field"
              placeholder={tr("storeName")}
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
            <input
              className="field"
              placeholder={tr("storeUrl")}
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
            />
          </div>
          <input
            className="field mt-2 w-full"
            placeholder={needsSecret ? tr("consumerKey") : tr("apiToken")}
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            dir="ltr"
          />
          {needsSecret && (
            <input
              className="field mt-2 w-full"
              placeholder={tr("consumerSecret")}
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              dir="ltr"
            />
          )}
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-faint">
            {needsSecret ? tr("wooKeysHint") : tr("apiTokenHint")}
          </p>
        </Step>

        {error && (
          <div className="mb-3 rounded-xl border border-critical/30 bg-critical/[0.07] p-3 text-[12.5px] text-critical">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">
            {tr("cancel")}
          </button>
          {/* الزرّ معطَّل حتى يُلصق السرّ: الحفظ بلا سرّ يرتدّ من الخادم
              برسالة عامّة بعد ثلاث خطوات، والمنع قبل العمل أوضح من الرفض بعده. */}
          <button
            onClick={save}
            disabled={saving || secret.length < 8}
            className="btn btn-primary"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {tr("save")}
          </button>
        </div>

        <p className="mt-3 text-[11.5px] leading-relaxed text-text-faint">{tr("afterSave")}</p>
      </div>
    </div>,
    document.body
  );
}

function Step({ n, title, hint, children }: {
  n: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/12 text-[11px] font-semibold text-accent">
          {n}
        </span>
        <span className="text-[13px] font-medium text-text-primary">{title}</span>
      </div>
      <p className="mb-2 ms-7 text-[11.5px] leading-relaxed text-text-muted">{hint}</p>
      <div className="ms-7">{children}</div>
    </div>
  );
}

function CopyField({ value, onCopy, done, label, mono }: {
  value: string;
  onCopy: () => void;
  done: boolean;
  label: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-2">
      {/* `readOnly` لا `disabled`: المعطَّل لا يُحدَّد بالفأرة، وهو البديل
          الوحيد للمستخدم إن رفض المتصفّح إذن الحافظة.
          و`dir="ltr"` لأنّ الرابط والسرّ لاتينيّان: عرضهما في سياقٍ عربيّ
          يقلب موضع الشرطات والنقاط فيُنسَخ ما لا يُقرأ. */}
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className={"field min-w-0 flex-1 " + (mono ? "font-mono text-[11.5px]" : "text-[12px]")}
        dir="ltr"
      />
      <button onClick={onCopy} className="btn btn-ghost shrink-0" title={label} aria-label={label}>
        {done ? <Check size={14} className="text-verified" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
