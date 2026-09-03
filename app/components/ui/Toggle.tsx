"use client";

// مفتاح تشغيل/إيقاف موحّد للبرنامج كله.
//
// السبب في وجوده: كانت هناك نسختان منفصلتان (الإعدادات والأتمتة) وكلتاهما
// تحرّك المقبض بـ translateX بقيم سالبة، فيخرج خارج المسار ويبدو مكسوراً.
// إصلاح إحداهما لا يصلح الأخرى - فالحل نسخة واحدة يستوردها الجميع.
//
// ═══ الهندسة: الفراغُ حوالين المقبض متساوٍ من الأربع جهات ═══
//
// 🔴 كان `px-0.5` (٢ بكسل) أفقياً بلا حشوةٍ رأسية أصلاً، والتوسيطُ الرأسيّ
// متروكٌ لـ`items-center` مع مقبضٍ أكبر من الفراغ المتاح: الفراغُ بيطلع
// **١ بكسل فوق وتحت و٢ على الجنب**. الفرقُ بكسلٌ واحد، ومحدّش بيقدر
// يسمّيه لمّا يشوفه - بس العينُ بتقراه «مش مظبوط»، وهو الانطباعُ اللي
// بيتكوّن عن المنتج كلّه من تفصيلةٍ زيّ دي.
//
// الأرقامُ دلوقتي مقفولة: الإطارُ ١ + الحشوة ٢ = **٣ بكسل متساوية**،
// والمقبضُ بياخد الباقي بالظبط.
//
//   md: مسار ٢٤×٤٤ → داخل ١٨×٣٨ → مقبض ١٨ → مسافة انزلاق ٢٠
//   sm: مسار ٢٠×٣٦ → داخل ١٤×٣٠ → مقبض ١٤ → مسافة انزلاق ١٦
//
// والإطارُ موجودٌ في الحالتين (شفّافٌ عند التشغيل) عشان الهندسة
// ماتفرقش بين الوضعين - إطارٌ يظهر ويختفي بيزحزح المقبض بكسلاً كلّ دوسة.
//
// ═══ الحركة: انزلاقٌ لا قفزة ═══
//
// 🔴 كان `transition-transform` مكتوباً على المقبض وهو **لا يفعل شيئاً**:
// الموضعُ كان بيتغيّر بـ`justify-start`/`justify-end`، وتغييرُ التخطيط
// مالوش انتقالٌ في CSS. فالمقبضُ كان بيقفز، والقفزةُ بتتقري «رخيص».
// بقى `translate` حقيقيّ - وهو اللي بينتقل فعلاً - و`rtl:` بتقلب اتجاهه
// في العربية، وهو السببُ الأصليّ اللي خلّى النسخة القديمة تهرب لـflex.

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  const track = sm ? "h-5 w-9" : "h-6 w-11";
  const knob = sm ? "size-3.5" : "size-[18px]";
  const slide = checked
    ? sm
      ? "translate-x-4 rtl:-translate-x-4"
      : "translate-x-5 rtl:-translate-x-5"
    : "translate-x-0";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`flex ${track} shrink-0 items-center justify-start rounded-full border p-[2px] transition-colors duration-200 disabled:opacity-45 ${
        checked ? "border-transparent bg-verified" : "border-border bg-surface-raised"
      }`}
    >
      <span
        className={`${knob} ${slide} rounded-full bg-white shadow-sm transition-transform duration-200 ease-out`}
      />
    </button>
  );
}
