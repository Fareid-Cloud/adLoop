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
// وشكلُها بيقول ده: عنوانٌ بيقول «مبيعات»، وحقولٌ بتسأل **مَن أنت وحجمك
// قدّ إيه** لا «إيه المشكلة»، ووعدٌ صريح بموعدِ ردّ. وفي آخرها مخرجٌ
// للدعم لمَن فتحها بالغلط - بدل ما يقفل ويدوّر من أوّل وجديد.

import { useEffect, useState } from "react";
import { X, Loader2, Check, ArrowRight } from "lucide-react";
import { Portal } from "@/app/components/ui/Portal";
import { Select } from "@/app/components/ui/Select";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { SPEND_BANDS } from "@/lib/salesEnquiry";

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
      if (!res.ok) throw new Error("failed");
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
          className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl"
        >
          {/* رأسٌ بلون العلامة: الشاشةُ دي بتتقري «شركة بتكلّمك» لا «نموذج
              دعم» - والفرقُ في أوّل نصف ثانية من النظر إليها. */}
          <div className="flex items-start justify-between gap-3 rounded-t-2xl bg-accent px-5 py-4 text-white">
            <div>
              <h2 className="m-0 text-[16px] font-semibold">{tr("title")}</h2>
              {!done && <p className="m-0 mt-1 text-[12.5px] leading-relaxed opacity-90">{tr("subtitle")}</p>}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={tr("close")}
              className="grid size-7 shrink-0 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          {done ? (
            <div className="px-5 py-8 text-center">
              <span className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-success/12 text-success">
                <Check size={22} />
              </span>
              <p className="m-0 text-[15px] font-medium text-text-primary">{tr("doneTitle")}</p>
              <p className="m-0 mt-1.5 text-[12.5px] text-text-muted">{tr("doneBody", { email: form.email })}</p>
              <button onClick={() => setOpen(false)} className="btn mt-4">{tr("close")}</button>
            </div>
          ) : (
            <form onSubmit={submit} className="p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldWrap label={tr("company")} required>
                  <input
                    required
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    className="field w-full"
                  />
                </FieldWrap>
                <FieldWrap label={tr("name")} required>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="field w-full"
                  />
                </FieldWrap>
                <FieldWrap label={tr("email")} required>
                  <input
                    required
                    type="email"
                    dir="ltr"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="field w-full"
                  />
                </FieldWrap>
                <FieldWrap label={tr("phone")} hint={tr("optional")}>
                  <input
                    dir="ltr"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="field w-full"
                  />
                </FieldWrap>

                {/* الحقلان دول همّ **سببُ وجود النموذج**: من غيرهم المكالمة
                    الجاية بتبدأ من «حضرتك حجمك قدّ إيه؟» وبتضيع فيها. */}
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
                    options={SPEND_BANDS.map((b) => ({ value: b, label: tr(`spend.${b}`) }))}
                  />
                </FieldWrap>
              </div>

              <div className="mt-3">
                <FieldWrap label={tr("message")} hint={tr("optional")}>
                  <textarea
                    rows={3}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder={tr("messagePlaceholder")}
                    className="field w-full resize-none"
                  />
                </FieldWrap>
              </div>

              {error && <p className="mt-2 text-[12.5px] text-critical">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="btn btn-primary mt-4 w-full justify-center gap-1.5 disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                {busy ? tr("sending") : tr("submit")}
              </button>

              {/* مخرجٌ لمَن فتحها بالغلط: من غيره بيقفل ويدوّر من الأول،
                  وأغلبُهم مابيدوّرش. */}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent("adloop:open-support"));
                }}
                className="mt-3 flex w-full items-center justify-center gap-1 text-[12px] text-text-faint transition-colors hover:text-text-primary"
              >
                {tr("supportInstead")}
                <ArrowRight size={12} className="rtl:rotate-180" />
              </button>
            </form>
          )}
        </div>
      </div>
    </Portal>
  );
}

function FieldWrap({
  label, hint, required, children,
}: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-text-muted">
        {label}
        {required && <span className="ms-1 text-critical">*</span>}
        {hint && <span className="ms-1 text-[11px] text-text-faint">({hint})</span>}
      </span>
      {children}
    </label>
  );
}
