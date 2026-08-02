// lib/activeWorkspace.ts
//
// **مصدر الحقيقة الوحيد لمساحة العمل النشطة.**
//
// كانت كل صفحة تقرأ `findFirst({ userId, orderBy: createdAt asc })` بنفسها،
// أي **أقدم** مساحة للمستخدم لا المساحة التي اختارها. النتيجة عطلان معاً:
//
// ١) مبدّل مساحات العمل لم يكن يبدّل المحتوى إطلاقاً - الإطار الجانبي
//    يقرأ الكوكي فيعرض الاسم الجديد، والصفحة تقرأ الأقدم فتعرض أرقامها.
// ٢) المساحة التجريبية بدت فارغة تماماً رغم امتلائها: الشريط العلوي يقول
//    «عرض تجريبي» (من الكوكي) والمحتوى تحته من المساحة الحقيقية الفارغة.
//
// شرط `userId` في الاستعلام ليس تجميلاً: الكوكي يأتي من العميل، وبدونه
// يصبح تبديل قيمته قراءةً لمساحة عمل مستخدم آخر.

import { cookies } from "next/headers";
import type { Workspace } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ACTIVE_WORKSPACE_COOKIE = "adloop_workspace";

/**
 * المساحة كاملة لا مُنتقاة: النوع الصريح هنا مقصود. التوقيع العام الذي
 * يمرّر `select` جعل Prisma تُرجع اتحاد كل الأنواع الممكنة، فانهار
 * الاستدلال في ستّ وخمسين صفحة دفعة واحدة. حقول المساحة قليلة، وجلبها
 * كاملة أرخص بكثير من طبقة أنواع هشّة.
 */
export async function getActiveWorkspace(userId: string): Promise<Workspace | null> {
  const store = await cookies();
  const activeId = store.get(ACTIVE_WORKSPACE_COOKIE)?.value;

  if (activeId) {
    // الكوكي قد يشير إلى مساحة حُذفت أو إلى مساحة ليست له - كلاهما يسقط
    // إلى الأقدم بدل أن يرمي أو يكشف بيانات غيره.
    const owned = await prisma.workspace.findFirst({ where: { id: activeId, userId } });
    if (owned) return owned;
  }

  return prisma.workspace.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

/** معرّف المساحة النشطة بعد التحقّق من ملكيتها، أو الأقدم عند غيابها */
export async function getActiveWorkspaceId(userId: string): Promise<string | null> {
  return (await getActiveWorkspace(userId))?.id ?? null;
}
