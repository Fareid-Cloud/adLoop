"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Megaphone, Tag, ScanSearch, Stethoscope, ListChecks,
  FlaskConical, Bot, FileBarChart, Settings as SettingsIcon, CreditCard,
  ChevronDown, PanelLeftClose, PanelLeftOpen, Search,
} from "lucide-react";
import { NAV_GROUPS, type NavItem } from "@/lib/navConfig";
import { PlatformLogo } from "@/app/components/PlatformLogo";

const ICONS: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, Megaphone, Tag, ScanSearch, Stethoscope, ListChecks,
  FlaskConical, Bot, FileBarChart, SettingsIcon, CreditCard,
};

const COLLAPSE_STORAGE_KEY = "adloop-sidebar-collapsed";

// لون ولوجو المنصة من رابط العنصر الفرعي (Google/Meta/TikTok)
function childPlatform(href: string): string | null {
  if (/google|youtube|pmax|shopping|quality-score|search-terms|match-types|device-geo|display-placements/.test(href)) return "GOOGLE_ADS";
  if (/meta|placements|competitor|content-formats|catalog|learning-phase/.test(href)) return "META_ADS";
  if (/tiktok/.test(href)) return "TIKTOK_ADS";
  return null;
}

export function SidebarNav({ locale }: { locale: "ar" | "en" }) {
  const pathname = usePathname();
  const ar = locale === "ar";
  const [collapsed, setCollapsed] = useState(false);
  const [manuallyToggled, setManuallyToggled] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");

  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
  }

  const label = (o: { labelAr: string; labelEn: string }) => (ar ? o.labelAr : o.labelEn);

  function isItemActiveOrInside(item: NavItem): boolean {
    if (pathname === item.href) return true;
    return item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + "/")) ?? false;
  }
  function isExpanded(item: NavItem): boolean {
    if (!item.children) return false;
    if (isItemActiveOrInside(item)) return manuallyToggled[item.href] !== false;
    return manuallyToggled[item.href] === true;
  }

  // نتائج البحث (مسطّحة) - عنصر أو عنصر فرعي عنوانه بيطابق
  const query = q.trim().toLowerCase();
  const searchResults = query
    ? NAV_GROUPS.flatMap((g) =>
        g.items.flatMap((it) => [
          { href: it.href, text: label(it), platform: null as string | null },
          ...(it.children ?? []).map((c) => ({ href: c.href, text: label(c), platform: childPlatform(c.href) })),
        ])
      ).filter((r) => r.text.toLowerCase().includes(query))
    : [];

  return (
    <aside className={`shrink-0 border-e border-border bg-surface px-3 py-5 transition-[width] duration-200 ${collapsed ? "w-[68px]" : "w-60"}`}>
      {/* الشعار */}
      <a href="/dashboard" className={`mb-5 flex items-center gap-2 no-underline ${collapsed ? "justify-center px-0" : "px-2"}`}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
          <ListChecks size={16} />
        </span>
        {!collapsed && <span className="text-[16px] font-bold tracking-tight text-text-primary">AdLoop</span>}
      </a>

      {/* بحث داخل القائمة */}
      {!collapsed && (
        <div className="relative mb-4">
          <Search size={14} className="absolute inset-y-0 my-auto ms-2.5 text-text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? "بحث..." : "Search..."}
            className="w-full rounded-lg border border-border bg-surface-raised py-1.5 ps-8 pe-2 text-[13px] text-text-primary placeholder:text-text-faint outline-none focus:border-accent"
          />
        </div>
      )}

      <nav className="flex flex-col gap-5">
        {query ? (
          <div className="flex flex-col gap-0.5">
            {searchResults.length === 0 ? (
              <div className="px-2.5 py-2 text-[13px] text-text-faint">{ar ? "لا نتائج" : "No results"}</div>
            ) : (
              searchResults.map((r) => (
                <a key={r.href} href={r.href} className="flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] text-text-muted no-underline transition-colors hover:bg-surface-raised hover:text-text-primary">
                  {r.platform ? <PlatformLogo platform={r.platform} size={15} /> : <Search size={14} className="opacity-60" />}
                  <span className="truncate">{r.text}</span>
                </a>
              ))
            )}
          </div>
        ) : (
          NAV_GROUPS.map((group, i) => (
            <div key={i}>
              {group.label && !collapsed && (
                <div className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-text-faint">{group.label}</div>
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
                          title={collapsed ? label(item) : undefined}
                          className={`flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] no-underline transition-colors ${
                            active ? "bg-accent font-medium text-white shadow-sm" : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
                          }`}
                        >
                          <Icon size={16} strokeWidth={1.9} className="shrink-0" />
                          {!collapsed && <span className="truncate">{label(item)}</span>}
                        </a>
                        {item.children && !collapsed && (
                          <button
                            onClick={() => setManuallyToggled((prev) => ({ ...prev, [item.href]: !expanded }))}
                            className="rounded-md p-1 text-text-faint hover:bg-surface-raised hover:text-text-primary"
                            aria-label={expanded ? (ar ? "طي" : "Collapse") : (ar ? "توسيع" : "Expand")}
                          >
                            <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-0" : "-rotate-90 rtl:rotate-90"}`} />
                          </button>
                        )}
                      </div>

                      {item.children && !collapsed && expanded && (
                        <div className="me-2 mt-0.5 flex flex-col gap-0.5 border-e border-border ps-3">
                          {item.children.map((child) => {
                            const plat = childPlatform(child.href);
                            const activeChild = pathname === child.href;
                            return (
                              <a
                                key={child.href}
                                href={child.href}
                                className={`flex items-center gap-2 rounded-lg px-2.5 py-[6px] text-[12.5px] no-underline transition-colors ${
                                  activeChild ? "bg-accent/12 font-medium text-accent" : "text-text-faint hover:text-text-primary"
                                }`}
                              >
                                {plat && <PlatformLogo platform={plat} size={14} />}
                                <span className="truncate">{label(child)}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        <button
          onClick={toggleCollapse}
          title={collapsed ? (ar ? "توسيع القائمة" : "Expand") : (ar ? "طي القائمة" : "Collapse")}
          className="mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] text-text-faint transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.75} /> : <PanelLeftClose size={16} strokeWidth={1.75} />}
          {!collapsed && <span>{ar ? "طي القائمة" : "Collapse"}</span>}
        </button>
      </nav>
    </aside>
  );
}
