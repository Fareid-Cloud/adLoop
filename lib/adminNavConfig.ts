// lib/adminNavConfig.ts
//
// بنية تنقّل لوحة المالك - **منفصلة عن `lib/navConfig.ts` عمداً.**
//
// الفصل مش تكرار: قائمة العميل ثنائية اللغة وبتتوسّع حسب المنصّات
// المربوطة وحدود الباقة، وقائمة المالك إنجليزية ثابتة وبتتفلتر بالدور
// بس. دمجهم كان معناه إن كل حقل من الاتنين يبقى اختياري في النوع
// المشترك، وأول نتيجة لكده إن حاجة زي `platform` تبقى ليها معنى في
// لوحة المالك وهي مالهاش.
//
// إنجليزي فقط بقرار صريح من المالك - راجع التعليق في `app/admin/layout.tsx`.

import type { AdminCapability } from "@/lib/adminRole";

export interface AdminNavItem {
  href: string;
  label: string;
  /** اسم أيقونة lucide - نص مش مكوّن، عشان الملف يفضل قابل للاستيراد
   *  من مكوّن خادم من غير ما يجرّ المكتبة كلها معاه */
  iconName: string;
  /** القدرة اللي بتفتح البند. غيابها = مرئي لأي أدمن */
  capability?: AdminCapability;
  /** مطابقة المسار بالضبط - للرئيسية اللي prefix بتاعها بيطابق كل حاجة */
  exact?: boolean;
}

export interface AdminNavGroup {
  label: string | null;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: null,
    items: [{ href: "/admin", label: "Overview", iconName: "LayoutDashboard", exact: true }],
  },
  {
    label: "Customers",
    items: [
      { href: "/admin/customers", label: "Customers", iconName: "Users", capability: "customers.view" },
      // `exact` عشان `/admin/support/quality` مايولّعش البندين مع بعض -
      // بندان مضيّئان في نفس اللحظة بيخلّوا القائمة تكدب عن مكانك.
      { href: "/admin/support", label: "Support", iconName: "LifeBuoy", capability: "support.handle", exact: true },
      // جودةُ الخدمة تحت الدعم مباشرةً: السؤال بيتسأل وإنت في الصندوق.
      // وصلاحيتُها `analytics.product` لا `support.handle` - فيها مقارنةُ
      // موظّفين ببعض، وده قرارُ إدارةٍ لا شغلُ صندوق.
      { href: "/admin/support/quality", label: "Service quality", iconName: "Star", capability: "analytics.product" },
      // تحت "العملاء" لا "الرؤى": ده نصُّ محادثاتِ عملاء، لا إحصاء.
      { href: "/admin/agent", label: "Agent review", iconName: "Bot", capability: "agent.review" },
    ],
  },
  {
    label: "Revenue",
    items: [
      // طابورُ المبيعات مش تحت «العملاء»: صاحبُه غالباً **مش عميلاً بعد** -
      // ودي كلُّ النقطة.
      { href: "/admin/sales", label: "Sales enquiries", iconName: "Briefcase", capability: "customers.subscription" },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/admin/analytics", label: "Analytics", iconName: "TrendingUp", capability: "analytics.product" },
      // الكتالوج - وأداؤها تبويب جوّه Analytics. الاسمان مختلفان عن قصد.
      { href: "/admin/plans", label: "Plan catalogue", iconName: "CreditCard" },
    ],
  },
  {
    label: "Control",
    items: [
      { href: "/admin/channels", label: "Channels", iconName: "Radio", capability: "flags.manage" },
      { href: "/admin/flags", label: "Feature Flags", iconName: "Flag", capability: "flags.manage" },
      { href: "/admin/system", label: "System Health", iconName: "Activity", capability: "system.view" },
    ],
  },
  {
    label: "Governance",
    items: [
      // تحت الحوكمة لا الإيراد: الرابط الواحد يخرج بقاعدة العملاء كلّها،
      // فهو قرارُ وصولٍ قبل أن يكون أداةَ تقارير.
      { href: "/admin/sheets", label: "Sheet feeds", iconName: "Table2", capability: "customers.export" },
      { href: "/admin/audit", label: "Audit Log", iconName: "ScrollText" },
      { href: "/admin/staff", label: "Staff", iconName: "ShieldCheck", capability: "staff.manage" },
    ],
  },
];

/** القائمة كما يراها دور بعينه - البند المحجوب بيختفي، ومسار الـAPI
 *  بيرفض بـ403 بشكل مستقلّ. الاتنين مطلوبين: إخفاء بلا رفض ديكور. */
export function adminNavFor(caps: readonly AdminCapability[]): AdminNavGroup[] {
  return ADMIN_NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.capability || caps.includes(i.capability)) }))
    .filter((g) => g.items.length > 0);
}
