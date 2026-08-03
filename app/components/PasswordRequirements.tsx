"use client";

// متطلّبات كلمة المرور - مؤشّر حيّ.
//
// **لماذا لا يوجد أخضر:** الأخضر في هذا المنتج يعني «متحقَّق» - رقم أثبتناه
// بدليل مستقلّ. صرفه على «كتبتَ حرفاً كبيراً» يستهلك دلالته حيث لا قيمة،
// فتضعف حيث تلزم. الشرط المستوفى يأخذ لون الثيم لا لون التحقّق.
//
// **الحركة المختارة:** الدائرة تُرسم حتى تُغلق ثمّ تصير علامة صحّ.
// الشطب على النصّ كان خياراً وارداً ورُفض: الشطب يعني «أُلغي» لا «أُنجز»،
// وقراءة سطر مشطوب أصعب. إغلاق الدائرة يقول «اكتمل» بحركة واحدة قصيرة،
// ويبقى النصّ مقروءاً - وهو ما يحتاجه من لم يستوفِ الشرط بعد.

import { t, type Locale } from "@/lib/i18n/dictionary";

interface Rule {
  labelKey: string;
  test: (pw: string) => boolean;
}

// القائمة تحمل **مفاتيح** لا نصوصاً: تُعرَّف على مستوى الوحدة حيث لا وجود
// لـ`locale`، فتُترجَم وقت العرض.
const RULES: Rule[] = [
  { labelKey: "minLen", test: (pw) => pw.length >= 8 },
  { labelKey: "upper", test: (pw) => /[A-Z]/.test(pw) },
  { labelKey: "lower", test: (pw) => /[a-z]/.test(pw) },
  { labelKey: "digit", test: (pw) => /[0-9]/.test(pw) },
  { labelKey: "symbol", test: (pw) => /[^a-zA-Z0-9]/.test(pw) },
];

/** دائرة تُغلق ثمّ تتحوّل إلى علامة صحّ - كلاهما في SVG واحد فيتداخلان بسلاسة */
function RuleMark({ done }: { done: boolean }) {
  const R = 6.5;
  const C = 2 * Math.PI * R;
  const color = "var(--accent)";
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden>
      {/* الحلقة الباهتة: موضع الشرط قبل استيفائه */}
      <circle cx="8" cy="8" r={R} fill="none" stroke="var(--border-visible)" strokeWidth="1.4" />
      {/* الحلقة الملوّنة: تُرسم من الصفر حتى تُغلق */}
      <circle
        cx="8"
        cy="8"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={done ? 0 : C}
        transform="rotate(-90 8 8)"
        style={{ transition: "stroke-dashoffset .32s cubic-bezier(.4,0,.2,1)" }}
      />
      {/* الصحّ يظهر بعد اكتمال الحلقة بقليل، فيُقرأ كنتيجة لها لا كعنصر ثانٍ */}
      <path
        d="M5.2 8.2 7.1 10.1 10.9 6.3"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          opacity: done ? 1 : 0,
          transform: done ? "scale(1)" : "scale(.6)",
          transformOrigin: "center",
          transition: "opacity .2s ease .16s, transform .24s cubic-bezier(.34,1.56,.64,1) .12s",
        }}
      />
    </svg>
  );
}

export function PasswordRequirements({
  password,
  locale = "ar",
}: {
  password: string;
  locale?: Locale;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {RULES.map((rule) => {
        const done = rule.test(password);
        return (
          <span
            key={rule.labelKey}
            className={`flex items-center gap-1.5 text-[11.5px] transition-colors duration-200 ${
              done ? "text-text-primary" : "text-text-faint"
            }`}
          >
            <RuleMark done={done} />
            {t(locale, `pwdReq.${rule.labelKey}`)}
          </span>
        );
      })}
    </div>
  );
}

/**
 * تطابق كلمتَي المرور - نصّ وحده.
 *
 * بلا دائرة ولا علامة: الشروط الخمسة أعلاه تحتاج مؤشّراً لأنها خمسة تُتابَع
 * معاً، أمّا التطابق فحالة واحدة ثنائية - جملة قصيرة تقولها أوضح من رمز
 * يُضاف إلى ستّة رموز فوقه.
 */
export function PasswordMatch({
  password,
  confirm,
  locale = "ar",
}: {
  password: string;
  confirm: string;
  locale?: Locale;
}) {
  // يصمت حتى يبدأ المستخدم كتابة التأكيد: إظهار «غير متطابقتين» على حقل
  // فارغ يقرأ كخطأ ارتكبه قبل أن يكتب حرفاً واحداً.
  if (!confirm) return null;
  const ok = password === confirm;
  return (
    <p className={`mb-3 text-[11.5px] ${ok ? "text-text-muted" : "text-critical"}`}>
      {t(locale, ok ? "pwdReq.match" : "pwdReq.noMatch")}
    </p>
  );
}
