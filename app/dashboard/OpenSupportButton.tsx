"use client";

// حدود العميل تُرسم حول المُعالِج وحده لا حول البطاقة كلّها.
//
// السبب: `HomePanels.tsx` مكوّن خادم، وتمرير `onClick` منه إلى `<button>`
// يرمي استثناءً وقت العرض ("Event handlers cannot be passed to Client
// Component props") فتسقط الصفحة الرئيسية بأكملها إلى حدّ الخطأ - وهو ما
// كان يظهر للمستخدم كـ«الداشبورد مش بيفتح». المحتوى يبقى مُعروضاً من
// الخادم ويُمرَّر كـ`children`، فلا يتكرّر الشكل في مكانين.

export function OpenSupportButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent("adloop:open-support"))}
    >
      {children}
    </button>
  );
}
