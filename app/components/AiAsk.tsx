"use client";

// app/components/AiAsk.tsx
//
// مربّع السؤال - سطرٌ واحد يسأل فيه صاحب الحساب عن أرقامه.
//
// **لماذا شكله هكذا:** حلقة كاملة الاستدارة بحدٍّ رفيع، **نصف شفّافة قبل
// اللمس** وتكتمل عند التركيز. الغرض أن يكون حاضراً ولا يزاحم: هذه صفحاتٌ
// جوهرها أرقام، ومربّعٌ ممتلئ في أعلاها يسحب العين قبل الرقم. حين يقرّر
// المستخدم أن يسأل، يستقبله المربّع كاملاً.
//
// **سؤال وجواب لا محادثة:** لا سجلّ ولا سياق متراكم - كلّ سؤال نداءٌ
// مستقلّ يُخصم من الرصيد المعلَن. سلسلةٌ تحمل تاريخها تضاعف التوكنات مع
// كلّ رسالة، فيدفع المستخدم ثمن ما سبق في كلّ مرّة. الجواب الأخير يبقى
// معروضاً حتى يُسأل غيره.

import { useState, useRef } from "react";
import { Sparkles, ArrowUp, Loader2, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export type AiAskScope = "home" | "campaigns" | "store";

export function AiAsk({ scope, locale }: { scope: AiAskScope; locale: Locale }) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `aiAsk.${k}`, v);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ask() {
    const q = value.trim();
    if (q.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    setUpgradeUrl(null);

    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, scope }),
    }).catch(() => null);

    setBusy(false);
    if (!res) { setError(tr("errFailed")); return; }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? tr("errFailed"));
      if (data?.upgradeUrl) setUpgradeUrl(data.upgradeUrl);
      return;
    }
    setAnswer(data.answer);
    setValue("");
  }

  return (
    <div className="mb-5">
      {/* `focus-within` لا `:hover`: الشفافية تنكسر عند نيّة الكتابة لا عند
          مرور المؤشّر صدفةً فوقه وهو ذاهب إلى غيره. */}
      <div className="group flex items-center gap-2 rounded-full border border-border/70 bg-surface/50 px-2 py-1.5 opacity-70 transition-all focus-within:border-accent/60 focus-within:bg-surface focus-within:opacity-100 hover:opacity-90">
        <span className="icon-badge ms-1 h-7 w-7 bg-accent/12 text-accent">
          <Sparkles size={14} />
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
          placeholder={tr(`placeholder_${scope}`)}
          maxLength={400}
          disabled={busy}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-text-primary outline-none placeholder:text-text-faint"
        />
        <button
          onClick={ask}
          disabled={busy || value.trim().length < 3}
          aria-label={tr("send")}
          className="btn btn-primary btn-icon btn-sm rounded-full disabled:opacity-35"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} />}
        </button>
      </div>

      {/* سطر التكلفة: النداء يُخصم من الرصيد المعلَن، وإخفاء ذلك حتى ينفد
          الرصيد هو ما يجعل الحدّ يبدو مفاجأةً لا شرطاً معروفاً. */}
      {!answer && !error && (
        <p className="mt-1.5 px-3 text-[11px] text-text-faint">{tr("costNote")}</p>
      )}

      {error && (
        <div className="note mt-2 border-critical/35 bg-critical/[0.06] text-critical">
          <span className="min-w-0 flex-1">{error}</span>
          {upgradeUrl && (
            <a href={upgradeUrl} className="btn btn-primary btn-sm shrink-0">{tr("upgrade")}</a>
          )}
        </div>
      )}

      {answer && (
        <div className="card pad-md mt-2 flex items-start gap-3">
          <span className="icon-badge mt-0.5 h-7 w-7 shrink-0 bg-accent/12 text-accent">
            <Sparkles size={13} />
          </span>
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text-primary">
            {answer}
          </p>
          <button
            onClick={() => { setAnswer(null); inputRef.current?.focus(); }}
            aria-label={t(locale, "ui.close")}
            className="shrink-0 rounded-lg p-1 text-text-faint transition-colors hover:text-text-primary"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
