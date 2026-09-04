"use client";

// app/components/ContactSalesDialog.tsx
//
// **«تواصل مع المبيعات» رحلةٌ تانية غير الدعم - وده كان أهمَّ اللي ناقص.**
//
// الزرُّ كان بيفتح شات الدعم، فطلبُ شراءٍ بميزانيةٍ بيقع في نفس الطابور مع
// «الرسم مش ظاهر عندي». والفرقُ مش تنظيميّاً بس - هو في **إحساس الاتنين**:
// اللي بيسأل عن الشراء عايز يحسّ إنّه بيكلّم حدّاً بيبيع، واللي عنده مشكلة
// عايز يحسّ إنّه بيكلّم حدّاً بيصلّح. شاشةٌ واحدة للاتنين بتخذل الاتنين.
//
// **والشاشةُ نصفان: لماذا، ثمّ مَن أنت.**
//
// كان النموذجُ وحدَه فيها - ستّةُ حقولٍ تُطلب ممّن لم يُقَل له بعدُ ما الذي
// يشتريه. وطلبُ الاسم والشركة والهاتف قبل أيّ سببٍ يجعلها استمارةً لا
// عرضاً، وأغلبُ مَن يفتحها بفضولٍ يقفلها عندها. فالنصفُ الأوّل يقول ما
// يفتحه الاتّفاق، والثاني يسأل.
//
// **والرأسُ الأزرق العريض اتشال:** كان بياخد خُمسَ الشاشة ليقول اسمَها
// مرّتين (عنواناً وسطراً تحته)، وبيدفع النموذجَ لتحت. العنوانُ نزل جوّه
// العمود اليمين حيث الفعلُ نفسه، فبقي المكانُ للمحتوى.
//
// **وشعاراتُ المنصّات حقيقيةٌ من `PlatformLogo`** - نفسُ المكوّن المستعمَل
// في المنتج كلّه، والمالكُ متكفّلٌ بحقوق العلامات.

import { useEffect, useState } from "react";
import {
  X, Loader2, ArrowRight, Check, Clock, ShieldCheck,
  ChartNoAxesColumn, Link2, SlidersHorizontal, UserRound,
  Building2, User, Mail, Phone,
} from "lucide-react";
import { Portal } from "@/app/components/ui/Portal";
import { Select } from "@/app/components/ui/Select";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { SPEND_BANDS } from "@/lib/salesEnquiry";
import { PlatformLogo } from "@/app/components/PlatformLogo";

// مكتوبةٌ كاملةً لا مركَّبة: نفس سبب `REASON_KEY` في بطاقة التقييم -
// فحصُ التغطية بيشوف النصّ الساكن وحده.
const SPEND_KEY: Record<string, string> = {
  under_10k: "sales.spendUnder10k",
  "10k_50k": "sales.spend10k50k",
  "50k_200k": "sales.spend50k200k",
  over_200k: "sales.spendOver200k",
};

/** أيقونةٌ لكلّ ميزة: أربعُ علاماتِ صحٍّ متطابقة تُقرأ قائمةً واحدة
 *  طويلة، وأربعُ أيقوناتٍ مختلفة تُقرأ أربعَ قدراتٍ منفصلة. */
const WHY = [
  { key: "why1", Icon: ChartNoAxesColumn },
  { key: "why2", Icon: Link2 },
  { key: "why3", Icon: SlidersHorizontal },
  { key: "why4", Icon: UserRound },
] as const;

/** الشعاراتُ الحقيقية من `PlatformLogo` - المكوّنُ المستعمَل في المنتج
 *  كلّه، والمالكُ متكفّلٌ بحقوق العلامات. ورسمُ شاراتٍ لونيةٍ هنا كان
 *  سيعطي نفسَ الصفّ شكلاً مختلفاً عن كلّ شاشةٍ أخرى فيه هذه المنصّات. */
const PLATFORMS = ["META_ADS", "GOOGLE_ADS", "TIKTOK_ADS"] as const;

