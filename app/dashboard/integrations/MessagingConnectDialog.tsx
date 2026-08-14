"use client";

// app/dashboard/integrations/MessagingConnectDialog.tsx
//
// 🔴 **واتساب وماسنجر كان زرّ الربط عندهما ميّتاً كذلك.**
//
// نفس علّة المتاجر بالحرف: `connectPath` عندهما صفحة التكاملات نفسها،
// فالنقر يسقط بلا شيء. وقد أُصلحت المتاجر وحدها في الجولة السابقة، فسأل
// المالك عن هذين - وهو محقّ: **هما مصدر التحقّق نفسه**. رسالة واتساب
// الحقيقية هي ما يحوّل «نقرة مُعلَنة» إلى «عميل مؤكَّد»، فزرٌّ ميّت هنا
// يعطّل جوهر المنتج لا ميزةً جانبية.
//
// ═══ لماذا نافذة منفصلة عن نافذة المتاجر ═══
//
// المتجر يُخزَّن في `EcommerceConnection` بسرٍّ خاصٍّ به. وهذان **لا سجلّ
// لهما**: هويّتهما حقلان على `Workspace` نفسها (`whatsappPhoneNumberId`
// و`facebookPageId`)، والسرّ عندهما سرُّ تطبيق ميتا الواحد في متغيّرات
// البيئة لا سرٌّ لكلّ مشترك. فدمجُهما في نافذةٍ واحدة كان سيعني حقولاً
// تظهر وتختفي بشرطٍ داخليّ - نافذتان أصدق من واحدةٍ بنصفين.
//
// وما يُطلب من المستخدم هنا **معرّفٌ يَنسخه** من لوحة ميتا، لا سرٌّ
// يخترعه: `phone_number_id` هو الهويّة الوحيدة التي يرسلها ويب هوك واتساب
// مع كلّ رسالة، وبها وحدها تُعرَف مساحة العمل صاحبة الرسالة.

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, Loader2 } from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import type { IntegrationDef } from "@/lib/integrationsCatalog";
import { t, type Locale } from "@/lib/i18n/dictionary";

export type MessagingKey = "whatsapp" | "messenger";

export function MessagingConnectDialog({
  def, channel, workspaceId, locale, initial, onClose, onConnected,
}: {
  def: IntegrationDef;
  channel: MessagingKey;
  workspaceId: string;
  locale: Locale;
  /** القيم المحفوظة - النافذة تُعدّل ما هو موجود لا تبدأ من فراغٍ دائماً */
  initial: { whatsappPhoneNumberId: string | null; whatsappBusinessPhone: string | null; facebookPageId: string | null };
  onClose: () => void;
  onConnected: () => void;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) =>
    t(locale, `messagingConnect.${k}`, vars);

  const isWhatsApp = channel === "whatsapp";

  const [phoneNumberId, setPhoneNumberId] = useState(initial.whatsappPhoneNumberId ?? "");
  const [businessPhone, setBusinessPhone] = useState(initial.whatsappBusinessPhone ?? "");
  const [pageId, setPageId] = useState(initial.facebookPageId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ماسنجر يستقبل على AdLoop مباشرةً. وواتساب يستقبل على **المتتبّع**، وهو
  // مشروعٌ منشورٌ على نطاقٍ آخر لا نعرفه من المتصفّح - فيُعرض موضعُه بدل
  // رابطٍ مخترَع يبدو صحيحاً ويردّ ٤٠٤.
  const webhookUrl = useMemo(
    () =>
      typeof window === "undefined" || isWhatsApp
        ? ""
        : window.location.origin + "/api/webhooks/meta-messenger",
    [isWhatsApp]
  );

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // إذن الحافظة يُرفض أحياناً - الحقل قابلٌ للتحديد يدوياً.
    }
  }

  const ready = isWhatsApp ? phoneNumberId.trim().length > 0 : pageId.trim().length > 0;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = isWhatsApp
        ? {
            whatsappPhoneNumberId: phoneNumberId.trim(),
            whatsappBusinessPhone: businessPhone.trim() || null,
          }
        : { facebookPageId: pageId.trim() };

      const res = await fetch("/api/workspaces/" + workspaceId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // المعرّف فريدٌ في قاعدة البيانات: رقمٌ سجّله مشتركٌ آخر يُرفض هنا،
        // وهي رسالةٌ يجب أن تصل كما هي لأنّها تصف حالةً حقيقية لا عطلاً.
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
            <PlatformLogo platform={def.logoKey} size={28} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-text-primary">
                {tr("title", { channel: locale === "en" ? def.name : def.nameAr })}
              </div>
              <div className="text-[12px] text-text-muted">
                {isWhatsApp ? tr("subtitleWhatsApp") : tr("subtitleMessenger")}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon shrink-0" aria-label={tr("close")}>
            <X size={16} />
          </button>
        </div>

        {isWhatsApp ? (
          <>
            <Field
              label={tr("phoneNumberId")}
              hint={tr("phoneNumberIdHint")}
              value={phoneNumberId}
              onChange={setPhoneNumberId}
              placeholder="123456789012345"
            />
            <Field
              label={tr("businessPhone")}
              hint={tr("businessPhoneHint")}
              value={businessPhone}
              onChange={setBusinessPhone}
              placeholder="9665XXXXXXXX"
            />
            <div className="mb-4 rounded-xl border border-border bg-surface-raised/50 p-3 text-[11.5px] leading-relaxed text-text-muted">
              {tr("whatsappWebhookNote")}
            </div>
          </>
        ) : (
          <>
            <Field
              label={tr("pageId")}
              hint={tr("pageIdHint")}
              value={pageId}
              onChange={setPageId}
              placeholder="102938475601234"
            />
            <div className="mb-4">
              <div className="mb-1.5 text-[13px] font-medium text-text-primary">{tr("messengerWebhook")}</div>
              <p className="mb-2 text-[11.5px] leading-relaxed text-text-muted">{tr("messengerWebhookHint")}</p>
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={webhookUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="field min-w-0 flex-1 text-[12px]"
                  dir="ltr"
                />
                <button onClick={() => copy(webhookUrl)} className="btn btn-ghost shrink-0" aria-label={tr("copy")}>
                  {copied ? <Check size={14} className="text-verified" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="mb-3 rounded-xl border border-critical/30 bg-critical/[0.07] p-3 text-[12.5px] text-critical">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">
            {tr("cancel")}
          </button>
          {/* معطَّل حتى يوجد المعرّف: الحفظ بلا معرّفٍ يُنشئ ربطاً لا يستقبل
              شيئاً، فيظهر «مربوط» ولا تصل رسالة - وهو أسوأ من زرٍّ معطَّل
              لأنّه يكذب بدل أن يمتنع. */}
          <button onClick={save} disabled={saving || !ready} className="btn btn-primary">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {tr("save")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Field({ label, hint, value, onChange, placeholder }: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-[13px] font-medium text-text-primary">{label}</label>
      <p className="mb-2 text-[11.5px] leading-relaxed text-text-muted">{hint}</p>
      {/* `dir="ltr"` لأنّ المعرّفات أرقامٌ لاتينية: عرضها في سياقٍ عربيّ
          يقلب ترتيب مقاطعها بصرياً فيُنسَخ ما لا يُقرأ. */}
      <input
        className="field w-full"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        dir="ltr"
      />
    </div>
  );
}
