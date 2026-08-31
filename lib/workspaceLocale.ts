// lib/workspaceLocale.ts
//
// لغة صاحب مساحة العمل.
//
// **لماذا ملفّ لهذا:** الوظائف التي تعمل في الخلفية (الكرون، الأتمتة،
// فحص التسعير) لا مستخدمَ أمامها تقرأ تفضيله، فكانت تكتفي بقيمة افتراضية
// `"ar"` مثبّتة في توقيعها. النتيجة أنّ من يستعمل الواجهة الإنجليزية يجد
// تنبيهات الليل عربيةً - وهو تسريب لا يظهر في أيّ فحص لأن الكود «يعمل».
//
// الافتراضيات أُزيلت من تلك التوقيعات، وهذه هي الجهة التي تُجيب عن السؤال
// حين لا يكون هناك طلبٌ ولا جلسة.
//
// **ملاحظة:** الأفضل دائماً تخزين `titleKey` والترجمة عند العرض (كما تفعل
// `pushToActionFeed`). هذه للنصوص الحرّة التي لا مفتاح لها.

import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/i18n/dictionary";

export async function ownerLocaleFor(workspaceId: string): Promise<Locale> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { user: { select: { preferredLocale: true } } },
  });
  return (ws?.user?.preferredLocale as Locale) ?? "en";
}
