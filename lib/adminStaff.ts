// lib/adminStaff.ts
//
// **مَن «الفريق»؟ سؤالٌ بجوابٍ واحد.**
//
// 🔴 المالكُ ممكن يكون `isAdmin=false` في قاعدة البيانات وهو مالكُ المنصّة:
// `resolveAdminRole` بيمنحه `OWNER` **بالبريد قبل ما يبصّ للحقل أصلاً**
// (الحبلُ اللي بيمنع قفله بره لوحته بتعديل صفٍّ واحد). فأيُّ استعلامٍ
// بيقول `where: { isAdmin: true }` بيسيبه بره القائمة - وهو موجودٌ في
// اللوحة وشغّالٌ فيها.
//
// والنتيجةُ مش تجميلية:
//   • مش بيظهر في «مسنَد لـ»، فمحادثاتُه مالهاش صاحبٌ في التقارير.
//   • `PATCH /api/admin/inbox/[id]` كان **بيرفض** التعيين له لو ظهر.
//   • مش بيتبلّغ برسالةٍ واردة جديدة.
//   • مش بيبان في فلتر سجلّ التدقيق.
//
// الفلترُ هنا هو الجواب الوحيد، والأربعةُ بيستوردوه - فإضافةُ حالةٍ خامسة
// بتتعمل مرّةً واحدة بدل ما تتنسى في رابع مكان.

import type { Prisma } from "@prisma/client";
import { OWNER_EMAIL } from "@/lib/owner";

/**
 * كلُّ مَن يدخل اللوحة: حسابات `isAdmin`، **والمالكُ ببريده**.
 *
 * وبلا `OWNER_EMAIL` مضبوط بيرجع لشرط `isAdmin` وحده: سلسلةٌ فاضية
 * مالهاش تطابق، والفرعُ بيتشال خالص بدل ما يجيب كلَّ حسابٍ ببريدٍ فاضي.
 */
export const STAFF_WHERE: Prisma.UserWhereInput = OWNER_EMAIL
  ? { OR: [{ isAdmin: true }, { email: { equals: OWNER_EMAIL, mode: "insensitive" } }] }
  : { isAdmin: true };

/** نفسُ الشرط مدموجاً مع شروطٍ تانية - للتحقّق من هدفِ تعيينٍ بعينه. */
export function staffWhere(extra: Prisma.UserWhereInput = {}): Prisma.UserWhereInput {
  return { AND: [STAFF_WHERE, extra] };
}
