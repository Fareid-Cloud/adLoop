"use client";

import { useMemo, useState } from "react";
import {
  MessageCircle, X, Search, ChevronRight, ChevronLeft, ArrowRight, Send, Loader2, Check,
} from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import { HELP_SECTIONS, helpText, type HelpArticle } from "@/lib/helpContent";
import { t, type Locale } from "@/lib/i18n/dictionary";

/**
 * ودجت الدعم عند العميل.
 *
 * 🔴 **الترتيب مقصود، ومختلف عن الشائع:** البحث والإجابات مكشوفان،
 * والتصعيد تحت. الشكل المنتشر بيحطّ زرار «تواصل معنا» كبير وبيخبّي
 * الأسئلة وراه - فاللي بيدوّر على إجابة بيدوس التواصل لأنّه أوضح شيء،
 * ويتحوّل لتذكرة **قبل** ما يشوف الإجابة اللي كانت هتغنيه. يعني الحاجة
 * اللي المفروض تقلّل الضغط بتزوّده.
 *
 * والتصعيد **بيحمل سياقه**: إيه اللي دوّر عليه، وأيّ مقال فتح. من غيرها
 * الدعم بيبدأ من الصفر وبيسأل اللي العميل جاوبه لنفسه.
 */

const INITIAL_VISIBLE = 4;

