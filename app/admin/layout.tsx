// app/admin/layout.tsx
//
// بوابة وصول - بس المستخدم اللي isAdmin=true (انت، صاحب المنتج) يقدر
// يشوف القسم ده. مش جزء من لوحة تحكم العميل العادي خالص.

import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUserFromCookies();

  if (!user || !user.isAdmin) {
    redirect("/dashboard");
  }

  return (
    <div dir="rtl" data-accent="red" data-mode="dark" className="min-h-screen bg-bg px-8 py-7">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-critical/15 px-3 py-1 text-xs font-medium text-critical">
              لوحة المالك
            </span>
            <span className="text-xs text-text-faint">مش جزء من واجهة العميل العادية</span>
          </div>
          <a href="/dashboard" className="text-xs text-text-muted no-underline hover:text-text-primary">
            ← الرجوع للوحة العادية
          </a>
        </div>
        {children}
      </div>
    </div>
  );
}
