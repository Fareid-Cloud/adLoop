"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Megaphone, Tag, ScanSearch, Stethoscope, ListChecks,
  FlaskConical, Bot, FileBarChart, Settings as SettingsIcon, CreditCard,
  ChevronDown, PanelLeftClose, PanelLeftOpen, Search,
} from "lucide-react";
import * as Icons from "lucide-react";
import { NAV_GROUPS, type NavItem } from "@/lib/navConfig";
import { PlatformLogo } from "@/app/components/PlatformLogo";

// 🔴 سبب عطل إنتاج حقيقي: كانت هذه خريطة يدوية بأحد عشر اسماً فقط. أي
// عنصر تنقّل بأيقونة خارجها كان يُرجع undefined، فيُرمى React error #130
// ("نوع العنصر غير صالح") — ولأن هذه القائمة تُعرض داخل layout اللوحة،
// كان الخطأ يُسقط **كل** صفحات البرنامج دفعة واحدة، لا الأيقونة وحدها.
//
// الحل من شقين: القراءة من مكتبة الأيقونات كاملةً، **وبديل مضمون** عند
// أي اسم غير معروف - فلا يمكن لخطأ إملائي في اسم أيقونة أن يُسقط التطبيق.
function resolveIcon(name: string): typeof LayoutDashboard {
  const found = (Icons as unknown as Record<string, typeof LayoutDashboard>)[name];
  return found ?? Icons.Circle;
}

const COLLAPSE_STORAGE_KEY = "adloop-sidebar-collapsed";

// لون ولوجو المنصة من رابط العنصر الفرعي (Google/Meta/TikTok)
function childPlatform(href: string): string | null {
  if (/google|youtube|pmax|shopping|quality-score|search-terms|match-types|device-geo|display-placements/.test(href)) return "GOOGLE_ADS";
  if (/meta|placements|competitor|content-formats|catalog|learning-phase/.test(href)) return "META_ADS";
  if (/tiktok/.test(href)) return "TIKTOK_ADS";
  return null;
}

