"use client";

// app/dashboard/agent/AgentClient.tsx
//
// قسم الوكيل - **حاوية المحادثات، لا عقلٌ ثانٍ.**
//
// العقل واحد في `/api/ai/chat`: هو نفسه الذي يجيب من مربّع السؤال في كلّ
// صفحة. لو بُني هنا مسارٌ خاصّ لصار للمنتج عقلان يفترقان عند أوّل تعديل،
// ويرى المستخدم جوابين مختلفين للسؤال نفسه بحسب مكان سؤاله.
//
// فما يضيفه هذا القسم هو **الذاكرة والاستمرار**: سجلّ يُفتَح، ومحادثة
// تُكمَّل، وسؤالٌ يُبنى على جوابٍ قبله.

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Plus, Trash2, Send, Loader2, AlertTriangle, Paperclip, X, Copy, Check } from "lucide-react";
import { AgentIcon } from "@/app/components/AgentIcon";
import { MarkdownAnswer } from "@/app/components/MarkdownAnswer";
import { getCsrfHeader } from "@/lib/csrfClient";
import { REVEAL_TICK_MS, charsPerTick, prefersReducedMotion } from "@/lib/revealTiming";
import { t, type Locale } from "@/lib/i18n/dictionary";

interface ChatRow {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface Message {
  id: string;
  role: string;
  content: string;
}

/**
 * مجموعةُ المحادثة بالزمن. الحدودُ بالأيّام لا بالتقويم: «هذا الأسبوع»
 * تعني آخر سبعة أيّام لا الأسبوع الذي يبدأ الأحد - فمحادثةُ أمسٍ لا تقع
 * في «أقدم» لأنّ الأسبوع تغيّر بينهما.
 */
function groupOf(iso: string): "grpToday" | "grpWeek" | "grpOlder" {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1) return "grpToday";
  if (days < 7) return "grpWeek";
  return "grpOlder";
}

/** سؤالٌ أطول من هذا ليس سؤالاً - نفس حدّ المسار الخلفيّ */
const MAX_QUESTION = 400;

