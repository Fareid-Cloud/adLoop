"use client";

// app/components/AiAsk.tsx
//
// مربّع السؤال - سطرٌ واحد يسأل فيه صاحب الحساب عن أرقامه.
//
// أربعة قرارات في شكله، كلّها من طلب المالك وكلّها لها سبب:
//
// **١) الأسئلة تُكتب حرفاً حرفاً وتتبدّل.** مثالٌ واحد ثابت يُقرأ مرّةً ثمّ
// يصير جزءاً من الأثاث. ثلاثة تتعاقب تُعلّم المستخدم **نوع** ما يصحّ أن
// يسأله - وهو السؤال الحقيقيّ أمام مربّع فارغ: «أسأله عن ماذا أصلاً؟».
// تتوقّف فور أن يلمس المربّع، ولا تعمل إطلاقاً لمن يطلب تقليل الحركة.
//
// **٢) والمثال المكتوب يُرسَل بضغطة السهم.** كان يُقرأ ولا يُلتقط: مَن أعجبه
// اقتراحٌ يمرّ أمامه اضطرّ إلى إعادة كتابته بيده. الآن ضغطة السهم تُكمل
// المثال في المربّع وترسله - **تُكمله ولا تقصّه**: سؤالٌ مبتور («لماذا
// ترتفع تكلفة الع») جوابُه مبتور، وفي حسابٍ حقيقيّ يُخصم ثمنه من الرصيد.
// فالمرسَل هو ما يراه المستخدم في اللحظة نفسها، مكتملاً لا ناقصاً.
//
// **٣) عائم يرسو.** `position: sticky` مع `bottom` لا `fixed`: يطفو فوق
// المحتوى في كلّ موضع تمرير، ثمّ **يستقرّ في مكانه الطبيعيّ** فوق التذييل
// حين تبلغ آخر الصفحة - وهو بالضبط ما طُلب، بلا سطر JavaScript واحد
// لحساب الموضع. و`fixed` كانت ستفرض حساب إزاحة الشريط الجانبيّ يدوياً
// وتتبع حالة طيّه؛ اللاصق يبقى داخل عمود المحتوى فيحاذيه من تلقائه.
//
// **٤) شفّاف قليلاً وهو يطفو، معتم وهو راسٍ.** الشفافية ليست زينة: المربّع
// يمرّ فوق أرقام تُقرأ، فإعتامه الكامل أثناء التمرير يحجب ما جاء المستخدم
// ليراه. وحين يرسو لم يعد فوق شيء، فلا سبب لإخفاء أيّ جزء منه.
//
// والنسبة عُدِّلت بطلب المالك مرّةً بعد مرّة: ٦٢٪ ← ٨٨٪ ← ٩٦٪ ← ٨٥٪.
// استقرّت حيث يُقرأ المربّع بوضوح ويبقى ظاهراً أنّه طافٍ فوق المحتوى لا
// جزءاً منه - فالشفافية إشارةٌ إلى حالته، لا زينة ولا إخفاء.
//
// **سؤال وجواب لا محادثة:** لا سجلّ ولا سياق متراكم - كلّ سؤال نداءٌ
// مستقلّ يُخصم من الرصيد المعلَن. سلسلةٌ تحمل تاريخها تضاعف التوكنات مع
// كلّ رسالة، فيدفع المستخدم ثمن ما سبق في كلّ مرّة. والقسم المستقلّ
// (`docs/ai-agent-plan.md`) هو ما يحمل السجلّ حين يُبنى.

