"use client";

// app/components/SupportRatingCard.tsx
//
// **بطاقةُ تقييم الخدمة - جوّه المحادثة، مش نافذةً فوقها.**
//
// النافذةُ المنبثقة بتتقفل بالعادة قبل ما تتقري، فالرقمُ اللي بيرجع منها
// بيبقى رأيَ اللي مالوش مانع من المقاطعة وحدهم. البطاقةُ في آخر المحادثة
// بتظهر في مكانها الطبيعيّ: بعد آخر ردّ، لمّا الحوار يبقى خلص.
//
// **الدرجةُ بتتحفظ لحظةَ الدوس** - مش عند «إرسال». ده الفرق بين تقييمٍ
// نسبةُ إكماله عالية وواحدٍ بيبدأه الناس وبيسيبوه. وكلُّ خطوةٍ بعدها
// (الأسباب، التعليق) اختياريّةٌ وبتتحفظ لوحدها كمان.
//
// القواعدُ (إمتى تظهر أصلاً) مش هنا - هي في `lib/supportRating.ts`
// والسيرفرُ هو اللي بيحسمها.

import { useState } from "react";
import { Check } from "lucide-react";
import { t } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/dictionary";
import { RATING_POSITIVE_FROM, reasonsForScore } from "@/lib/supportRating";

// 🔴 **أسماءُ الأصناف مكتوبةٌ كاملةً لا مركَّبة.**
//
// Tailwind بيمسح الكودَ كنصّ عشان يعرف أنهي صنفٍ يولّده، فـ`bg-${tone}`
// مابيتولّدش أبداً - الزرُّ بيطلع بلا لون خالص، والفحصُ بالأنواع مابيشوفش
// الحاجة دي لأنّها سلسلةٌ صحيحة. اللونُ دلاليّ: الواطي أحمر والوسط أصفر
// والعالي أخضر.
const SCALE_TONE: Record<number, { on: string; off: string }> = {
  1: { on: "border-critical bg-critical text-white", off: "border-border-visible text-text-muted hover:border-critical hover:text-critical" },
  2: { on: "border-critical bg-critical text-white", off: "border-border-visible text-text-muted hover:border-critical hover:text-critical" },
  3: { on: "border-warning bg-warning text-white", off: "border-border-visible text-text-muted hover:border-warning hover:text-warning" },
  4: { on: "border-success bg-success text-white", off: "border-border-visible text-text-muted hover:border-success hover:text-success" },
  5: { on: "border-success bg-success text-white", off: "border-border-visible text-text-muted hover:border-success hover:text-success" },
};

// المفاتيحُ مكتوبةٌ كاملةً لا مركَّبة من قطعتين، عشان فحصُ التغطية يشوفها:
// مفتاحٌ مبنيٌّ في وقت التشغيل بيعدّي من الفحص وهو ناقص، ويطلع مساراً
// خاماً على شاشة العميل - وهو الشكلُ اللي الفحصُ ده اتعمل عشانه أصلاً.
const REASON_KEY: Record<string, string> = {
  slow: "supportChat.ratingReasonSlow",
  unresolved: "supportChat.ratingReasonUnresolved",
  unclear: "supportChat.ratingReasonUnclear",
  repeat: "supportChat.ratingReasonRepeat",
  fast: "supportChat.ratingReasonFast",
  resolved: "supportChat.ratingReasonResolved",
  clear: "supportChat.ratingReasonClear",
  friendly: "supportChat.ratingReasonFriendly",
};

export interface RatingState {
  ask: boolean;
  triggerMessageId: string | null;
  score: number | null;
  reasons: string[];
  comment: string;
}