export function AgentClient({
  locale,
  workspaceName,
  initialChats,
}: {
  locale: Locale;
  workspaceName: string | null;
  initialChats: ChatRow[];
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `agentPage.${k}`, v);

  const [chats, setChats] = useState<ChatRow[]>(initialChats);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  /** كم حرفاً ظهر من آخر جواب - الكشفُ التدريجيّ نفسه الذي في مربّع السؤال */
  const [revealed, setRevealed] = useState<number | undefined>(undefined);
  const params = useSearchParams();


  // 🔴 `?chat=` قادمٌ من مربّع السؤال في صفحةٍ أخرى: رابطٌ يَعِد بفتح
  // محادثةٍ بعينها، فلو أنزل على قائمةٍ مغلقة لكان وعداً لم يُوفَ.
  // يُقرأ مرّةً واحدة عند أوّل رسم - لا في كلّ تغيّر، وإلّا أعاد فتح
  // المحادثة نفسها كلّما بدأ المستخدم واحدةً جديدة.
  const openedFromLink = useRef(false);
  useEffect(() => {
    if (openedFromLink.current) return;
    const id = params.get("chat");
    if (!id) return;
    openedFromLink.current = true;
    void openChat(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // الجواب يصل أسفل ما قبله، فلا يُقرأ إن بقي خارج الإطار
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  // 🔴 **قسمُ الوكيل كان يعرض الجواب دفعةً واحدة** بينما مربّعُ السؤال في
  // بقيّة الصفحات يكتبه تدريجياً - فالمكانان اللذان يجيب فيهما العقل نفسُه
  // يبدوان منتجين مختلفين. التوقيت من `lib/revealTiming.ts` كي لا تفترق
  // السرعتان عند أوّل تعديل.
  const last = messages[messages.length - 1];
  const lastIsFresh = last?.role === "assistant" && last.id.startsWith("a-");
  useEffect(() => {
    if (!lastIsFresh || !last) { setRevealed(undefined); return; }
    if (prefersReducedMotion()) { setRevealed(undefined); return; }

    const total = last.content.length;
    const perTick = charsPerTick(total);
    let shown = 0;
    setRevealed(0);
    const id = setInterval(() => {
      shown = Math.min(total, shown + perTick);
      setRevealed(shown);
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      // عند الاكتمال تُرفَع القصّة تماماً، فلا يبقى النصّ محكوماً برقم
      if (shown >= total) { clearInterval(id); setRevealed(undefined); }
    }, REVEAL_TICK_MS);
    return () => clearInterval(id);
  }, [last?.id, lastIsFresh]);

  async function openChat(id: string) {
    setActiveId(id);
    setError(null);
    setMessages([]);
    const res = await fetch(`/api/agent/chats/${id}`).catch(() => null);
    if (!res || !res.ok) {
      setError(tr("loadFailed"));
      return;
    }
    const data = await res.json();
    setMessages(data.messages ?? []);
  }

  function startNew() {
    setActiveId(null);
    setMessages([]);
    setError(null);
    setUpgradeUrl(null);
  }

  async function send(override?: string) {
    const q = (override ?? question).trim();
    if (q.length < 3 || busy) return;

    setBusy(true);
    setError(null);
    setUpgradeUrl(null);
    // السؤال يظهر فوراً: انتظارُ ردٍّ يستغرق ثوانيَ أمام مربّعٍ لم يتغيّر
    // يُقرأ كعطل، فيُعاد الإرسال ويُخصم رصيدٌ ثانٍ.
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", content: q }]);
    setQuestion("");

    // نصُّ المرفق يُضمّ إلى السؤال المُرسَل، ولا يظهر في الفقاعة: الفقاعة
    // تعرض ما كتبه صاحبها، والملفّ مذكورٌ باسمه فوقها.
    const sent = attachment
      ? `${q}

--- ${attachment.name} ---
${attachment.text}`
      : q;
    setAttachment(null);

    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: sent, scope: "home", chatId: activeId }),
    }).catch(() => null);

    setBusy(false);
    if (!res) {
      setError(t(locale, "aiAsk.errFailed"));
      return;
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? t(locale, "aiAsk.errFailed"));
      if (typeof data?.upgradeUrl === "string") setUpgradeUrl(data.upgradeUrl);
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: `a-${Date.now()}`, role: "assistant", content: data.answer },
    ]);

    // محادثةٌ جديدة أُنشئت خلف الطلب: تُضاف إلى السجلّ بلا إعادة تحميل
    if (data.chatId && data.chatId !== activeId) {
      setActiveId(data.chatId);
      setChats((prev) => [
        { id: data.chatId, title: q.slice(0, 60), updatedAt: new Date().toISOString(), messageCount: 2 },
        ...prev,
      ]);
    } else if (data.chatId) {
      setChats((prev) =>
        prev.map((c) => (c.id === data.chatId ? { ...c, messageCount: c.messageCount + 2 } : c))
      );
    }
  }

  async function remove(id: string) {
    if (!confirm(tr("deleteConfirm"))) return;
    const res = await fetch(`/api/agent/chats/${id}`, {
      method: "DELETE",
      headers: getCsrfHeader(),
    }).catch(() => null);
    if (!res || !res.ok) return;
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) startNew();
  }

  /**
   * مرفقٌ نصّيّ يُقرأ في المتصفّح ويُضمّ إلى السؤال.
   *
   * **يعمل فعلاً، ولا يَعِد بأكثر ممّا يفعل.** لا رفعَ ولا تخزين: الملفّ
   * يُقرأ هنا ويُرسَل نصُّه ضمن السؤال إلى المسار نفسه. فالمقبولُ ما
   * يُقرأ نصّاً (CSV، JSON، نصّ) - والصورةُ تحتاج قراءةً بصريّةً في
   * الخادم غير مبنيّةٍ بعد، فلا تُعرَض خياراً يخيب.
   */
  const MAX_ATTACH_CHARS = 4000;
  async function pickFile(file: File | null) {
    if (!file) return;
    const text = (await file.text().catch(() => "")).slice(0, MAX_ATTACH_CHARS);
    if (!text.trim()) return;
    setAttachment({ name: file.name, text });
  }

  // المؤلِّف يظهر في موضعين لا يجتمعان: وسطَ شاشة البداية، وأسفلَ
  // المحادثة الجارية. فيُكتب مرّةً - نسختان تفترقان عند أوّل تعديل.
  const composer = (big: boolean) => (
    <div
      className={`rounded-2xl border border-border-visible bg-surface transition-colors focus-within:border-accent/50 ${
        big ? "p-2.5 shadow-sm" : "p-2"
      }`}
    >
      {attachment && (
        <div className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-surface-raised px-2 py-1 text-[11.5px] text-text-muted">
          <Paperclip size={11} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
          <button
            onClick={() => setAttachment(null)}
            aria-label={t(locale, "ui.close")}
            className="shrink-0 rounded p-0.5 text-text-faint hover:text-text-primary"
          >
            <X size={11} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION))}
          onKeyDown={(e) => {
            // سطرٌ جديد بـShift، وإرسالٌ بـEnter وحدها
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={big ? 3 : 2}
          placeholder={t(locale, messages.length === 0 ? "aiAsk.ph_home_1" : "aiAsk.followUp")}
          // 🔴 `focus-ring-none` إجباريّ: `theme.css` يرسم حلقةَ تركيزٍ على
          // كلّ `textarea`، وهذا الحقل داخل صندوقٍ له حدُّه - فتُرسَم حلقةٌ
          // **داخل** الإطار حول النصّ وحده. وهو المستطيل الأزرق الذي رآه
          // المالك. الصنفُ موجودٌ في الملفّ لهذه الحالة بالذات.
          className="focus-ring-none flex-1 resize-none bg-transparent px-1 py-1.5 text-[13px] leading-relaxed text-text-primary outline-none placeholder:text-text-faint"
        />

        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.json,.md,.log,text/*"
          hidden
          onChange={(e) => {
            void pickFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label={tr("attach")}
          title={tr("attach")}
          className="btn btn-ghost btn-icon"
        >
          <Paperclip size={15} />
        </button>
        {/* 🔴 `btn-icon` لا `h-9 w-9 p-0`: `.btn` في `theme.css` يفرض حشوةً
            أفقيّةً (١٫١٢٥rem) وهو **خارج طبقات Tailwind**، فيغلب `p-0`
            ويسحق الأيقونة إلى عرضٍ صفريّ - زرٌّ أزرقُ فارغ. الصنف موجودٌ
            للحالة نفسها، وهذا ثالثُ موضعٍ يقع فيه الملفّ في فخّه. */}
        <button
          onClick={() => void send()}
          disabled={busy || question.trim().length < 3}
          aria-label={t(locale, "aiAsk.send")}
          className="btn btn-primary btn-icon"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  );

  // المنع يحمل مخرجه: باقةٌ نفد رصيدها تُرقَّى، لا تُشرَح فحسب
  const errorBar = error ? (
    <div className="note mb-3 flex flex-wrap items-center justify-between gap-3 border-critical/35 bg-critical/10 p-3 text-[12.5px] text-critical">
      <span className="flex items-center gap-1.5">
        <AlertTriangle size={14} /> {error}
      </span>
      {upgradeUrl && (
        <a href={upgradeUrl} className="btn btn-primary no-underline">
          {t(locale, "aiAsk.upgrade")}
        </a>
      )}
    </div>
  ) : null;

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[272px_1fr]">
      {/* ── السجلّ ───────────────────────────────────────────────── */}
      <aside className="scrollbar-zone card-shadow hidden min-h-0 flex-col overflow-hidden card lg:flex">
        <button onClick={startNew} className="btn btn-primary m-3 justify-center">
          <Plus size={15} /> {tr("newChat")}
        </button>

        <div className="border-t border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">
          {tr("history")}
        </div>

        <div className="hover-scrollbar flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <p className="p-3 text-[12px] leading-relaxed text-text-muted">{tr("empty")}</p>
          ) : (
            // 🔴 **قائمةٌ مسطّحةٌ بلا زمن**: خمسون محادثةً متساويةً في الشكل
            // لا يُعرف منها ما دار اليوم ممّا دار الشهر الماضي - والزمنُ هو
            // أوّلُ ما يُستدعى به حديثٌ سابق («اللي كنت بسأل فيه إمبارح»).
            // العناوينُ تظهر عند تبدّل المجموعة فقط، فلا تتكرّر بلا داع.
            chats.map((c, i) => (
              <div key={`g-${c.id}`}>
              {groupOf(c.updatedAt) !== (i > 0 ? groupOf(chats[i - 1].updatedAt) : null) && (
                <div className="border-b border-border/50 bg-surface-raised/40 px-3 py-1 text-[10.5px] font-medium uppercase tracking-wide text-text-faint">
                  {tr(groupOf(c.updatedAt))}
                </div>
              )}
              <div
                key={c.id}
                className={`row-toggle flex items-center gap-2 border-b border-border/50 px-3 py-2.5 ${
                  c.id === activeId ? "bg-accent/[0.07]" : ""
                }`}
                role="button"
                tabIndex={0}
                onClick={() => openChat(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void openChat(c.id);
                  }
                }}
              >
                <MessageSquare size={14} className="shrink-0 text-text-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-text-primary">{c.title}</span>
                  <span className="block text-[11px] text-text-faint">
                    {tr("messages", { n: c.messageCount })}
                  </span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(c.id);
                  }}
                  aria-label={tr("delete")}
                  className="shrink-0 rounded-lg p-1 text-text-faint hover:text-critical"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── المحادثة ─────────────────────────────────────────────── */}
      <section className="card-shadow flex min-h-0 flex-col overflow-hidden card">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <AgentIcon size={15} className="shrink-0 text-accent" />
            <span className="truncate text-[12.5px] font-medium text-text-primary">
              {tr("title")}
            </span>
            {workspaceName && (
              <span className="truncate text-[11.5px] text-text-faint">· {workspaceName}</span>
            )}
          </span>
          <button onClick={startNew} className="btn btn-ghost btn-sm lg:hidden">
            <Plus size={14} /> {tr("newChat")}
          </button>
        </div>

        {messages.length === 0 && !busy ? (
          /* 🔴 **المؤلِّف في وسط شاشة البداية لا في قاعها.**
             مربّعُ كتابةٍ ملتصقٌ بالأسفل تحت فراغٍ واسع يجعل الشاشة تبدو
             منتظِرةً بلا دعوة. وضعُه في المنتصف والأمثلةُ تحته يجعل أوّل
             نظرةٍ تقول شيئين معاً: هنا تكتب، وهذا ما يُكتَب. */
          <div className="hover-scrollbar flex flex-1 flex-col items-center justify-center overflow-y-auto p-5">
            <div className="w-full max-w-xl">
              <div className="mb-5 flex flex-col items-center gap-2.5 text-center">
                {/* هالةٌ متدرّجة بلون الهوية - العلامةُ نفسها، أكبر */}
                <span className="agent-rise relative flex h-16 w-16 items-center justify-center">
                  {/* الهالةُ خلف العلامة لا تحتها: تنبض فتقول «حيّ» بلا
                      أن تزيح شيئاً أو تسحب النظر عن العنوان. */}
                  <span
                    aria-hidden
                    className="agent-halo absolute inset-0 rounded-2xl"
                    style={{ background: "var(--accent-dim)" }}
                  />
                  <span
                    className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{
                      background:
                        "radial-gradient(120% 120% at 30% 20%, var(--accent-dim), transparent 70%), var(--accent-dim)",
                    }}
                  >
                    <AgentIcon size={30} className="text-accent" />
                  </span>
                </span>
                <h3
                  className="agent-rise text-[20px] font-semibold text-text-primary"
                  style={{ animationDelay: "60ms" }}
                >
                  {tr("welcome")}
                </h3>
                <p className="max-w-md text-[12.5px] leading-relaxed text-text-muted">
                  {chats.length === 0 ? tr("emptyBody") : tr("pickOne")}
                </p>
              </div>

              {errorBar}
              <div className="agent-rise" style={{ animationDelay: "170ms" }}>
                {composer(true)}
              </div>

              {/* الأمثلة تحت المؤلِّف مباشرةً: تُقرأ إجابةً عن «أكتب ماذا؟».
                  وهي أسئلة المنتج نفسها (`aiAsk.ph_*`)، تُضغَط فتُرسَل. */}
              <div
                className="agent-rise mt-3 grid gap-2 sm:grid-cols-3"
                style={{ animationDelay: "230ms" }}
              >
                {[
                  { k: "ph_home_1", label: tr("sugg1") },
                  { k: "ph_home_2", label: tr("sugg2") },
                  { k: "ph_home_3", label: tr("sugg3") },
                ].map(({ k, label }) => {
                  const text = t(locale, `aiAsk.${k}`);
                  return (
                    <button
                      key={k}
                      onClick={() => void send(text)}
                      disabled={busy}
                      className="rounded-xl border border-border-visible p-3 text-start transition-colors hover:border-accent/40 hover:bg-accent/[0.04]"
                    >
                      <span className="mb-0.5 block text-[12.5px] font-medium text-text-primary">
                        {label}
                      </span>
                      <span className="block text-[11.5px] leading-relaxed text-text-muted">
                        {text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="hover-scrollbar flex-1 overflow-y-auto p-4">
              <div className="mx-auto flex max-w-2xl flex-col gap-4">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex flex-col items-end gap-1">
                    <span className="text-[11px] text-text-faint">{tr("you")}</span>
                    <p className="max-w-[85%] rounded-2xl bg-accent/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-text-primary">
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="group/msg flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-[11px] text-text-faint">
                      <AgentIcon size={13} className="text-accent" />
                      {tr("agent")}
                      {/* 🔴 الجوابُ يُنقَل إلى تقريرٍ أو رسالةٍ باستمرار، وبلا
                          زرٍّ يُحدَّد بالفأرة سطراً سطراً. يظهر عند المرور
                          فلا يزاحم النصّ أثناء القراءة. */}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(m.content);
                          setCopiedId(m.id);
                          setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 2000);
                        }}
                        aria-label={tr("copyAnswer")}
                        className="ms-1 flex items-center gap-1 rounded p-0.5 text-text-faint opacity-0 transition-opacity hover:text-text-primary focus-visible:opacity-100 group-hover/msg:opacity-100"
                      >
                        {copiedId === m.id ? <Check size={11} /> : <Copy size={11} />}
                        {copiedId === m.id && tr("copiedAnswer")}
                      </button>
                    </span>
                    <MarkdownAnswer text={m.content} />
                  </div>
                )
              )}
              {busy && (
                <div className="flex items-center gap-2 text-[12.5px] text-text-muted">
                  <AgentIcon size={13} className="text-accent" />
                  {/* ثلاثُ نقاطٍ تتعاقب بدل دوّارةٍ عامّة: الدوّارة تقول
                      «تحميل»، وهذه تقول «يكتب» - وهو ما يحدث فعلاً. */}
                  <span className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="agent-dot inline-block h-1.5 w-1.5 rounded-full bg-accent"
                        style={{ animationDelay: `${i * 140}ms` }}
                      />
                    ))}
                  </span>
                  {t(locale, "aiAsk.demoWorking")}
                </div>
              )}
              <div ref={endRef} />
              </div>
            </div>

            <div className="border-t border-border p-3">
              <div className="mx-auto max-w-2xl">
                {errorBar}
                {composer(false)}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
