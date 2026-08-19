// lib/adminRole.ts
//
// **`isAdmin` بيفتح الباب، والدور بيقول إيه المسموح جوّه.**
//
// كان في مستوى واحد: أدمن أو لأ. ومع لوحة تقدر تهدي اشتراكات وتغيّر
// أسعار وترقّي حسابات، "أدمن أو لأ" مش كافي - موظّف دعم محتاج يشوف حساب
// عميل ويردّ عليه ويعمله مزامنة، من غير ما يقدر يمسّ فلوس ولا صلاحيات.
//
// **الملف ده بيقرّر، مش بيفحص جلسة.** بياخد المستخدم كمدخل عشان يفضل
// خالي من أي استيراد لـPrisma أو الكوكيز، فينفع يتنده من مكوّن خادم
// (`app/admin/layout.tsx`) ومن مسار API على السواء.

import { isOwnerEmail } from "@/lib/owner";

export type AdminRoleName = "OWNER" | "SUPPORT";

/** الحد الأدنى اللي محتاجينه من المستخدم عشان نحسم الدور - مش الصف كله */
export interface AdminRoleSubject {
  email: string;
  isAdmin: boolean;
  adminRole?: AdminRoleName | null;
}

/**
 * الدور الفعليّ للحساب، أو `null` لو مش أدمن أصلاً.
 *
 * ترتيب الحسم مقصود:
 *  1. **بريد المالك دايماً OWNER** - حتى لو الحقل في قاعدة البيانات
 *     اتغيّر بالغلط. ده الحبل اللي بيمنع قفل المالك بره لوحته بتعديل
 *     صفّ واحد (نفس منطق الاستثناء في `getEntitlements`).
 *  2. الحقل الصريح لو موجود.
 *  3. `isAdmin=true` بلا دور → OWNER. **ده اللي بيلغي الحاجة لترحيل
 *     بيانات**: كل حساب أدمن قائم دلوقتي بيفضل بكامل صلاحياته بالظبط
 *     زي إمبارح، والـSUPPORT بيبقى قرار صريح لازم حد ياخده.
 */
export function resolveAdminRole(user: AdminRoleSubject | null | undefined): AdminRoleName | null {
  if (!user) return null;
  if (isOwnerEmail(user.email)) return "OWNER";
  if (!user.isAdmin) return null;
  return user.adminRole ?? "OWNER";
}

export function isAdminUser(user: AdminRoleSubject | null | undefined): boolean {
  return resolveAdminRole(user) !== null;
}

export function isOwnerRole(user: AdminRoleSubject | null | undefined): boolean {
  return resolveAdminRole(user) === "OWNER";
}

/**
 * صلاحيات اللوحة، مسمّاة بالقدرة مش بالصفحة.
 *
 * التسمية بالقدرة مقصودة: الصفحة بتتغيّر وتتقسم وتتدمج، والقدرة ("مين
 * يقدر يمسّ فلوس") ثابتة. ربط الصلاحية بالصفحة كان معناه إن تقسيم صفحة
 * لصفحتين يفتح ثغرة صلاحيات بالصدفة.
 */
export type AdminCapability =
  /** عرض قوائم العملاء وصفحة العميل الواحد */
  | "customers.view"
  /** تعليق / رفع تعليق حساب */
  | "customers.suspend"
  /** انتحال هوية عميل (View As) */
  | "customers.impersonate"
  /** تعديل حدود/ميزات/سعر حساب بعينه */
  | "customers.override"
  /** تمديد أو إهداء اشتراك */
  | "customers.subscription"
  /** إرسال رسالة فردية لعميل */
  | "customers.email"
  /** تصدير بيانات العملاء (CSV) */
  | "customers.export"
  /** وسم عميل VIP + ملاحظات داخلية */
  | "customers.annotate"
  /** التحليلات المالية (الإيراد، الباقات، التكلفة) */
  | "analytics.financial"
  /** التحليلات غير المالية (العملاء، المنتج، التشغيل) */
  | "analytics.product"
  /** صحة النظام وأدوات الإصلاح */
  | "system.view"
  /** إعادة مزامنة يدوية - فعل آمن قابل للتكرار */
  | "system.resync"
  /** مفاتيح الميزات العامة */
  | "flags.manage"
  /** إدارة أدوار الفريق */
  | "staff.manage"
  /** سجلّ التدقيق الكامل (كل الأدمنز) */
  | "audit.viewAll"
  /** صندوق الدعم */
  | "support.handle";

const OWNER_CAPS: readonly AdminCapability[] = [
  "customers.view", "customers.suspend", "customers.impersonate", "customers.override",
  "customers.subscription", "customers.email", "customers.export", "customers.annotate",
  "analytics.financial", "analytics.product", "system.view", "system.resync",
  "flags.manage", "staff.manage", "audit.viewAll", "support.handle",
];

// الدعم: يشوف ويساعد ويصلّح، ومايمسّش فلوس ولا صلاحيات ولا مفاتيح عامة.
// التصدير مستثنى عمداً: ملف واحد فيه كل قاعدة العملاء أخطر من مئة فتحة
// صفحة، وهو التسريب اللي بيحصل فعلاً لما موظّف يمشي.
const SUPPORT_CAPS: readonly AdminCapability[] = [
  "customers.view", "customers.suspend", "customers.impersonate", "customers.annotate",
  "analytics.product", "system.view", "system.resync", "support.handle",
];

export function adminCapabilities(role: AdminRoleName | null): readonly AdminCapability[] {
  if (role === "OWNER") return OWNER_CAPS;
  if (role === "SUPPORT") return SUPPORT_CAPS;
  return [];
}

export function can(
  user: AdminRoleSubject | null | undefined,
  capability: AdminCapability
): boolean {
  return adminCapabilities(resolveAdminRole(user)).includes(capability);
}