import { useState, useRef, useEffect } from "react";
import { Sparkles, ArrowUp, Loader2, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { MarkdownAnswer } from "@/app/components/MarkdownAnswer";
import { showcaseFor, fillShowcaseMoney } from "@/lib/demoAgentShowcase";

export type AiAskScope = "home" | "campaigns" | "store";

const TYPE_MS = 45;
const ERASE_MS = 22;
const HOLD_MS = 1900;
/** مهلة بين خطوة عملٍ وأختها - تُقرأ ولا تُنتظر */
const STEP_MS = 780;
/**
 * زمن كشف الجواب كاملاً - **ثابت لا سرعةُ حرف**. جوابٌ من ألف حرف
 * بسرعةٍ ثابتة يستغرق ضعف جوابٍ من خمسمئة، فينتظر القارئ أطول كلّما
 * كان الجواب أغنى. تثبيت المدّة يجعل عدد الأحرف في النبضة يتبع الطول.
 *
 * ورُفع من ٢٤٠٠ إلى ٤٦٠٠ بطلب المالك: «خلّيها هادية، مش كإنّ حدّ بيجري
 * وراها». والكشف هنا ليس انتظاراً بلا مقابل - هو ما يُري أنّ خلف الجواب
 * عملاً جرى، فالإسراع فيه يُلغي غرضه.
 */
const REVEAL_MS = 4600;
const REVEAL_TICK_MS = 28;

export function AiAsk({
  scope,
  locale,
  currency = "SAR",
  demo = false,
}: {
  scope: AiAskScope;
  locale: Locale;
  /** عملة المساحة - تُحوَّل إليها مبالغ الاستعراض المحفوظ */
  currency?: string;
  /** مساحة عرض تجريبية: استعراض محفوظ بدل نداء مدفوع */
  demo?: boolean;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `aiAsk.${k}`, v);
  const examples = [1, 2, 3].map((n) => tr(`ph_${scope}_${n}`));

  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  /** كم حرفاً من الجواب ظهر حتى الآن - يتصاعد فيُكتب الجواب أمام العين */
  const [revealed, setRevealed] = useState(0);
  /** السؤال المرسَل - يُعرض فوق الجواب، فيُقرأ الجواب في سياق سؤاله */
  const [asked, setAsked] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState("");
  /** المثال الجاري كتابته - به يُعرف أيّ استعراضٍ محفوظ يُشغَّل */
  const [exampleIndex, setExampleIndex] = useState(0);
  const [docked, setDocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /** هل في اللوحة ما يُقرأ؟ يُحسب هنا لأنّ الكتابة التدريجية تقرؤه */
  const open = !!answer || !!error || !!note || !!asked || steps.length > 0;
  /** الجواب لم يكتمل بعد - خطواتٌ تتوالى أو أحرفٌ تُكشف */
  const settling = busy || (!!answer && revealed < answer.length);

  // مؤقّتات الاستعراض تعيش أطول من ضغطة الزرّ: مغادرة الصفحة أثناءها كانت
  // ستحدّث حالة مكوّنٍ أُزيل. تُجمع لتُلغى دفعةً واحدة.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

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

  // ── كشف الجواب حرفاً حرفاً ──────────────────────────────
  //
  // الجواب يُبنى أمام القارئ: الجملة تُكتب، ثمّ يظهر عنوان البطاقة، ثمّ
  // ينزل الجدول صفّاً صفّاً. وليست زينةً - جوابٌ يظهر دفعةً واحدة يُقرأ
  // كصفحةٍ حُمِّلت، وظهورُه متدرّجاً يُري أنّ خلفه عملاً جرى.
  //
  // والقصّ يعرف الجداول (`cutSafely` في العارض): بلا ذلك تمرّ لحظةٌ يظهر
  // فيها رأس الجدول فقرةً فيها أنابيب قبل أن يكتمل سطر المحاذاة تحته.
  useEffect(() => {
    if (!answer) { setRevealed(0); return; }

    // مَن يطلب تقليل الحركة يرى الجواب كاملاً فوراً - لا يُحرم منه ولا يُجبَر
    // على انتظار حركةٍ طلب إيقافها.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setRevealed(answer.length); return; }

    const perTick = Math.max(1, Math.ceil(answer.length / (REVEAL_MS / REVEAL_TICK_MS)));
    let shown = 0;
    setRevealed(0);
    const id = setInterval(() => {
      shown = Math.min(answer.length, shown + perTick);
      setRevealed(shown);
      // اللوحة تتبع آخر ما كُتب، وإلّا نما الجواب أسفل حدّها ولم يُرَ.
      // وتتوقّف عن ملاحقته إن صعد القارئ بنفسه ليقرأ ما فات - انتزاعُ
      // موضع القراءة منه أسوأ من إخفاء آخر سطر.
      const el = panelRef.current;
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
        el.scrollTop = el.scrollHeight;
      }
      if (shown >= answer.length) clearInterval(id);
    }, REVEAL_TICK_MS);
    return () => clearInterval(id);
  }, [answer]);

  // ── الكتابة التدريجية ───────────────────────────────────
  useEffect(() => {
    // مَن بدأ يكتب لا يحتاج اقتراحاً يتحرّك أمامه، ومَن يطلب تقليل الحركة
    // يرى المثال الأوّل ساكناً - لا يُحرم منه.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setTyped(examples[0]); setExampleIndex(0); return; }
    // ومتى فُتحت المحادثة كذلك: مثالٌ يُكتب أسفل سؤالٍ أُرسل فعلاً يُقرأ
    // كأنّ المربّع لم يستقبل شيئاً.
    if (focused || value || open) return;

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
          setExampleIndex(i);
        }
        timer = setTimeout(step, ERASE_MS);
      }
    };
    timer = setTimeout(step, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, value, open, scope, locale]);

  function reset() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setError(null);
    setNote(null);
    setAnswer(null);
    setRevealed(0);
    setAsked(null);
    setSteps([]);
    setUpgradeUrl(null);
  }

  /** أيّ مثالٍ يطابق هذا النصّ - تطابقاً تامّاً أو بادئةً منه */
  function matchExample(text: string): number {
    const q = text.trim();
    if (!q) return -1;
    return examples.findIndex((e) => e === q || e.startsWith(q));
  }

  // ── الاستعراض المحفوظ ───────────────────────────────────
  // خطوات تتابع ثمّ جواب. لا نداء ولا خصم - `blockAiInDemo` تمنع النداء
  // من الديمو أصلاً، وهذا ما يُريه بدل رسالة منع لا تُظهر شيئاً.
  function runShowcase(index: number) {
    const entry = showcaseFor(scope, index);
    if (!entry) { setNote(tr("demoUnmatched")); return; }

    setBusy(true);
    const list = entry.steps[locale === "en" ? "en" : "ar"];
    list.forEach((s, n) => {
      timers.current.push(setTimeout(() => setSteps((prev) => [...prev, s]), n * STEP_MS));
    });
    timers.current.push(
      setTimeout(() => {
        setAnswer(fillShowcaseMoney(entry.answer[locale === "en" ? "en" : "ar"], currency));
        setBusy(false);
      }, list.length * STEP_MS + 320),
    );
  }

  async function ask() {
    if (busy) return;

    // المربّع فارغ والمثال يُكتب: تُكمَل الجملة في المربّع ثمّ تُرسل، فيرى
    // المستخدم ما أرسله كاملاً لا مبتوراً عند الحرف الذي وقف عنده.
    const usingExample = !value.trim();
    const index = usingExample ? exampleIndex : matchExample(value);
    const q = usingExample ? examples[exampleIndex] : value.trim();
    if (q.length < 3) return;

    reset();
    setAsked(q);
    // 🔴 الحاوية تترك التصاقها الآن (`open`)، فتنتقل من أسفل الشاشة إلى
    // موضعها الطبيعيّ في الصفحة - وهي قفزةٌ تُقرأ ارتجاجاً. تمريرةٌ لاحقة
    // إلى الموضع الجديد تجعل الانتقال حركةً مقصودة لا اهتزازاً.
    // `requestAnimationFrame` لا استدعاءٌ فوريّ: الموضع الجديد لا يوجد
    // قبل أن يرسم المتصفّح التغيير.
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    // المربّع يُفرَّغ فور الإرسال: السؤال انتقل إلى فقاعته أعلاه، وبقاؤه
    // مكتوباً أسفلها يجعله يبدو غير مرسَل.
    setValue("");

    if (demo) {
      if (index < 0) { setNote(tr("demoUnmatched")); return; }
      runShowcase(index);
      return;
    }

    setBusy(true);
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
  }

  function pick(index: number) {
    reset();
    if (demo) { setAsked(examples[index]); runShowcase(index); return; }
    setValue(examples[index]);
    inputRef.current?.focus();
  }

  // يُعتم كاملاً متى رسا، أو متى كان فيه ما يُقرأ، أو أثناء الكتابة -
  // الشفافية لحالة السكون وحدها.
  const solid = docked || focused || open || !!value;

  return (
    <>
      {/* 🔴 **يطفو وهو فارغ، ويستقرّ في الصفحة متى امتلأ.**
          المربّع الفارغ دعوةٌ تتبع القارئ أينما مرّر - وهذا سبب التصاقه.
          أمّا وفيه جوابٌ بجدوله فهو محتوى، ومحتوىً ملتصقٌ يمرّ فوق بقيّة
          الصفحة ويحجبها (مرّ فوق «مهامّ اليوم» في لقطة المالك). فمتى صار
          فيه ما يُقرأ عاد إلى مجرى الصفحة يتمرّر معها كأيّ بطاقة، ويبقى
          تمريره الداخليّ داخله وحده. */}
      <div
        className={`z-30 mt-6 transition-opacity duration-300 ${
          open ? "relative" : "sticky bottom-5"
        } ${solid ? "opacity-100" : "opacity-[0.85] hover:opacity-100"}`}
      >
        {/* ── لوحة المحادثة ──────────────────────────────────────
            🔴 **فوق المربّع لا تحته، وعلى سطحٍ معتم لا شفّاف.**

            كانت تُرسَم داخل الحاوية اللاصقة وتحت المربّع بلا خلفية، فتمرّ
            كلماتُها **فوق الرسم البيانيّ** ويُقرأ الاثنان متشابكين - نصٌّ
            على محور تواريخ. الحاوية طافية بطبيعتها، وكلّ ما يوضع فيها
            يحتاج سطحه الخاصّ، وإلّا ظهر ما تحته من خلاله.

            وفوقه لأنّ المربّع مرساه أسفل الشاشة: جوابٌ تحته يخرج عن
            الحافة، وفوقه ينمو إلى أعلى حيث المساحة. وهو ترتيب المحادثة
            الطبيعيّ كذلك - السؤال والجواب فوق، وموضع الكتابة أسفلهما.

            وسقفُ الارتفاع يمنع جواباً طويلاً من ابتلاع الشاشة: يتمرّر
            داخل اللوحة وحدها، وما تحته من الصفحة يبقى ظاهراً. */}
        {open && (
          <div
            ref={panelRef}
            // 🔴 `min-h` أثناء العمل: الجواب ينمو حرفاً حرفاً، ولوحةٌ
            // تكبر مع كلّ حرف تدفع ما تحتها في الصفحة أربعين مرّة في
            // الثانية - وهي الاهتزاز الذي رآه المالك. بارتفاعٍ أدنى
            // ثابت تبلغ اللوحة حجمها من أوّل لحظة، فيملؤها النصّ بلا
            // أن يتحرّك شيء حولها.
            className={`card-shadow mb-2 max-h-[min(62vh,540px)] min-w-0 overflow-y-auto rounded-2xl border border-border bg-surface p-3.5 ${
              settling ? "min-h-[320px]" : ""
            }`}
          >
            {error && (
              <div className="note border-critical/35 bg-critical/[0.06] text-critical">
                <span className="min-w-0 flex-1">{error}</span>
                {upgradeUrl && (
                  <a href={upgradeUrl} className="btn btn-primary btn-sm shrink-0">{tr("upgrade")}</a>
                )}
              </div>
            )}

            {/* أيّ منعٍ يحمل معه بديله: قائمة الأمثلة تحته هي الخطوة التالية */}
            {note && (
              <div className="note border-border bg-surface-2 text-text-secondary">
                <span className="min-w-0 flex-1">{note}</span>
              </div>
            )}

            {/* الشكل من مرجعٍ اختاره المالك: السؤال فقاعةٌ داكنة في جهة
                صاحبه، والجواب إلى جانب علامة المنتج بلا إطارٍ حوله - الإطار
                للبيانات وحدها. وضعُ الجواب كلّه في بطاقةٍ كان يجعل الجملة
                والجدول شيئاً واحداً، وهما شيئان: قولٌ ودليلُه. */}
            {(steps.length > 0 || answer || asked) && (
              <div className="min-w-0 space-y-3">
                {asked && (
                  <div className="flex min-w-0 items-start justify-end gap-2">
                    <p className="max-w-[85%] rounded-2xl bg-text-primary px-3.5 py-2 text-[13px] leading-relaxed text-bg">
                      {asked}
                    </p>
                    <button
                      onClick={reset}
                      aria-label={t(locale, "ui.close")}
                      className="mt-1 shrink-0 rounded-lg p-1 text-text-faint transition-colors hover:text-text-primary"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {(steps.length > 0 || answer) && (
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="icon-badge mt-0.5 h-7 w-7 shrink-0 bg-accent/12 text-accent">
                      <Sparkles size={13} />
                    </span>
                    <div className="min-w-0 flex-1 space-y-3">
                      {/* الخطوات تبقى بعد وصول الجواب: هي التي تُري **كيف**
                          وصل إليه، واختفاؤها يحوّل الاستعراض إلى جوابٍ ظهر
                          من العدم. */}
                      {steps.length > 0 && (
                        <ul className="space-y-1.5 border-s-2 border-accent/25 ps-3">
                          {steps.map((s, n) => (
                            <li key={n} className="text-[12px] leading-relaxed text-text-muted">
                              {s}
                            </li>
                          ))}
                        </ul>
                      )}

                      {answer && <MarkdownAnswer text={answer} reveal={revealed} />}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
            // متى فُتحت المحادثة توقّفت الكتابة التدريجية، فيتجمّد المثال
            // في منتصف حرفه («Why is my cost per») ويُقرأ كأنّه عطل. يُستبدَل
            // بدعوةٍ صريحة إلى سؤالٍ آخر - وهي الحالة الصحيحة بعد جوابٍ وصل.
            placeholder={focused || value ? "" : open ? tr("followUp") : typed}
            maxLength={400}
            disabled={busy}
            spellCheck={false}
            // `focus-ring-none`: الحلقة على الحلقة الخارجية لا حول النصّ -
            // وإلّا ظهر مستطيل أزرق **داخل** المربّع عند الكتابة.
            className="focus-ring-none min-w-0 flex-1 bg-transparent text-[13.5px] text-text-primary outline-none placeholder:text-text-faint"
          />
          <button
            onClick={ask}
            // لا شرط على طول المُدخَل: المربّع الفارغ يرسل المثال المعروض،
            // وتعطيلُه حينها كان يجعل السهم يبدو معطوباً وقتَ أنفع ضغطة فيه.
            disabled={busy}
            aria-label={tr("send")}
            className="btn btn-primary btn-icon btn-sm rounded-full disabled:opacity-35"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} />}
          </button>
        </div>

        {/* سطر التكلفة: النداء يُخصم من الرصيد المعلَن، وإخفاء ذلك حتى ينفد
            الرصيد هو ما يجعل الحدّ يبدو مفاجأةً لا شرطاً معروفاً. يظهر عند
            الرسوّ أو التركيز فقط - سطرٌ دائم يطفو فوق المحتوى ضجيج.
            وفي مساحة العرض لا يُخصم شيء، فلا يُقال إنّه يُخصم. */}
        {solid && !open && !demo && (
          <p className="mt-1.5 px-4 text-[11px] text-text-faint">{tr("costNote")}</p>
        )}

        {/* أمثلة مساحة العرض: ما يعمل عليه الاستعراض معروضٌ صراحةً بدل أن
            يُنتظر مرورُه في الكتابة التدريجية. */}
        {demo && !open && solid && (
          <div className="mt-2 space-y-1.5">
            <p className="px-1 text-[11px] text-text-faint">{tr("demoHint")}</p>
            <div className="flex flex-wrap gap-1.5">
              {examples.map((e, n) => (
                <button
                  key={n}
                  onClick={() => pick(n)}
                  className="chip max-w-full border border-border bg-surface text-text-secondary transition-colors hover:border-accent/45 hover:text-text-primary"
                >
                  <span className="truncate">{e}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* الحارس - بلا ارتفاع، وجوده كلّه ليُرصد ظهوره */}
      <div ref={sentinelRef} aria-hidden className="h-px" />
    </>
  );
}