export function SidebarNav({
  locale,
  supportSlot,
  workspaceSlot,
  badges = {},
}: {
  locale: "ar" | "en";
  supportSlot?: React.ReactNode;
  workspaceSlot?: React.ReactNode;
  /** عدد ما ينتظر المستخدم في كل قسم، مفتاحه مسار القسم */
  badges?: Record<string, number>;
}) {
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
    <aside
      // ثابت مع التمرير: القائمة نفسها لا تتحرك، والتنقّل يحدث داخلها
      className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-e border-border bg-surface transition-[width] duration-200 ${collapsed ? "w-[68px]" : "w-60"}`}
    >
      {/* صفّ الشعار بارتفاع رأس الصفحة نفسه (SHELL_HEADER_H) وبنفس الحدّ
          السفلي، فيمتدّ الخطّان كخطّ واحد عبر الشاشة. كان ارتفاع هذا الصفّ
          حرّاً يتبع محتواه، فينكسر الخطّ عند الحدّ بين العمودين. */}
      <div className="flex h-[68px] shrink-0 items-center border-b border-border px-3">
        <a
          href="/dashboard"
          className={`flex w-full items-center gap-2 no-underline ${collapsed ? "justify-center px-0" : "px-2"}`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
            <ListChecks size={16} />
          </span>
          {!collapsed && (
            <span className="text-[16px] font-bold tracking-tight text-text-primary">AdLoop</span>
          )}
        </a>
      </div>

      {/* البحث خارج منطقة التمرير: `shrink-0` داخل عمود `h-screen` يعني أنه
          لا يتقلّص ولا يتمرّر مهما طالت القائمة تحته - وهو ما كان يجعله
          يختفي عند الوصول لآخر الصفحة. */}
      {!collapsed && (
        <div className="shrink-0 border-b border-border/60 px-3 py-3">
          <div className="relative">
            <Search size={14} className="absolute inset-y-0 my-auto ms-2.5 text-text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? "بحث..." : "Search..."}
              className="w-full rounded-lg border border-border bg-surface-raised py-1.5 ps-8 pe-2 text-[13px] text-text-primary placeholder:text-text-faint outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

      <nav className="no-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
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
              {(ar ? group.labelAr : group.labelEn) && !collapsed && (
                <div className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-text-faint">
                  {ar ? group.labelAr : group.labelEn}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = resolveIcon(item.iconName);
                  const active = isItemActiveOrInside(item);
                  const expanded = isExpanded(item);
                  return (
                    <div key={item.href}>
                      <div className="flex items-center">
                        <a
                          href={item.href}
                          id={`tour-nav-${item.href.replace(/\//g, "-")}`}
                          title={collapsed ? label(item) : undefined}
                          className={`relative flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] no-underline transition-colors ${
                            active ? "bg-accent font-medium text-white shadow-sm" : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
                          }`}
                        >
                          <Icon size={16} strokeWidth={1.9} className="shrink-0" />
                          {!collapsed && <span className="truncate">{label(item)}</span>}
                          {/* علامة AI على ما يستدعي نموذجاً لغوياً فعلاً -
                              فيعرف المستخدم أين يُستهلك رصيده الشهري */}
                          {!collapsed && item.usesAi && (
                            <span
                              className={`shrink-0 rounded px-1 py-px font-mono text-[9px] font-bold tracking-wide ${
                                active ? "bg-white/25 text-white" : "bg-accent/15 text-accent"
                              }`}
                            >
                              AI
                            </span>
                          )}
                          {/* العدّاد على القسم نفسه: بدونه لا شيء يقول أن
                              هناك ما ينتظر، فلا يُفتح القسم أصلاً. يُخفى
                              عند طيّ القائمة لأن النقطة الملوّنة تكفي. */}
                          {badges[item.href] ? (
                            collapsed ? (
                              <span className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-critical" />
                            ) : (
                              <span
                                className={`ms-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 font-mono text-[10.5px] font-semibold ${
                                  active ? "bg-white/25 text-white" : "bg-accent/15 text-accent"
                                }`}
                              >
                                {badges[item.href] > 99 ? "99+" : badges[item.href]}
                              </span>
                            )
                          ) : null}
                        </a>
                        {item.children && !collapsed && (
                          <button
                            onClick={() => setManuallyToggled((prev) => ({ ...prev, [item.href]: !expanded }))}
                            // بلا خلفية عند المرور: المربّع الرمادي خلف
                            // السهم يقرأ كعنصر ثانٍ منفصل عن القسم، فيبدو
                            // كأنه زرّ آخر. اللون وحده يكفي إشارةً.
                            className="p-1 text-text-faint transition-colors hover:text-accent"
                            aria-label={expanded ? (ar ? "طي" : "Collapse") : (ar ? "توسيع" : "Expand")}
                          >
                            <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-0" : "-rotate-90 rtl:rotate-90"}`} />
                          </button>
                        )}
                      </div>

                      {item.children && !collapsed && expanded && (
                        <div className="me-2 mt-0.5 flex flex-col gap-0.5 border-e border-border ps-3">
                          {item.children.map((child) => {
                            // الصفحات الداخلية للمنصة تظهر فقط عند التواجد
                            // داخل تلك المنصة - وإلا امتلأت القائمة بعشرات
                            // الروابط غير المتعلقة بما يشاهده المستخدم الآن.
                            if (child.nested) {
                              const insidePlatform = item.children!.some(
                                (c) => !c.nested && c.platform === child.platform && pathname.startsWith(c.href)
                              ) || pathname === child.href;
                              if (!insidePlatform) return null;
                            }

                            const plat = child.platform ?? childPlatform(child.href);
                            const activeChild = pathname === child.href;
                            return (
                              <a
                                key={child.href}
                                href={child.href}
                                className={`flex items-center gap-2 rounded-lg px-2.5 py-[6px] text-[12.5px] no-underline transition-colors ${
                                  child.nested ? "ms-3.5" : ""
                                } ${
                                  activeChild ? "bg-accent/12 font-medium text-accent" : "text-text-faint hover:text-text-primary"
                                }`}
                              >
                                {!child.nested && plat && <PlatformLogo platform={plat} size={14} />}
                                {child.nested && <span className="h-1 w-1 shrink-0 rounded-full bg-text-faint" />}
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

        {/* مبدّل مساحات العمل - عنصر أساسي أسفل القائمة */}
        {workspaceSlot && <div className="border-t border-border pt-3">{workspaceSlot}</div>}

        {/* الدعم الفني كعنصر في القائمة (بدل الزر العائم) */}
        {supportSlot && !collapsed && <div className="border-t border-border pt-3">{supportSlot}</div>}

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