export function SupportWidget({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [composing, setComposing] = useState(false);

  const tr = (k: string) => t(locale, `supportWidget.${k}`);

  const all = useMemo(() => HELP_SECTIONS.flatMap((s) => s.articles), []);

  const matches = useMemo(() => {
    const term = q.trim().toLocaleLowerCase();
    if (!term) return all;
    // البحث في السؤال والجواب والوسوم معاً: العميل بيكتب الكلمة اللي في
    // دماغه، ومش لازم تكون في العنوان.
    return all.filter((a) =>
      [helpText(locale, a.q), helpText(locale, a.a), ...a.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(term)
    );
  }, [q, all, locale]);

  const visible = showAll || q.trim() ? matches : matches.slice(0, INITIAL_VISIBLE);

  function reset() {
    setArticle(null);
    setComposing(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label={tr("open")}
        className="fixed bottom-4 end-4 z-[60] flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-white shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle size={18} />
        <span className="text-[13px] font-medium">{tr("open")}</span>
      </button>
    );
  }

  return (
    // `dvh` لا `vh`: شريط المتصفّح على الموبايل بياكل من `vh` فالودجت
    // بيتقصّ من تحت ويختفي زرار الإرسال.
    <div className="fixed inset-x-3 bottom-3 z-[60] flex max-h-[min(34rem,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl sm:inset-x-auto sm:end-4 sm:w-[22rem]">
      {/* ═══ الهيدر بالهويّة ═══ */}
      <div className="flex items-center gap-2 bg-accent px-4 py-3 text-white">
        {(article || composing) && (
          <button onClick={reset} aria-label={tr("back")} className="-ms-1 rounded p-1 hover:bg-white/15">
            {locale === "ar" ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
          {article ? helpText(locale, article.q) : composing ? tr("sendTitle") : tr("title")}
        </span>
        <button onClick={() => { setOpen(false); reset(); }} aria-label={tr("close")} className="-me-1 rounded p-1 hover:bg-white/15">
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {article ? (
          <div className="p-4">
            <p className="m-0 whitespace-pre-line text-[12.5px] leading-relaxed text-text-primary">
              {helpText(locale, article.a)}
            </p>
            <button
              onClick={() => { setArticle(null); setComposing(true); }}
              className="mt-4 flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-[12.5px] text-text-muted transition-colors hover:text-text-primary"
            >
              {tr("didntHelp")}
              <ArrowRight size={14} className="shrink-0 rtl:rotate-180" />
            </button>
          </div>
        ) : composing ? (
          <Compose
            locale={locale}
            searchedFor={q.trim() || null}
            onDone={() => { setOpen(false); reset(); setQ(""); }}
          />
        ) : (
          <>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute inset-inline-start-0 top-1/2 ms-2.5 -translate-y-1/2 text-text-faint" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={tr("searchPlaceholder")}
                  className="field field-sm field-icon-start h-9 w-full"
                />
              </div>
            </div>

            <div className="p-2">
              <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                {q.trim() ? tr("results") : tr("topAnswers")}
              </div>

              {visible.length === 0 ? (
                <p className="px-2 py-3 text-[12.5px] text-text-muted">{tr("noResults")}</p>
              ) : (
                visible.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setArticle(a)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-[12.5px] text-text-primary transition-colors hover:bg-surface-raised"
                  >
                    <span className="min-w-0 flex-1">{helpText(locale, a.q)}</span>
                    <ChevronRight size={13} className="shrink-0 text-text-faint rtl:rotate-180" />
                  </button>
                ))
              )}

              {/* `Show more` عشان اللوحة ماتطولش: أربعة بتبان كاملة على
                  تليفون، وأربعتاشر بتخلّي التصعيد تحت الطيّ للأبد. */}
              {!q.trim() && !showAll && matches.length > INITIAL_VISIBLE && (
                <button
                  onClick={() => setShowAll(true)}
                  className="mt-1 w-full rounded-lg px-2 py-2 text-[12px] text-accent transition-colors hover:bg-surface-raised"
                >
                  {tr("showMore").replace("{n}", String(matches.length - INITIAL_VISIBLE))}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {!article && !composing && (
        <button
          onClick={() => setComposing(true)}
          className="flex items-center justify-between border-t border-border px-4 py-3 text-[12.5px] font-medium text-text-primary transition-colors hover:bg-surface-raised"
        >
          {tr("sendMessage")}
          <ArrowRight size={14} className="shrink-0 text-text-faint rtl:rotate-180" />
        </button>
      )}
    </div>
  );
}

function Compose({
  locale, searchedFor, onDone,
}: { locale: Locale; searchedFor: string | null; onDone: () => void }) {
  const tr = (k: string) => t(locale, `supportWidget.${k}`);
  const [subject, setSubject] = useState(searchedFor ?? "");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({
        subject: subject.trim() || body.trim().slice(0, 60),
        // السياق بيتبعت مع الرسالة: الدعم بيعرف إنّه دوّر على إيه قبل ما
        // يسأل - بدل ما يبدأ من الصفر ويسأله اللي جاوبه لنفسه.
        // 🔴 `text` لا `message`: ده اسمُ الحقل اللي المسار بيقراه، وكان
        // مكتوباً `message` - فكلّ رسالةٍ من الودجت كانت بتترفض بـ٤٠٠
        // «الرسالة فاضية» وهي مكتوبة. والاسمُ والبريد مابيتبعتوش أصلاً:
        // المسار بياخدهم من الجلسة، والمستخدم مسجَّل.
        text: searchedFor
          ? `${body.trim()}\n\n---\n${tr("searchedForNote")}: "${searchedFor}"`
          : body.trim(),
      }),
    }).catch(() => null);
    setBusy(false);

    if (!res?.ok) {
      const d = await res?.json().catch(() => null);
      setError(d?.error ?? tr("sendFailed"));
      return;
    }
    setSent(true);
    setTimeout(onDone, 1600);
  }

  if (sent) {
    return (
      <div className="grid place-items-center p-6 text-center">
        <span className="mb-2 grid size-10 place-items-center rounded-full bg-verified/12 text-verified">
          <Check size={20} />
        </span>
        <p className="m-0 text-[13px] font-medium text-text-primary">{tr("sentTitle")}</p>
        <p className="m-0 mt-1 text-[12px] text-text-muted">{tr("sentBody")}</p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <label className="mb-1 block text-[11.5px] text-text-muted">{tr("subject")}</label>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder={tr("subjectPlaceholder")}
        className="field field-sm mb-2.5 h-8 w-full"
      />
      <label className="mb-1 block text-[11.5px] text-text-muted">{tr("message")}</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder={tr("messagePlaceholder")}
        className="field w-full text-[12.5px]"
      />
      {error && <p role="alert" className="mt-1.5 text-[11.5px] text-critical">{error}</p>}
      <button onClick={send} disabled={busy || !body.trim()} className="btn btn-primary btn-sm mt-2.5 h-9 w-full">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        <span className="ms-1.5">{tr("send")}</span>
      </button>
    </div>
  );
}