export function SupportRatingCard({
  locale, state, onChange, onDismiss,
}: {
  locale: Locale;
  state: RatingState;
  /** بيتنده بعد كلّ حفظٍ ناجح عشان الحالة في الأب تفضل مطابقة للسيرفر. */
  onChange: (next: Partial<RatingState>) => void;
  onDismiss: () => void;
}) {
  const tr = (k: string) => t(locale, `supportChat.rating${k}`);
  const [comment, setComment] = useState(state.comment);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const id = state.triggerMessageId;
  if (!id) return null;

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch("/api/support/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerMessageId: id, ...patch }),
      });
    } finally {
      setBusy(false);
    }
  }

  function pick(n: number) {
    // الحالةُ بتتحرّك فوراً والحفظُ بيمشي وراها: انتظارُ الشبكة عشان
    // الزرّ يتلوّن بيخلّي الدوسة تبان ضايعة فيدوس تاني.
    onChange({ score: n });
    void save({ score: n });
  }

  function toggleReason(r: string) {
    const next = state.reasons.includes(r)
      ? state.reasons.filter((x) => x !== r)
      : [...state.reasons, r];
    onChange({ reasons: next });
    void save({ reasons: next });
  }

  async function sendComment() {
    await save({ comment });
    onChange({ comment });
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-2xl bg-success/10 px-3 py-2 text-[12.5px] text-success">
        <Check size={13} /> {tr("Done")}
      </div>
    );
  }

  const scored = state.score !== null;
  const positive = (state.score ?? 0) >= RATING_POSITIVE_FROM;

  return (
    <div className="mt-2 rounded-2xl border border-border bg-surface-raised p-3">
      <p className="m-0 mb-2 text-[12.5px] font-medium text-text-primary">
        {!scored ? tr("Ask") : positive ? tr("ThanksHigh") : tr("ThanksLow")}
      </p>

      {/* ═══ المقياس ═══
          خمسةُ أرقام لا وجوه: الوجوهُ بتتصيّر مختلفةً على كلّ نظام،
          والأرقامُ اللاتينية قاعدةٌ في المنتج كلّه حتى في الواجهة العربية.
          واللونُ دلاليٌّ لا زخرفة - الواطي أحمر والعالي أخضر، فالمقياسُ
          مقروءٌ قبل قراءة الطرفين. */}
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = state.score === n;
          const tone = SCALE_TONE[n];
          return (
            <button
              key={n}
              onClick={() => pick(n)}
              disabled={busy}
              aria-label={String(n)}
              aria-pressed={on}
              className={`grid size-9 place-items-center rounded-xl border text-[13px] tabular-nums transition-colors ${
                on ? tone.on : tone.off
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>

      {!scored && (
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[10.5px] text-text-faint">{tr("ScaleLow")}</span>
          <span className="text-[10.5px] text-text-faint">{tr("ScaleHigh")}</span>
        </div>
      )}

      {scored && (
        <>
          {/* الأسبابُ بتتبدّل حسب الاتجاه: عرضُ «كان سريعاً» على واحدٍ
              دَي واحد بيخلّي البطاقة تبان مش قارية اللي قاله. */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {reasonsForScore(state.score!).map((r) => {
              const on = state.reasons.includes(r);
              return (
                <button
                  key={r}
                  onClick={() => toggleReason(r)}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] transition-colors ${
                    on
                      ? "border-accent bg-accent/12 text-accent"
                      : "border-border-visible text-text-muted hover:bg-surface"
                  }`}
                >
                  {t(locale, REASON_KEY[r] ?? r)}
                </button>
              );
            })}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder={tr("CommentPlaceholder")}
            className="field mt-2 w-full resize-none text-[12.5px]"
          />

          <div className="mt-2 flex justify-end">
            <button
              onClick={sendComment}
              disabled={busy}
              className="rounded-lg bg-accent px-3 py-1.5 text-[12px] text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {tr("Send")}
            </button>
          </div>
        </>
      )}

      {/* «مش دلوقتي» بتفضل موجودة قبل الدرجة بس: بعد ما يدّي درجة يبقى
          التقييمُ اتحفظ فعلاً، و«مش دلوقتي» ساعتها بتوعد بتراجعٍ مش
          هيحصل. */}
      {!scored && (
        <button
          onClick={onDismiss}
          className="mt-2 text-[11.5px] text-text-faint underline-offset-2 transition-colors hover:text-text-muted hover:underline"
        >
          {tr("NotNow")}
        </button>
      )}
    </div>
  );
}
