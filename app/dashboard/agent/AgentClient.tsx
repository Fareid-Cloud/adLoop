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
import { MessageSquare, Plus, Trash2, Send, Loader2, AlertTriangle } from "lucide-react";
import { AgentIcon } from "@/app/components/AgentIcon";
import { MarkdownAnswer } from "@/app/components/MarkdownAnswer";
import { getCsrfHeader } from "@/lib/csrfClient";
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

/** سؤالٌ أطول من هذا ليس سؤالاً - نفس حدّ المسار الخلفيّ */
const MAX_QUESTION = 400;

export function AgentClient({ locale, initialChats }: { locale: Locale; initialChats: ChatRow[] }) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `agentPage.${k}`, v);

  const [chats, setChats] = useState<ChatRow[]>(initialChats);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
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

    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, scope: "home", chatId: activeId }),
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

  // المؤلِّف يظهر في موضعين لا يجتمعان: وسطَ شاشة البداية، وأسفلَ
  // المحادثة الجارية. فيُكتب مرّةً - نسختان تفترقان عند أوّل تعديل.
  const composer = (big: boolean) => (
    <div
      className={`flex items-end gap-2 rounded-2xl border border-border-visible bg-surface transition-colors focus-within:border-accent/50 ${
        big ? "p-2.5 shadow-sm" : "p-2"
      }`}
    >
      <AgentIcon size={16} className="mb-2 ms-1 shrink-0 text-text-faint" />
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
        // بلا `field`: الصندوقُ الخارجيّ هو الإطار، فحدٌّ داخل حدٍّ يُنتج
        // خطّين متوازيين.
        className="flex-1 resize-none bg-transparent px-1 py-1.5 text-[13px] leading-relaxed text-text-primary outline-none placeholder:text-text-faint"
      />
      <button
        onClick={() => void send()}
        disabled={busy || question.trim().length < 3}
        aria-label={t(locale, "aiAsk.send")}
        className="btn btn-primary h-9 w-9 shrink-0 justify-center p-0"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
      </button>
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
    <div className="grid gap-4 lg:grid-cols-[272px_1fr]">
      {/* ── السجلّ ───────────────────────────────────────────────── */}
      <aside className="scrollbar-zone card-shadow flex max-h-[78vh] min-h-[30rem] flex-col overflow-hidden card">
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
            chats.map((c) => (
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
            ))
          )}
        </div>
      </aside>

      {/* ── المحادثة ─────────────────────────────────────────────── */}
      <section className="card-shadow flex max-h-[78vh] min-h-[30rem] flex-col overflow-hidden card">
        {messages.length === 0 && !busy ? (
          /* 🔴 **المؤلِّف في وسط شاشة البداية لا في قاعها.**
             مربّعُ كتابةٍ ملتصقٌ بالأسفل تحت فراغٍ واسع يجعل الشاشة تبدو
             منتظِرةً بلا دعوة. وضعُه في المنتصف والأمثلةُ تحته يجعل أوّل
             نظرةٍ تقول شيئين معاً: هنا تكتب، وهذا ما يُكتَب. */
          <div className="hover-scrollbar flex flex-1 flex-col items-center justify-center overflow-y-auto p-5">
            <div className="w-full max-w-xl">
              <div className="mb-5 flex flex-col items-center gap-2.5 text-center">
                {/* هالةٌ متدرّجة بلون الهوية - العلامةُ نفسها، أكبر */}
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{
                    background:
                      "radial-gradient(120% 120% at 30% 20%, var(--accent-dim), transparent 70%), var(--accent-dim)",
                  }}
                >
                  <AgentIcon size={30} className="text-accent" />
                </span>
                <h3 className="text-[20px] font-semibold text-text-primary">{tr("welcome")}</h3>
                <p className="max-w-md text-[12.5px] leading-relaxed text-text-muted">
                  {chats.length === 0 ? tr("emptyBody") : tr("pickOne")}
                </p>
              </div>

              {errorBar}
              {composer(true)}

              {/* الأمثلة تحت المؤلِّف مباشرةً: تُقرأ إجابةً عن «أكتب ماذا؟».
                  وهي أسئلة المنتج نفسها (`aiAsk.ph_*`)، تُضغَط فتُرسَل. */}
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
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
                  <div key={m.id} className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-[11px] text-text-faint">
                      <AgentIcon size={13} className="text-accent" />
                      {tr("agent")}
                    </span>
                    <MarkdownAnswer text={m.content} />
                  </div>
                )
              )}
              {busy && (
                <div className="flex items-center gap-2 text-[12.5px] text-text-muted">
                  <Loader2 size={14} className="animate-spin" /> {t(locale, "aiAsk.demoWorking")}
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
