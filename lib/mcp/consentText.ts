// lib/mcp/consentText.ts
//
// نصوص شاشة موافقة OAuth، بلغتيها.
//
// **ولماذا هنا لا في `lib/i18n/dictionary.ts`:** القاموس كان قيد التعديل
// في جلسةٍ أخرى تعمل على الشجرة نفسها وقتَ بناء هذا، والكتابةُ فيه كانت
// ستمحو شغلاً غيرَ مسجَّل بلا أن يحذّر git. فالنصوص هنا مؤقّتاً بالبنية
// نفسها (مفتاحٌ لكلّ لغة)، وتُنقَل إلى القاموس في أوّل دفعةٍ آمنة.
//
// وهي بلغتين من أوّل سطر - القاعدة لا تُؤجَّل لأنّ الملفّ مؤقّت.

export type ConsentLocale = "ar" | "en";

export const CONSENT_TEXT = {
  ar: {
    title: "السماح بالوصول إلى AdLoop",
    intro: "يطلب {client} الوصول إلى بيانات مساحة العمل:",
    workspaceLabel: "مساحة العمل",
    scopeTitle: "ما سيصل إليه",
    scopeRead: "قراءة الحملات والتحويلات المتحقَّقة والطلبات والعملاء",
    scopeNoWrite: "لا يستطيع إيقاف إعلان ولا تغيير ميزانية ولا تعديل أيّ شيء",
    expiry: "ينتهي الوصول بعد ساعة، ويُطلب الإذن من جديد بعدها.",
    approve: "أوافق",
    deny: "رفض",
    revokeHint: "يمكن سحب الإذن في أيّ وقت من صفحة MCP.",
    errTitle: "تعذّر إتمام الطلب",
    errClient: "التطبيق الطالب غير معروف. أعد المحاولة من التطبيق نفسه.",
    errRedirect: "عنوان العودة لا يطابق المسجَّل لهذا التطبيق.",
    errParams: "الطلب ناقص بيانات لازمة (PKCE مطلوب).",
    errNoWorkspace: "لا توجد مساحة عمل على هذا الحساب بعد. أنشئ واحدة ثمّ أعد المحاولة.",
  },
  en: {
    title: "Allow access to AdLoop",
    intro: "{client} is asking to read data from your workspace:",
    workspaceLabel: "Workspace",
    scopeTitle: "What it will reach",
    scopeRead: "Read campaigns, verified conversions, orders and customers",
    scopeNoWrite: "Cannot pause an ad, change a budget, or modify anything",
    expiry: "Access expires in one hour, after which it asks again.",
    approve: "Allow",
    deny: "Deny",
    revokeHint: "You can revoke this at any time from the MCP page.",
    errTitle: "Could not complete the request",
    errClient: "The requesting app is not recognised. Start again from the app itself.",
    errRedirect: "The return address does not match the one registered for this app.",
    errParams: "The request is missing required parameters (PKCE is required).",
    errNoWorkspace: "This account has no workspace yet. Create one and try again.",
  },
} as const;

export function ct(locale: ConsentLocale, key: keyof typeof CONSENT_TEXT.en, vars?: Record<string, string>): string {
  let text: string = CONSENT_TEXT[locale][key] ?? CONSENT_TEXT.en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
  return text;
}
