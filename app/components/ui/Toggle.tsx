"use client";

// مفتاح تشغيل/إيقاف موحّد للبرنامج كله.
//
// السبب في وجوده: كانت هناك نسختان منفصلتان (الإعدادات والأتمتة) وكلتاهما
// تحرّك المقبض بـ translateX بقيم سالبة، فيخرج خارج المسار ويبدو مكسوراً.
// إصلاح إحداهما لا يصلح الأخرى - فالحل نسخة واحدة يستوردها الجميع.
//
// الموضع يعتمد على تخطيط flex (justify-start / justify-end) لا على حساب
// بكسلات: يعمل تلقائياً في الاتجاهين (RTL وLTR) ولا يمكن أن يخرج عن المسار.

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
  const track = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`flex ${track} shrink-0 items-center rounded-full border px-0.5 transition-colors duration-200 disabled:opacity-45 ${
        checked
          ? "justify-end border-transparent bg-verified"
          : "justify-start border-border bg-surface-raised"
      }`}
    >
      <span className={`${knob} rounded-full bg-white shadow-sm transition-transform duration-200`} />
    </button>
  );
}
