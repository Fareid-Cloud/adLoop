// lib/admin/agentVerdicts.ts
//
// **قائمةُ الأحكام وحدها - صفرُ استيراد.**
//
// كانت في `lib/admin/agentReview.ts` جنب استعلامات Prisma، وشاشةُ
// المراجعة (كلاينت كومبوننت) بتستوردها كقيمةٍ لا كنوع - فبتجرّ ملفَّ
// الخادم كلَّه معاها إلى حزمة المتصفّح. عدّت لحد دلوقتي لأنّ Next
// بيُخرج Prisma من الحزمة، لكنّها بتفضل معلّقة على تفصيلةِ تجميعٍ ممكن
// تتغيّر - ونفس الشكل بالظبط كسر البناء مع `web-push`.
//
// إضافةُ أيّ `import` هنا بتعيد الاعتماد ده.

export const VERDICTS = [
  { key: "GOOD", label: "Good" },
  { key: "WRONG_NUMBER", label: "Wrong number" },
  { key: "HALLUCINATED", label: "Made something up" },
  { key: "SHALLOW", label: "Shallow" },
  { key: "IGNORED_DATA", label: "Ignored the data it had" },
  { key: "TOO_LONG", label: "Too long" },
] as const;
