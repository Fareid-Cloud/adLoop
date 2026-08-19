// app/admin/layout.tsx
//
// بوابة الوصول للوحة المالك - ثلاث بوابات متتالية قبل ما أي صفحة تتحمّل:
// جلسة، دور إداري، وتحقّق بخطوتين مفعّل.
//
// **اللوحة إنجليزية بالكامل** بقرار صريح من المالك، عكس قرار سابق كان
// بيخلّيها عربية. الاختلاط بين اللغتين أسوأ من أي منهما لوحدها، فالتحويل
// شمل النصوص القديمة مش الجديدة بس. ومش بتتبع `preferredLocale` بتاع
// الحساب: دي سطح تشغيل داخلي، مش واجهة عميل.

import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import type { ReactNode } from "react";
import { resolveAdminRole, adminCapabilities } from "@/lib/adminRole";
import { adminNavFor } from "@/lib/adminNavConfig";
import { AdminShell } from "./components/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUserFromCookies();

  // التمييز بين الحالتين مقصود: من ليس مسجّلاً يحتاج تسجيل دخول (ويعود
  // إلى هنا بعده)، ومن هو مسجّل لكنه ليس المالك لا يحتاج نموذج دخول - هو
  // في المكان الخطأ ببساطة.
  if (!user) redirect("/login?next=/admin");

  // الدور بيتحسم من مكان واحد (lib/adminRole.ts): بريد المالك، أو الحقل
  // الصريح، أو isAdmin بلا دور → OWNER. الفحص هنا مش نسخة من المنطق ده.
  const role = resolveAdminRole(user);
  if (!role) redirect("/dashboard");

  // أدمن معلَّق مايدخلش لوحته - نفس فحص `guardAdmin` بالظبط، بس على
  // مستوى الصفحة كمان: إخفاء الواجهة بلا رفض الـAPI (أو العكس) نصّ حماية.
  if (user.isSuspended) redirect("/dashboard");

  // 🔴 التحقّق بخطوتين إجباري للوصول للوحة المالك - مش اختياري زي باقي
  // الحسابات. اللوحة دي بتقدر توقف/تمدّد/تسعّر أي حساب في المنتج، فكلمة
  // سر وحدها مش كافية لحمايتها. حساب أدمن من غير MFA بيتوجّه لتفعيله
  // الأول، مش بيدخل صامتاً.
  if (!user.mfaEnabled) {
    redirect("/dashboard/settings?tab=security&mfaRequired=1");
  }

  return (
    <AdminShell
      groups={adminNavFor(adminCapabilities(role))}
      ownerName={user.name ?? user.email.split("@")[0]}
      ownerEmail={user.email}
      role={role}
    >
      {children}
    </AdminShell>
  );
}
