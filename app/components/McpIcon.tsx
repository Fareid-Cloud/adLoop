// app/components/McpIcon.tsx
//
// شعار Model Context Protocol كأيقونةٍ خطّية.
//
// **الشعار الرسميّ مصمَتٌ (solid)، وكلّ أيقونات القائمة الجانبية خطّية
// بوزنٍ واحد** (lucide، عرض حدٍّ ٢، أطرافٌ مستديرة). ووضعُ علامةٍ مصمتة
// بينها يجعلها أثقل من جيرانها فتبدو مُقحَمة لا منتمية - والقائمةُ تُقرأ
// كصفٍّ واحد، فالشذوذ فيها يُلاحَظ قبل أن يُقرأ معناه.
//
// فأُعيد رسمُه بالحدود نفسها: الشكل هو الشكل - حلقتان متوازيتان تلتفّان -
// والوزن وزنُ الجيران. `currentColor` تجعله يرث لون الحالة (نشط/خامل)
// كأيّ أيقونةٍ أخرى بلا استثناء.

import type { SVGProps } from "react";

export function McpIcon({
  size = 24,
  strokeWidth = 2,
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {/* الحلقة الأولى: قطرٌ صاعد، التفافٌ نصف دائريّ، ثمّ عودةٌ هابطة */}
      <path d="M3.5 13 9.9 6.6a3 3 0 0 1 4.2 4.2l-6.4 6.4a3 3 0 0 0 4.2 4.2l1.5-1.5" />
      {/* الحلقة الثانية موازيةٌ لها ومزاحة - وهما معاً يصنعان علامة MCP */}
      <path d="M6.6 9.9 13 3.5a3 3 0 0 1 4.2 4.2l-6.4 6.4" />
    </svg>
  );
}
