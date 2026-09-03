"use client";

// شات الدعم عند العميل - **مدخلٌ واحد لا اثنان.**
//
// 🔴 كان فيه ودجت ثانٍ (`SupportWidget`) بيعمل نفس الشيء بتصميمٍ مختلف
// جنب ده. ومدخلان للدعم أسوأ من أيّهما وحده: اللي محتاج مساعدة بيقف
// يقرّر يدوس أنهي واحد، والمحادثة بتتقسم في دماغه. فاتّدمج البحثُ
// والإجاباتُ **هنا**، والملفُّ ده هو الوحيد.
//
// ═══ الترتيب: الإجابة قبل التذكرة ═══
//
// البحثُ والإجاباتُ مكشوفان، والتصعيدُ تحت. الشكلُ المنتشر بيحطّ زرار
// «تواصل معنا» كبير وبيخبّي الأسئلة وراه - فاللي بيدوّر على إجابة بيدوس
// التواصل لأنّه أوضح شيء، ويتحوّل لتذكرة **قبل** ما يشوف الإجابة اللي
// كانت هتغنيه. الحاجةُ اللي المفروض تقلّل الضغط بتزوّده.
//
// ═══ بلا تمرير ═══
//
// اللوحةُ بارتفاعٍ ثابت وكلُّ شاشةٍ فيها تملؤه: رأسٌ، ومحتوى، وتذييلٌ
// ملتصق. التمريرُ الوحيدُ المسموح داخل المحادثة نفسها (الرسائل تطول
// بطبيعتها). وشاشةُ الإدخال بتتنقّل خطوةً خطوة بدل نموذجٍ طويل - كلُّ
// خطوةٍ سؤالٌ واحد، فمافيش لحظة بيشوف فيها عشر خانات فاضية ويقفل.

import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MessageCircle, X, Paperclip, Send, Search, ChevronLeft, ChevronRight,
  ArrowRight, Check, Loader2, Phone,
} from "lucide-react";
import { useLive } from "@/app/components/LiveData";
import { Portal } from "@/app/components/ui/Portal";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { countriesForDisplay } from "@/lib/countries";
import { Select } from "@/app/components/ui/Select";
import { HELP_SECTIONS, helpText, type HelpArticle } from "@/lib/helpContent";
import { ImageLightbox } from "@/app/components/ui/ImageLightbox";
import { SupportRatingCard, type RatingState } from "@/app/components/SupportRatingCard";

interface Msg { id: string; fromSupport: boolean; body: string; imageUrls: string[]; createdAt: string; }
interface Thread {
  id: string; subject: string; status: string; messages: Msg[];
  // بيانات التواصل المسجَّلة سابقاً - أساسُ عدم السؤال عنها تاني.
  name?: string | null; email?: string | null; phone?: string | null; country?: string | null;
}

const INPUT = "w-full card px-3 py-2 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent";

/** أربعةٌ تملأ اللوحة بلا تمرير على أضيق شاشة. */
const TOP_ANSWERS = 4;

type View =
  | { k: "home" }
  | { k: "article"; a: HelpArticle }
  | { k: "intake" }
  | { k: "thread" }
  | { k: "sent" };

