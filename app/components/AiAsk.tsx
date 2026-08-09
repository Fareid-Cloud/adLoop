"use client";

// app/components/AiAsk.tsx
//
// مربّع السؤال - سطرٌ واحد يسأل فيه صاحب الحساب عن أرقامه.
//
// ثلاثة قرارات في شكله، كلّها من طلب المالك وكلّها لها سبب:
//
// **١) الأسئلة تُكتب حرفاً حرفاً وتتبدّل.** مثالٌ واحد ثابت يُقرأ مرّةً ثمّ
// يصير جزءاً من الأثاث. ثلاثة تتعاقب تُعلّم المستخدم **نوع** ما يصحّ أن
// يسأله - وهو السؤال الحقيقيّ أمام مربّع فارغ: «أسأله عن ماذا أصلاً؟».
// تتوقّف فور أن يلمس المربّع، ولا تعمل إطلاقاً لمن يطلب تقليل الحركة.
//
// **٢) عائم يرسو.** `position: sticky` مع `bottom` لا `fixed`: يطفو فوق
// المحتوى في كلّ موضع تمرير، ثمّ **يستقرّ في مكانه الطبيعيّ** فوق التذييل
// حين تبلغ آخر الصفحة - وهو بالضبط ما طُلب، بلا سطر JavaScript واحد
// لحساب الموضع. و`fixed` كانت ستفرض حساب إزاحة الشريط الجانبيّ يدوياً
// وتتبع حالة طيّه؛ اللاصق يبقى داخل عمود المحتوى فيحاذيه من تلقائه.
//
// **٣) شفّاف قليلاً وهو يطفو، معتم وهو راسٍ.** الشفافية ليست زينة: المربّع
// يمرّ فوق أرقام تُقرأ، فإعتامه الكامل أثناء التمرير يحجب ما جاء المستخدم
// ليراه. وحين يرسو لم يعد فوق شيء، فلا سبب لإخفاء أيّ جزء منه.
//
// والنسبة رُفعت مرّتين بطلب المالك: ٦٢٪ ← ٨٨٪ ← ٩٦٪. الشفافية بقيت
// إشارةً إلى أنّه طافٍ لا أكثر، والوضوح صار الأصل: مربّعٌ باهتٌ فوق
// أرقام يُقرأ كأنّه معطَّل، وهو نقيض غرضه.
//
// **سؤال وجواب لا محادثة:** لا سجلّ ولا سياق متراكم - كلّ سؤال نداءٌ
// مستقلّ يُخصم من الرصيد المعلَن. سلسلةٌ تحمل تاريخها تضاعف التوكنات مع
// كلّ رسالة، فيدفع المستخدم ثمن ما سبق في كلّ مرّة.

import { useState, useRef, useEffect } from "react";
import { Sparkles, ArrowUp, Loader2, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export type AiAskScope = "home" | "campaigns" | "store";

const TYPE_MS = 45;
const ERASE_MS = 22;
const HOLD_MS = 1900;

export function AiAsk({ scope, locale }: { scope: AiAskScope; locale: Locale }) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `aiAsk.${k}`, v);
  const examples = [1, 2, 3].map((n) => tr(`ph_${scope}_${n}`));

  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState("");
  const [docked, setDocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── الرسوّ ──────────────────────────────────────────────
  // حارسٌ يقع مباشرةً تحت المربّع: ظهورُه في الشاشة يعني أنّ المربّع بلغ
  // موضعه الطبيعيّ ولم يعد ملتصقاً. لا CSS يعرف أنّ عنصراً «ملتصق الآن»،
  // وهذه أخفّ طريقة لمعرفة ذلك.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setDocked(e.isIntersecting), { threshold: 1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ── الكتابة التدريجية ───────────────────────────────────
  useEffect(() => {
    // مَن بدأ يكتب لا يحتاج اقتراحاً يتحرّك أمامه، ومَن يطلب تقليل الحركة
    // يرى المثال الأوّل ساكناً - لا يُحرم منه.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setTyped(examples[0]); return; }
    if (focused || value) return;

    let i = 0;
    let ch = 0;
    let erasing = false;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      const full = examples[i];
      if (!erasing) {
        ch++;
        setTyped(full.slice(0, ch));
        if (ch >= full.length) {
          erasing = true;
          timer = setTimeout(step, HOLD_MS);
          return;
        }
        timer = setTimeout(step, TYPE_MS);
      } else {
        ch--;
        setTyped(full.slice(0, ch));
        if (ch <= 0) {
          erasing = false;
          i = (i + 1) % examples.length;
        }
        timer = setTimeout(step, ERASE_MS);
      }
    };
    timer = setTimeout(step, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, value, scope, locale]);

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

  // يُعتم كاملاً متى رسا، أو متى كان فيه ما يُقرأ (جواب أو خطأ)، أو أثناء
  // الكتابة - الشفافية لحالة السكون وحدها.
  const solid = docked || focused || !!answer || !!error || !!value;

  return (
    <>
      <div
        className={`sticky bottom-5 z-30 mt-6 transition-opacity duration-300 ${
          solid ? "opacity-100" : "opacity-[0.96] hover:opacity-100"
        }`}
      >
        <div
          className={`flex items-center gap-2 rounded-full border px-2 py-1.5 backdrop-blur-md transition-colors ${
            solid ? "border-accent/45 bg-surface" : "border-border bg-surface/95"
          }`}
        >
          <span className="icon-badge ms-1 h-7 w-7 bg-accent/12 text-accent">
            <Sparkles size={14} />
          </span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
            placeholder={focused || value ? "" : typed}
            maxLength={400}
            disabled={busy}
            spellCheck={false}
            // `focus-ring-none`: الحلقة على الحلقة الخارجية لا حول النصّ -
            // وإلّا ظهر مستطيل أزرق **داخل** المربّع عند الكتابة.
            className="focus-ring-none min-w-0 flex-1 bg-transparent text-[13.5px] text-text-primary outline-none placeholder:text-text-faint"
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
            الرصيد هو ما يجعل الحدّ يبدو مفاجأةً لا شرطاً معروفاً. يظهر عند
            الرسوّ أو التركيز فقط - سطرٌ دائم يطفو فوق المحتوى ضجيج. */}
        {solid && !answer && !error && (
          <p className="mt-1.5 px-4 text-[11px] text-text-faint">{tr("costNote")}</p>
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

      {/* الحارس - بلا ارتفاع، وجوده كلّه ليُرصد ظهوره */}
      <div ref={sentinelRef} aria-hidden className="h-px" />
    </>
  );
}
