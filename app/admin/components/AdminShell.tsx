"use client";

// app/admin/components/AdminShell.tsx
//
// هيكل لوحة المالك: قائمة جانبية + شريط علوي + منطقة المحتوى.
//
// **حالة الطي والـ`<aside>` في نفس المكوّن** - نفس الدرس اللي اتاخد في
// القائمة الجانبية للعميل: فصلهم بيخلّي الطيّ يشتغل بصرياً من غير ما
// الإطار الفعلي يضيق، فالمحتوى بيفضل مزنوق جنب مساحة فاضية.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, LifeBuoy, TrendingUp, CreditCard, Flag,
  Activity, ScrollText, ShieldCheck, PanelLeftClose, PanelLeftOpen,
  ArrowLeft, ShieldAlert,
} from "lucide-react";
import type { AdminNavGroup } from "@/lib/adminNavConfig";

const ICONS: Record<string, typeof Users> = {
  LayoutDashboard, Users, LifeBuoy, TrendingUp, CreditCard, Flag, Activity, ScrollText, ShieldCheck,
};

export function AdminShell({
  groups,
  ownerName,
  ownerEmail,
  role,
  children,
}: {
  groups: AdminNavGroup[];
  ownerName: string;
  ownerEmail: string;
  role: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div dir="ltr" data-accent="red" data-mode="dark" data-mode-fixed="" className="flex min-h-screen bg-bg text-text-primary">
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col border-e border-border bg-surface transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-critical/15 text-critical">
            <ShieldAlert size={17} />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight">AdLoop</div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-critical">Owner panel</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          {groups.map((group, gi) => (
            <div key={group.label ?? `g${gi}`} className="mb-3">
              {group.label && !collapsed && (
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = ICONS[item.iconName] ?? LayoutDashboard;
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] no-underline transition-colors ${
                      active
                        ? "bg-critical/12 font-medium text-critical"
                        : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-border px-2 py-2">
          <Link
            href="/dashboard"
            className="mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-text-muted no-underline transition-colors hover:bg-surface-raised hover:text-text-primary"
            title={collapsed ? "Back to dashboard" : undefined}
          >
            <ArrowLeft size={16} className="shrink-0" />
            {!collapsed && <span>Back to dashboard</span>}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-text-faint transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && <span>Collapse</span>}
          </button>
          {!collapsed && (
            <div className="mt-1 rounded-lg bg-surface-raised px-3 py-2">
              <div className="truncate text-[12px] font-medium">{ownerName}</div>
              <div className="truncate text-[10px] text-text-faint">{ownerEmail}</div>
              <div className="mt-1 inline-block rounded bg-critical/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-critical">
                {role}
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">{children}</main>
    </div>
  );
}