export function ContactSalesDialog({
  locale, name = "", email = "", country = "",
}: {
  locale: Locale;
  name?: string;
  email?: string;
  country?: string;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `sales.${k}`, vars);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    company: "", name, email, phone: "", adAccounts: "", monthlySpend: "", message: "",
  });

  // نفسُ نمط الدعم: الشاشة دي بتتفتح بحدث لا بتنقّل، فأيّ زرارٍ في المنتج
  // يقدر يفتحها بلا ما يعرف مكانها.
  useEffect(() => {
    const openIt = () => { setOpen(true); setDone(false); setError(null); };
    window.addEventListener("adloop:contact-sales", openIt);
    return () => window.removeEventListener("adloop:contact-sales", openIt);
  }, []);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, country, adAccounts: Number(form.adAccounts) || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // مفتاحٌ لا نصّ: الخادمُ لا يعرف لغةَ الواجهة، ويخدم مسجَّلاً
        // وغيرَ مسجَّل - فيرسل المفتاح وتترجمه الشاشة.
        setError(tr(data?.errorKey ?? "error"));
        return;
      }
      setDone(true);
    } catch {
      setError(tr("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4" onClick={() => setOpen(false)}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl"
        >
          <button
            onClick={() => setOpen(false)}
            aria-label={tr("close")}
            className="absolute top-3 z-10 grid size-8 place-items-center rounded-lg text-text-faint transition-colors hover:bg-surface-raised hover:text-text-primary"
            style={{ insetInlineEnd: 12 }}
          >
            <X size={16} />
          </button>

          {done ? (
            /* **شاشةُ الوصول تُرسَم، لا تَظهر.**
               علامةُ صحٍّ ساكنةٌ تُقرأ «انتهى النموذج»؛ والدائرةُ التي تُغلَق
               ثمّ العلامةُ التي تُخَطّ بعدها تُقرأ **«وصل»**. */
            <div className="px-5 py-12 text-center">
              <span className="adl-success-wrap mx-auto mb-4 block w-fit">
                <svg viewBox="0 0 56 56" className="size-14" fill="none" aria-hidden="true">
                  <circle cx="28" cy="28" r="26" className="stroke-verified/25" strokeWidth="2.5" />
                  <circle
                    cx="28" cy="28" r="26"
                    className="adl-success-ring stroke-verified"
                    strokeWidth="2.5" strokeLinecap="round"
                    transform="rotate(-90 28 28)"
                  />
                  <path
                    d="M17 28.5 L24.5 36 L39 21.5"
                    className="adl-success-check stroke-verified"
                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
              </span>
              <p className="m-0 text-[16px] font-semibold text-text-primary">{tr("doneTitle")}</p>
              <p className="m-0 mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-text-muted">
                {tr("doneBody", { email: form.email })}
              </p>
              {/* 🔴 الفعلُ الوحيد المتاح هو الفعلُ الرئيسيّ بالتعريف. زرٌّ
                  رمادي تحت رسالة نجاح يُقرأ خياراً ثانوياً، فيقعد صاحبُه
                  ينتظر شيئاً آخر يحصل. */}
              <button onClick={() => setOpen(false)} className="btn btn-primary mt-5 px-7">
                {tr("close")}
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
              {/* ============ النصف الأوّل: لماذا ============ */}
              <aside className="adl-sales-aside border-b border-border p-6 md:border-b-0 md:border-e md:border-border md:p-7">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-faint">
                  {tr("eyebrow")}
                </span>
                {/* السطرُ الثاني بلون العلامة: العينُ تقف عليه، وهو الوعدُ
                    نفسُه («حجمك أنت») لا الفعلُ العامّ. */}
                <h2 className="m-0 mt-2.5 text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] text-text-primary">
                  {tr("headline1")}
                  <br />
                  <span className="text-accent">{tr("headline2")}</span>
                </h2>
                <p className="m-0 mt-3 text-[12.5px] leading-relaxed text-text-muted">{tr("blurb")}</p>

                <ul className="m-0 mt-6 flex list-none flex-col gap-3.5 p-0">
                  {WHY.map(({ key, Icon }) => (
                    <li key={key} className="flex items-start gap-3 text-[12.5px] leading-relaxed text-text-primary">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/10">
                        <Icon size={16} className="text-accent" />
                      </span>
                      <span className="pt-1.5">{tr(key)}</span>
                    </li>
                  ))}
                </ul>

                {/* شاراتٌ لونية لا شعارات - الشعاراتُ مملوكةٌ لأصحابها.
                    وتُخفى على الموبايل: العمودُ فوق النموذج هناك، فكلُّ
                    صفٍّ إضافيّ يدفع أوّلَ حقلٍ أبعدَ عن الشاشة الأولى. */}
                <div className="mt-7 hidden md:block">
                  <div className="inline-flex items-center gap-3 rounded-full border border-border bg-surface px-4 py-2">
                    {PLATFORMS.map((key, i) => (
                      <span key={key} className="flex items-center gap-3">
                        {i > 0 && <span className="h-4 w-px bg-border" />}
                        <PlatformLogo platform={key} size={20} />
                      </span>
                    ))}
                  </div>
                  <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-text-faint">{tr("platformsNote")}</p>
                </div>

                {/* 🔴 **مخرجُ الدعم انتقل إلى هذا العمود.** كان آخرَ سطرٍ
                    تحت النموذج، فيدفع طولَ العمود الأيمن أبعدَ من الشاشة
                    ويظهر شريطُ تمرير - وهو آخرُ ما يُراد في شاشةٍ نصفُها
                    الآخر فارغٌ من تحت. والمعنى لم يتغيّر: مَن فتحها بالغلط
                    يجد الطريقَ قبل أن يبدأ الملء، لا بعد أن يملأ ستّة
                    حقولٍ ثمّ يكتشف أنّه في المكان الخطأ. */}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    window.dispatchEvent(new CustomEvent("adloop:open-support"));
                  }}
                  className="mt-6 flex items-center gap-1 text-[12px] text-accent transition-opacity hover:opacity-75"
                >
                  {tr("supportInstead")}
                  <ArrowRight size={12} className="rtl:rotate-180" />
                </button>
              </aside>

              {/* ============ النصف الثاني: مَن أنت ============ */}
              <form onSubmit={submit} className="p-6 md:p-7">
                <h3 className="m-0 pe-8 text-[20px] font-semibold tracking-tight text-text-primary">
                  {tr("title")}
                </h3>
                <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-text-muted">{tr("formSubtitle")}</p>

                <div className="mt-5 grid gap-3">
                  <FieldWrap label={tr("company")} required icon={Building2}>
                    <input
                      required
                      value={form.company}
                      onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                      placeholder={tr("companyPlaceholder")}
                      className="field adl-field-icon w-full"
                    />
                  </FieldWrap>
                  <FieldWrap label={tr("name")} required icon={User}>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="field adl-field-icon w-full"
                    />
                  </FieldWrap>
                  <FieldWrap label={tr("email")} required icon={Mail}>
                    <input
                      required
                      type="email"
                      dir="ltr"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="field adl-field-icon w-full"
                    />
                  </FieldWrap>
                  {/* 🔴 **الهاتف مطلوبٌ لا اختياريّ.** الوعدُ في هذه الشاشة
                      «مكالمةٌ قصيرة»، وطلبٌ بلا رقمٍ يجعل أوّلَ خطوةٍ بعده
                      بريداً يسأل عن الرقم - أي يومٌ ضائعٌ في صفقةٍ اتّفاقية،
                      وفرصةٌ لألّا يردّ. */}
                  <FieldWrap label={tr("phone")} required icon={Phone}>
                    <input
                      required
                      dir="ltr"
                      inputMode="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="field adl-field-icon w-full"
                    />
                  </FieldWrap>

                  {/* الحقلان دول همّ **سببُ وجود النموذج**: من غيرهم المكالمة
                      الجاية بتبدأ من «حضرتك حجمك قدّ إيه؟» وبتضيع فيها. */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldWrap label={tr("adAccounts")} hint={tr("optional")}>
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={form.adAccounts}
                        onChange={(e) => setForm((f) => ({ ...f, adAccounts: e.target.value }))}
                        className="field w-full"
                      />
                    </FieldWrap>
                    <FieldWrap label={tr("monthlySpend")} hint={tr("optional")}>
                      <Select
                        locale={locale}
                        value={form.monthlySpend}
                        onChange={(v) => setForm((f) => ({ ...f, monthlySpend: v }))}
                        placeholder={tr("spendPick")}
                        options={SPEND_BANDS.map((b) => ({ value: b, label: t(locale, SPEND_KEY[b]) }))}
                      />
                    </FieldWrap>
                  </div>

                  <FieldWrap label={tr("message")} hint={tr("optional")}>
                    <textarea
                      rows={2}
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      placeholder={tr("messagePlaceholder")}
                      className="field w-full resize-none"
                    />
                  </FieldWrap>
                </div>

                {error && <p className="mt-2.5 text-[12.5px] text-critical">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="adl-shine btn btn-primary mt-5 w-full justify-center gap-2 py-3 text-[14px] disabled:opacity-60"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                  {busy ? tr("sending") : tr("submit")}
                  {!busy && <ArrowRight size={15} className="rtl:rotate-180" />}
                </button>

                {/* سطرا الطمأنة تحت الزرّ لا فوقه: يُقرآن في اللحظة التي
                    يتردّد فيها الإصبع، وهي بعد قراءة الزرّ لا قبله. */}
                <div className="mt-4 flex items-center justify-center gap-4 border-t border-border pt-3 text-[11.5px] text-text-faint">
                  <span className="flex items-center gap-1.5"><Clock size={13} /> {tr("whyFootCall")}</span>
                  <span className="h-3.5 w-px bg-border" />
                  <span className="flex items-center gap-1.5"><ShieldCheck size={13} /> {tr("whyFootSetup")}</span>
                </div>

              </form>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

function FieldWrap({
  label, hint, required, icon: Icon, children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  /** أيقونةٌ داخل الحقل - للحقول الأربعة الأولى وحدها. الأيقونةُ على كلّ
   *  حقلٍ تصير زخرفةً متكرّرة، وعلى الأساسية منها تصير علامةَ نوعٍ تُقرأ. */
  icon?: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-text-muted">
        {label}
        {required && <span className="ms-1 text-critical">*</span>}
        {hint && <span className="ms-1 text-[11px] text-text-faint">({hint})</span>}
      </span>
      {Icon ? (
        <span className="relative block">
          <Icon
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-faint"
            style={{ insetInlineStart: 11 }}
          />
          {children}
        </span>
      ) : (
        children
      )}
    </label>
  );
}
