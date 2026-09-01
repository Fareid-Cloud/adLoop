// app/components/AgentIcon.tsx
//
// علامةُ وكيل AdLoop: **روبوتٌ هوائيُّه حلقة.**
//
// الفكرة أن يجتمع المعنيان في شكلٍ واحد لا أن يوضَعا جنباً إلى جنب:
// الرأسُ يقول «وكيلٌ يعمل عنك»، والحلقةُ فوقه هي حلقةُ AdLoop نفسها -
// نقرة، تحقّق، إعادة رفع، ثمّ من جديد. ووضعُها موضعَ الهوائيّ يجعلها
// **مصدرَ ما يعرفه**، لا زينةً بجانبه.
//
// وهي مرسومةٌ بحدود lucide نفسها (٢٤×٢٤، عرض حدٍّ ٢، أطرافٌ مستديرة،
// `currentColor`) كي تجلس في القائمة الجانبية بوزن جيرانها، وتكبر إلى
// رأس الصفحة بلا أن تتفكّك: لا تفاصيل تحت البكسل، ولا تعبئةٌ تنقلب في
// الوضع الداكن.

import type { SVGProps } from "react";

export function AgentIcon({
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
      {/* الحلقة: مفتوحةٌ عمداً - الحلقة المقفلة نقطةٌ لا دورة */}
      <path d="M12 5.4a1.9 1.9 0 1 0-1.45-.62" />
      {/* ساقُ الهوائيّ: يصل الحلقة بالرأس، فتُقرأ مصدراً لا زخرفة */}
      <path d="M12 5.4v1.6" />
      {/* الرأس */}
      <rect x="3.75" y="7" width="16.5" height="11.5" rx="3.6" />
      {/* أذنان: تكسران تناظر المستطيل فيُقرأ رأساً لا صندوقاً */}
      <path d="M1.6 12.4v1.9" />
      <path d="M22.4 12.4v1.9" />
      {/* عينان */}
      <path d="M9.1 11.7v1.6" />
      <path d="M14.9 11.7v1.6" />
    </svg>
  );
}
