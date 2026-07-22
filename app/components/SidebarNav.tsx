"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Megaphone, Tag, ScanSearch, Stethoscope, ListChecks,
  FlaskConical, Bot, FileBarChart, Settings as SettingsIcon, CreditCard,
  ChevronDown, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { NAV_GROUPS, type NavItem } from "@/lib/navConfig";

const ICONS: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, Megaphone, Tag, ScanSearch, Stethoscope, ListChecks,
  FlaskConical, Bot, FileBarChart, SettingsIcon, CreditCard,
};

const COLLAPSE_STORAGE_KEY = "adloop-sidebar-collapsed";

export function SidebarNav({ locale }: { locale: "ar" | "en" }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [manuallyToggled, setManuallyToggled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
  }

  function isItemActiveOrInside(item: NavItem): boolean {
    if (pathname === item.href) return true;
    return item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + "/")) ?? false;
  }

  function isExpanded(item: NavItem): boolean {
    if (!item.children) return false;
    if (isItemActiveOrInside(item)) return manuallyToggled[item.href] !== false;
    return manuallyToggled[item.href] === true;
  }

  return (
    <aside className={`shrink-0 border-e border-border px-3 py-5 transition-[width] duration-200 ${collapsed ? "w-[68px]" : "w-60"}`}>
      <div className={`mb-6 font-mono text-[15px] font-semibold tracking-wide text-text-primary ${collapsed ? "px-1 text-center" : "px-2"}`}>
        {collapsed ? "A" : "AdLoop"}
      </div>

      <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group, i) => (
        <div key={i}>
          {group.label && !collapsed && (
            <div className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-text-faint">
              {group.label}
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.iconName];
              const active = isItemActiveOrInside(item);
              const expanded = isExpanded(item);

              return (
                <div key={item.href}>
                  <div className="flex items-center">
                    <a
                      href={item.href}
                      id={`tour-nav-${item.href.replace(/\//g, "-")}`}
                      title={collapsed ? (locale === "ar" ? item.labelAr : item.labelEn) : undefined}
                      className={`flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] transition-colors ${
                        active ? "bg-surface-raised text-text-primary" : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.75} className="shrink-0 opacity-80" />
                      {!collapsed && <span className="truncate">{locale === "ar" ? item.labelAr : item.labelEn}</span>}
                    </a>
                    {item.children && !collapsed && (
                      <button
                        onClick={() => setManuallyToggled((prev) => ({ ...prev, [item.href]: !expanded }))}
                        className="rounded-md p-1 text-text-faint hover:bg-surface-raised hover:text-text-primary"
                        aria-label={expanded ? "طي" : "توسيع"}
                      >
                        <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-0" : "-rotate-90 rtl:rotate-90"}`} />
                      </button>
                    )}
                  </div>

                  {item.children && !collapsed && expanded && (
                    <div className="me-2 mt-0.5 flex flex-col gap-0.5 border-e border-border ps-3">
                      {item.children.map((child) => (
                        <a
                          key={child.href}
                          href={child.href}
                          className={`rounded-lg px-2.5 py-[6px] text-[12.5px] transition-colors ${
                            pathname === child.href ? "text-text-primary" : "text-text-faint hover:text-text-primary"
                          }`}
                        >
                          {locale === "ar" ? child.labelAr : child.labelEn}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <button
        onClick={toggleCollapse}
        title={collapsed ? "توسيع القائمة" : "طي القائمة"}
        className="mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] text-text-faint transition-colors hover:bg-surface-raised hover:text-text-primary"
      >
        {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.75} /> : <PanelLeftClose size={16} strokeWidth={1.75} />}
        {!collapsed && <span>طي القائمة</span>}
      </button>
      </nav>
    </aside>
  );
}
