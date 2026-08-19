// lib/supportCategories.ts
//
// موضوعات محادثات الدعم - **قائمة مغلقة يختار منها الأدمن، مش تصنيف آليّ.**
//
// السؤال "أكتر مشكلة بتتكرر؟" مالوش إجابة من نصّ حرّ إلا بتحليل لغة، وده
// نداء نموذج لكل محادثة عشان تصنيف الأدمن نفسه يقدر يعمله في ثانية وهو
// بيقرا. القائمة قصيرة عن قصد: قائمة طويلة معناها إنّ نفس المشكلة بتتحطّ
// في خانتين مختلفتين حسب المزاج، والتقرير بيبقى بلا معنى.

export const SUPPORT_CATEGORIES = [
  { key: "billing", label: "Billing & payments" },
  { key: "connection", label: "Platform connection" },
  { key: "data", label: "Missing or wrong data" },
  { key: "feature", label: "How do I / feature question" },
  { key: "bug", label: "Bug" },
  { key: "account", label: "Account & access" },
  { key: "other", label: "Other" },
] as const;

export type SupportCategoryKey = (typeof SUPPORT_CATEGORIES)[number]["key"];

export function isSupportCategory(v: unknown): v is SupportCategoryKey {
  return typeof v === "string" && SUPPORT_CATEGORIES.some((c) => c.key === v);
}

export function supportCategoryLabel(key: string | null | undefined): string {
  return SUPPORT_CATEGORIES.find((c) => c.key === key)?.label ?? "Uncategorised";
}