export function SupportChat({
  name,
  email,
  variant = "floating",
  label,
  locale,
  whatsappNumber,
}: {
  name: string;
  email: string;
  variant?: "floating" | "sidebar";
  label?: string;
  locale: Locale;
  /** رقمُ واتساب الدعم - `null` لو مش مضبوط، فالخيار مايظهرش أصلاً. */
  whatsappNumber?: string | null;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `supportChat.${k}`, vars);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ k: "home" });

  // بطاقة الدعم في الرئيسية وصفحتا الباقات والتتبّع بتفتحه بالحدث ده.
  // الدعم مكوّن لا صفحة، فيُفتح بحدث لا بتنقّل.
  useEffect(() => {
    const openChat = () => { setOpen(true); setView({ k: "home" }); };
    window.addEventListener("adloop:open-support", openChat);
    return () => window.removeEventListener("adloop:open-support", openChat);
  }, []);

  const [thread, setThread] = useState<Thread | null>(null);
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name, email, phone: "", country: "", subject: "", text: "" });
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const [rating, setRating] = useState<RatingState>({
    ask: false, triggerMessageId: null, score: null, reasons: [], comment: "",
  });
  const bodyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/support");
    if (!res.ok) return;
    const d = await res.json();
    setThread(d.thread);
    setUnread(d.unread ?? 0);
    // السيرفرُ هو اللي بيقرّر إمتى نسأل عن التقييم - القاعدةُ فيها وقتٌ
    // وحالة، وحسابُها هنا معناه إنّ ساعةَ جهاز العميل بتحكم.
    if (d.rating) setRating(d.rating);

    // 🔴 **البيانات تُسأل مرّةً واحدة.** لو سجّلها قبل كده، بتتملّي من
    // محادثته السابقة وخطوةُ التعريف بتتخطّى كلّها - مافيش سببٌ يخلّي
    // اللي كلّمنا امبارح يكتب اسمه وتليفونه تاني عشان يسأل سؤال.
    if (d.thread) {
      setForm((f) => ({
        ...f,
        name: d.thread.name?.trim() || f.name,
        email: d.thread.email?.trim() || f.email,
        phone: d.thread.phone?.trim() || f.phone,
        country: d.thread.country?.trim() || f.country,
      }));
    }
  }, []);

  const live = useLive();
  useEffect(() => setUnread(live.supportUnread), [live.supportUnread]);
  useEffect(() => { if (open) load(); }, [open, load]);

  useEffect(() => {
    if (open && thread && unread > 0) {
      fetch("/api/support/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id }),
      }).then(() => setUnread(0));
    }
  }, [open, thread, unread]);

  useEffect(() => { bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight); }, [thread, open]);

  const all = useMemo(() => HELP_SECTIONS.flatMap((s) => s.articles), []);
  const matches = useMemo(() => {
    const term = q.trim().toLocaleLowerCase();
    if (!term) return all;
    // البحث في السؤال والجواب والوسوم: العميل بيكتب الكلمة اللي في دماغه،
    // ومش لازم تكون في العنوان.
    return all.filter((a) =>
      [helpText(locale, a.q), helpText(locale, a.a), ...a.tags]
        .join(" ").toLocaleLowerCase().includes(term)
    );
  }, [q, all, locale]);
  // اللوحةُ بتعرض أشهرَ الإجابات وبس؛ البحثُ بيعرض كلَّ ما طابق، والباقي
  // في مركز المساعدة. (كان فيه فردٌ داخل اللوحة، واتشال مع الزرّ اللي
  // كان بيشغّله - حالةٌ مالهاش من يغيّرها بتفضل تتقري كأنّها بتشتغل.)
  const visible = q.trim() ? matches : matches.slice(0, TOP_ANSWERS);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/support/upload", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) { const d = await res.json(); setImages((p) => [...p, d.url]); }
    else { const d = await res.json().catch(() => null); setError(d?.error ?? null); }
  }

  async function submitIntake() {
    setBusy(true);
    setError(null);
    // 🔴 **السياق بيتبعت مع الرسالة:** إيه اللي دوّر عليه قبل ما يصعّد.
    // من غيرها الدعم بيبدأ من الصفر وبيسأله اللي جاوبه لنفسه.
    const searched = q.trim();
    const body = searched
      ? `${form.text.trim()}\n\n---\n${tr("searchedFor")}: "${searched}"`
      : form.text.trim();

    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, text: body, imageUrls: images }),
    });
    setBusy(false);

    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? tr("sending"));
      return;
    }
    const d = await res.json();
    setThread(d.thread);
    setImages([]);
    setStep(0);
    setView({ k: "sent" });
    // 🔴 **بيفضل على الرسالة اللي بعتها.** الطردُ للرئيسية بعد الإرسال
    // بيخلّي اللي بعت لسّه مايشوفش رسالته في مكانها - فمش متأكّد إنها
    // وصلت. الرئيسيةُ بتظهر لمّا **يقفل ويفتح تاني**، وساعتها بيلاقي
    // «كمّل محادثتك» جنب الأسئلة.
    setTimeout(() => setView({ k: "thread" }), 1400);
  }

  async function sendReply() {
    if ((!reply.trim() && images.length === 0) || !thread) return;
    setBusy(true);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: thread.id, text: reply.trim(), imageUrls: images }),
    });
    setBusy(false);
    if (res.ok) { setReply(""); setImages([]); load(); }
  }

  // ── زرّ القائمة الجانبية ────────────────────────────────────────────
  if (variant === "sidebar" && !open) {
    return (
      <button
        onClick={() => { setOpen(true); setView({ k: "home" }); }}
        className="relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
      >
        <MessageCircle size={16} strokeWidth={1.9} className="shrink-0" />
        <span className="truncate">{label ?? tr("sidebarLabel")}</span>
        {unread > 0 && <span className="chip ms-auto min-w-[18px] bg-critical text-white">{unread}</span>}
      </button>
    );
  }

  const Backward = locale === "ar" ? ChevronRight : ChevronLeft;
  const canGoBack =
    view.k === "article" || view.k === "thread" || (view.k === "intake" && step === 0);

  // 🔴 **معرفةُ بياناته بتقصّر الطريق، مش بتتخطّى السؤال.**
  // لو مسجّل بياناته قبل كده، خطوةُ التعريف بتختفي ويفضل الموضوعُ
  // والتفاصيل - الموضوع بيخصّ الرسالة دي هو نفسه، مش الشخص.
  const knowsHim = !!thread?.phone?.trim() || !!thread?.country?.trim();
  const steps: Array<"identity" | "context" | "details"> = knowsHim
    ? ["context", "details"]
    : ["identity", "context", "details"];
  const current = steps[step] ?? "details";

  return (
    // بوّابة إلى `<body>`: في وضع القائمة الجانبية ده بيتصيَّر جوّه
    // `<aside>` وعليه `transform` (عشان يعمل درجاً على الهاتف)، و`transform`
    // على سلفٍ بيخلّي المثبَّت يتحسب منه ويتقصّ بحدوده مهما رفعنا `z-index`.
    <Portal>
      {zoom && <ImageLightbox src={zoom} onClose={() => setZoom(null)} />}
      {/* `support-dock` بتزحزحها جنب الشريط الجانبيّ على سطح المكتب بدل
          ما تقع فوقه - العرضُ في `theme.css` مع تعريف الشريط نفسه. */}
      <div className="support-dock fixed bottom-6 left-6 z-[60]">
        {open ? (
          <div className="flex h-[540px] max-h-[calc(100dvh-3rem)] w-[370px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            {/* ═══ الهيدر بالهويّة ═══ */}
            <div className="shrink-0 bg-accent px-4 py-4 text-white">
              <div className="flex items-start gap-2">
                {canGoBack && (
                  <button
                    onClick={() => { setView({ k: "home" }); setError(null); }}
                    aria-label={tr("back")}
                    className="-ms-1 mt-0.5 rounded p-1 hover:bg-white/15"
                  >
                    <Backward size={16} />
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold leading-snug">
                    {view.k === "article" ? helpText(locale, view.a.q) : tr("askAnything")}
                  </div>
                  {view.k === "home" && !thread && (
                    <div className="mt-0.5 text-[11.5px] text-white/75">{tr("hours")}</div>
                  )}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label={tr("close")}
                  className="-me-1 mt-0.5 rounded p-1 hover:bg-white/15"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* ═══ المحتوى ═══ */}
            {view.k === "sent" ? (
              <div className="grid flex-1 place-items-center p-6 text-center">
                <div>
                  <span className="mx-auto mb-2 grid size-11 place-items-center rounded-full bg-verified/12 text-verified">
                    <Check size={22} />
                  </span>
                  <p className="m-0 text-[13.5px] font-medium text-text-primary">{tr("received")}</p>
                </div>
              </div>
            ) : view.k === "article" ? (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  <p className="m-0 whitespace-pre-line text-[13px] leading-relaxed text-text-primary">
                    {helpText(locale, view.a.a)}
                  </p>
                </div>
                <FooterAction
                  label={tr("didntHelp")}
                  onClick={() => { setView({ k: "intake" }); setStep(0); }}
                />
              </>
            ) : view.k === "intake" ? (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="mb-3 flex items-center gap-2">
                    {/* شريطُ تقدّمٍ لا رقمٌ وحده: «خطوة ٢ من ٣» بتتقري، والشريط
                        بيتشاف بلا قراءة - والاتنين بيقولوا إنّ فيه نهاية قريبة. */}
                    {steps.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-surface-raised"}`}
                      />
                    ))}
                  </div>
                  <p className="m-0 mb-3 text-[11.5px] text-text-faint">
                    {tr("stepOf", { n: step + 1, total: steps.length })}
                  </p>

                  <div className="flex flex-col gap-2.5">
                    {current === "identity" && (
                      <>
                        <input className={INPUT} placeholder={tr("name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        <input className={INPUT} placeholder={tr("email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        <input className={INPUT} placeholder={tr("phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                      </>
                    )}
                    {current === "context" && (
                      <>
                        <Select
                          locale={locale}
                          value={form.country}
                          onChange={(v) => setForm({ ...form, country: v })}
                          placeholder={tr("country")}
                          ariaLabel={tr("country")}
                          options={countriesForDisplay(locale).map((c) => ({
                            value: c.code,
                            label: locale === "en" ? c.en : c.ar,
                          }))}
                        />
                        <input className={INPUT} placeholder={tr("subject")} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                      </>
                    )}
                    {current === "details" && (
                      <>
                        <textarea rows={5} className={INPUT} placeholder={tr("details")} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
                        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-text-muted">
                          <Paperclip size={14} /> {uploading ? tr("uploading") : tr("attach")}
                          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                        </label>
                        {images.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {images.map((u) => <img key={u} src={u} alt="" className="h-12 w-12 rounded-lg object-cover" />)}
                          </div>
                        )}
                      </>
                    )}
                    {error && <p role="alert" className="m-0 text-[12px] text-critical">{error}</p>}
                  </div>
                </div>

                <div className="shrink-0 border-t border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    {step > 0 ? (
                      <button onClick={() => setStep(step - 1)} className="rounded-xl px-3 py-2 text-sm text-text-muted hover:text-text-primary">
                        {tr("prev")}
                      </button>
                    ) : <span />}
                    {step < steps.length - 1 ? (
                      <button
                        onClick={() => setStep(step + 1)}
                        // كلُّ خطوةٍ بتتحقّق من نفسها: التالي مقفول لحد ما
                        // خانتها تتملّي، فمافيش إرسالٌ بحمولةٍ ناقصة يترفض
                        // من الخادم برسالةٍ مبهمة.
                        disabled={
                          (current === "identity" && (!form.name.trim() || !form.email.trim())) ||
                          (current === "context" && !form.subject.trim())
                        }
                        className="btn btn-primary"
                      >
                        {tr("next")}
                      </button>
                    ) : (
                      <button onClick={submitIntake} disabled={busy || !form.text.trim()} className="btn btn-primary">
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        <span className="ms-1.5">{busy ? tr("sending") : tr("send")}</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : view.k === "thread" && thread ? (
              // ── محادثةٌ قائمة ──────────────────────────────────────
              <>
                <div ref={bodyRef} className="flex-1 overflow-y-auto p-4">
                  <div className="flex flex-col gap-2.5">
                    {thread.messages.map((m, i) => (
                      <Fragment key={m.id}>
                        {startsNewSession(thread.messages[i - 1]?.createdAt, m.createdAt) && (
                          // فاصلٌ لا محادثةٌ جديدة: نفس الشخص ونفس التاريخ،
                          // وفجوةٌ في الوقت بتقول «ده موضوعٌ تاني» من غير ما
                          // تفصل تاريخَه في صفوف.
                          <div className="my-1 flex items-center gap-2">
                            <span className="h-px flex-1 bg-border" />
                            <span className="shrink-0 text-[10.5px] text-text-faint">
                              {new Date(m.createdAt).toLocaleDateString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
                                day: "numeric", month: "short",
                              })}
                            </span>
                            <span className="h-px flex-1 bg-border" />
                          </div>
                        )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] ${
                          m.fromSupport ? "self-start bg-surface-raised text-text-primary" : "self-end bg-accent text-white"
                        }`}
                      >
                        <p className="m-0 whitespace-pre-wrap">{m.body}</p>
                        {m.imageUrls?.map((u) => (
                          <button key={u} onClick={() => setZoom(u)} className="block">
                            <img src={u} alt="" className="mt-1.5 max-h-32 cursor-zoom-in rounded-lg" />
                          </button>
                        ))}
                      </div>
                      </Fragment>
                    ))}

                    {/* التقييمُ في آخر المحادثة لا في نافذةٍ فوقها: المكانُ
                        الطبيعيّ بعد آخر ردّ، ومَن مش عايز يقيّم بيعدّيه
                        بلا ما يتقطع عليه أيُّ حاجة. */}
                    {rating.ask && (
                      <SupportRatingCard
                        locale={locale}
                        state={rating}
                        onChange={(next) => setRating((r) => ({ ...r, ...next }))}
                        onDismiss={() => {
                          setRating((r) => ({ ...r, ask: false }));
                          void fetch("/api/support/rating", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              triggerMessageId: rating.triggerMessageId,
                              dismissed: true,
                            }),
                          });
                        }}
                      />
                    )}
                  </div>
                </div>
                <div className="shrink-0 border-t border-border p-3">
                  {/* الإرفاقُ كان في شاشة الإدخال وحدها، فالعميلُ يقدر يبعت
                      صورةً في أوّل رسالة **ومايقدرش** في أيّ ردٍّ بعدها -
                      وأغلبُ اللقطات بتيجي في الردّ لمّا الدعم يسأل «ابعتلي
                      صورة». */}
                  {images.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {images.map((u) => (
                        <span key={u} className="relative">
                          <img src={u} alt="" className="h-11 w-11 rounded-lg object-cover" />
                          <button
                            onClick={() => setImages((p) => p.filter((x) => x !== u))}
                            aria-label={tr("close")}
                            className="absolute -end-1 -top-1 grid size-4 place-items-center rounded-full bg-critical text-white"
                          >
                            <X size={9} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl text-text-faint transition-colors hover:bg-surface-raised hover:text-text-primary" title={tr("attach")}>
                      {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                    </label>
                    <input
                      className={INPUT}
                      placeholder={tr("replyPlaceholder")}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendReply()}
                    />
                    <button onClick={sendReply} disabled={busy} className="btn btn-primary btn-icon">
                      <Send size={15} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              // ── الرئيسية: بحثٌ وإجابات، والتصعيدُ ملتصقٌ تحت ────────
              <>
                <div className="flex-1 overflow-y-auto">
                  <div className="border-b border-border p-4">
                    <p className="m-0 mb-2 text-[13px] font-semibold text-text-primary">{tr("gotQuestions")}</p>
                    <div className="relative">
                      <Search size={14} className="pointer-events-none absolute inset-inline-start-0 top-1/2 ms-2.5 -translate-y-1/2 text-text-faint" />
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr("searchAnswers")}
                        className="field field-sm field-icon-start h-9 w-full"
                      />
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                      {tr("topAnswers")}
                    </div>
                    {visible.length === 0 ? (
                      <p className="py-3 text-[12.5px] text-text-muted">{tr("noAnswer")}</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {/* كلُّ إجابةٍ صندوقٌ قائم بذاته زيّ المرجع: الصفوفُ
                            العارية بتتقري فقرةً واحدة، والصندوقُ بيقول
                            «ده بندٌ يُضغَط». والسهمُ بيظهر عند المرور
                            وحده - أربعةُ أسهمٍ دايماً بتزاحم النصّ. */}
                        {visible.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setView({ k: "article", a })}
                            className="group/a flex w-full items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-start text-[12.5px] text-text-primary transition-colors hover:border-accent/40 hover:bg-accent/6"
                          >
                            <span className="min-w-0 flex-1">{helpText(locale, a.q)}</span>
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-white opacity-0 transition-opacity group-hover/a:opacity-100">
                              <ArrowRight size={11} className="rtl:rotate-180" />
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* 🔴 **«كل الإجابات» بتوّدي لمركز المساعدة، مش بتفرد
                        القائمة مكانها.**
                        اللوحةُ دي عرضُها ٣٧٠ بكسل وارتفاعُها ثابت، ففردُ
                        كلّ المقالات جوّاها بيحوّلها لعمودِ تمريرٍ طويل جوّه
                        صندوقٍ ضيّق - وهو أسوأ مكانٍ يتقري فيه محتوى طويل.
                        ومركزُ المساعدة موجودٌ أصلاً بلوحته العريضة وبحثِه
                        وأقسامِه، فـ«كل الإجابات» بتوصّل له بدل ما تقلّده.
                        بيتفتح بنفس نمط الأحداث في المنتج، فالودجت مش
                        محتاجةٌ تعرف مكانه. */}
                    {!q.trim() && matches.length > TOP_ANSWERS && (
                      <button
                        onClick={() => {
                          setOpen(false);
                          window.dispatchEvent(new CustomEvent("adloop:open-help"));
                        }}
                        className="mt-2.5 flex w-full items-center gap-2 text-[12px] text-accent"
                      >
                        <span className="h-px flex-1 bg-border" />
                        <span className="shrink-0">{tr("seeAll")}</span>
                        <ArrowRight size={12} className="shrink-0 rtl:rotate-180" />
                        <span className="h-px flex-1 bg-border" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="shrink-0 border-t border-border">
                  {/* 🔴 **زرٌّ واحد في المكان ده، بيتبدّل حسب الحالة.**
                      وجودُ «ابعت رسالة» جنب «كمّل محادثتك» بيخلّي صاحبَه
                      يختار بين حاجتين نتيجتهما واحدة - المحادثةُ واحدة
                      للعميل أصلاً، فالرسالةُ الجديدة بتكمّلها. */}
                  {thread ? (
                    <FooterAction
                      label={tr("continueConversation")}
                      hint={unread > 0 ? tr("continueUnread", { n: unread }) : thread.subject}
                      onClick={() => setView({ k: "thread" })}
                    />
                  ) : (
                    <FooterAction
                      label={tr("sendUsMessage")}
                      hint={tr("sendUsMessageHint")}
                      onClick={() => { setView({ k: "intake" }); setStep(0); }}
                    />
                  )}
                  {/* 🔴 **واتساب خيارٌ مساوٍ لا بديلٌ مخفيّ.** ناسٌ كتير في
                      السوق ده بتفضّل واتساب على أيّ صندوقٍ في موقع، وإخفاؤه
                      بيخليهم يقفلوا اللوحة ويدوّروا على الرقم بره.
                      وبيظهر **بس** لو الرقم مضبوط: خيارٌ بيودّي على رقمٍ
                      فاضي أسوأ من غيابه. */}
                  {whatsappNumber && (
                    <a
                      href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-start no-underline transition-colors hover:bg-surface-raised"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Phone size={14} className="shrink-0 text-verified" />
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-medium text-text-primary">
                            {tr("whatsapp")}
                          </span>
                          <span className="block truncate text-[11px] text-text-faint">{tr("whatsappHint")}</span>
                        </span>
                      </span>
                      <ArrowRight size={14} className="shrink-0 text-text-faint rtl:rotate-180" />
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <button onClick={() => { setOpen(true); setView({ k: "home" }); }} className="btn btn-primary relative h-12 w-12 rounded-full shadow-lg hover:scale-105">
            <MessageCircle size={20} />
            {unread > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
        )}
      </div>
    </Portal>
  );
}

/** تذييلٌ ملتصق - آخرُ ما تراه العين، ومكانُ التصعيد دائماً. */
function FooterAction({
  label, hint, onClick,
}: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3 text-start transition-colors hover:bg-surface-raised"
    >
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium text-text-primary">{label}</span>
        {hint && <span className="block truncate text-[11px] text-text-faint">{hint}</span>}
      </span>
      <ArrowRight size={14} className="shrink-0 text-text-faint rtl:rotate-180" />
    </button>
  );
}

/**
 * هل الرسالةُ دي بدايةُ جلسةٍ جديدة؟
 *
 * **ساعتان** فاصلٌ معقول: أقلُّ منها إكمالٌ لنفس الحديث، وأكترُ منها
 * رجوعٌ بسؤالٍ تاني. والقياسُ بالفجوة لا بالتاريخ: رسالتان الساعة
 * ١١:٥٨ و١٢:٠٣ في يومين مختلفين حديثٌ واحد، والتاريخُ وحده كان
 * هيفصلهما.
 */
const SESSION_GAP_MS = 2 * 60 * 60 * 1000;

function startsNewSession(previous: string | undefined, current: string): boolean {
  if (!previous) return false;
  return new Date(current).getTime() - new Date(previous).getTime() > SESSION_GAP_MS;
}
