"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  // `LayoutDashboard` مستوردة كنوعٍ فقط (توقيع `resolveIcon`). بقيّة الأسماء
  // هنا مستعملة في JSX - ما عداها كان بقايا خريطة الأيقونات اليدوية القديمة.
  LayoutDashboard,
  ChevronDown, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  ChevronsDown, PlayCircle,
} from "lucide-react";
import * as Icons from "lucide-react";
import { NAV_GROUPS, navItemId, type NavItem } from "@/lib/navConfig";
import { BrandMark } from "@/app/components/BrandMark";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { t, type Locale } from "@/lib/i18n/dictionary";

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
  brandSlot,
  badges = {},
  storeCount = 0,
}: {
  locale: "ar" | "en";
  supportSlot?: React.ReactNode;
  workspaceSlot?: React.ReactNode;
  /** شارة بجانب الشعار - شارة العرض التجريبيّ اليوم. كانت في رأس الصفحة
   *  فتزاحم البحث واسم المستخدم على عرض الهاتف الضيّق. */
  brandSlot?: React.ReactNode;
  /** عدد ما ينتظر المستخدم في كل قسم، مفتاحه مسار القسم */
  badges?: Record<string, number>;
  /**
   * عدد قنوات البيع المربوطة بالمساحة الحالية.
   *
   * صفحة المقارنة بقناةٍ واحدة تعرض نفسها فارغةً وتشرح أنّها لا تعمل،
   * ورابطٌ دائمٌ إلى لا شيء يعلّم المستخدم تجاهل القائمة. فتظهر حين
   * يصير لها ما تقارنه.
   */
  storeCount?: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // الإغلاق عند تغيّر المسار: بدونه يبقى الدرج مفتوحاً فوق الصفحة التي
  // انتقل إليها المستخدم للتوّ، فيبدو أنّ النقر لم يفعل شيئاً.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // زرّ الفتح يعيش في رأس الصفحة (مكوّن آخر)، فيتواصلان بحدث على النافذة
  // بدل رفع الحالة إلى تخطيط خادم لا يملك حالة أصلاً.
  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener("adloop:open-nav", open);
    return () => window.removeEventListener("adloop:open-nav", open);
  }, []);

  // منع تمرير الصفحة خلف الدرج المفتوح
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);
  const ar = locale === "ar";
  const [collapsed, setCollapsed] = useState(false);
  const [manuallyToggled, setManuallyToggled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
  }

  const label = (o: { labelAr: string; labelEn: string }) => (ar ? o.labelAr : o.labelEn);

  // أيقونة الطيّ تتبع جهة الشريط لا لغةً بعينها: في العربية هو على اليمين،
  // فأيقونة «لوحة يسرى» تشير إلى الجهة الخطأ وتقرأ عكس ما يفعله الزرّ.
  const CollapseIcon = ar
    ? collapsed ? PanelRightOpen : PanelRightClose
    : collapsed ? PanelLeftOpen : PanelLeftClose;

  // ── «فيه أسفلُ هذا» ────────────────────────────────────────────
  //
  // القائمة أطول من الشاشة على أغلب الارتفاعات، وحافّتُها السفلية تنتهي
  // نظيفةً فتُقرأ **نهايةً** لا انقطاعاً - فلا يمرّر أحدٌ ولا يعرف أنّ تحتها
  // أقساماً. والمؤشّر يظهر حين يكون ثمّة ما يُرى فعلاً، ويختفي عند الوصول:
  // علامةٌ دائمة تصير جزءاً من الأثاث ويكفّ النظر عن قراءتها.
  const navRef = useRef<HTMLElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  function measureMore() {
    const el = navRef.current;
    if (!el) return;
    // هامشُ بكسلين: التمرير الكسريّ على الشاشات عالية الكثافة لا يبلغ
    // القاع تماماً، فيبقى المؤشّر ظاهراً وقد وصل القارئ آخرَها.
    setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }

  useEffect(() => {
    measureMore();
    const el = navRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // الارتفاع يتغيّر بلا تمرير: طيُّ الشريط، وفتحُ قسمٍ بأبناء، وتبدّلُ
    // ارتفاع النافذة. المراقب يرى ذلك كلَّه بلا مستمعٍ لكلّ حالة.
    const ro = new ResizeObserver(measureMore);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, manuallyToggled, pathname]);

  function scrollToEnd() {
    navRef.current?.scrollTo({ top: navRef.current.scrollHeight, behavior: "smooth" });
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
    <>
      {/* ظلّ خلف الدرج على الموبايل. النقر عليه يغلقه - وهو ما يفعله
          المستخدم غريزياً قبل أن يبحث عن زرّ إغلاق. */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-hidden
        />
      )}

    {/* فاصلة تحجز عرض الشريط في التدفّق.
        الشريط `fixed` على سطح المكتب فلا يزيح شيئاً، وبلا هذه الفاصلة يقف
        فوق المحتوى ويغطّي أوّل ٢٤٠ بكسل من كلّ صفحة.
        **عرضها من `collapsed` نفسها** التي يقرؤها الشريط - لا من محدّد CSS
        يستنتجها. المصدر واحد، فيستحيل أن يفترق العرضان. */}
    <div
      aria-hidden
      className={`hidden shrink-0 transition-[width] duration-200 lg:block ${
        collapsed ? "w-[68px]" : "w-60"
      }`}
    />

    <aside
      // ثابت مع التمرير: القائمة نفسها لا تتحرك، والتنقّل يحدث داخلها.
      //
      // على الموبايل درج منزلق فوق المحتوى لا عمود بجانبه: عرض 240px من
      // شاشة 375px يعني ثلثي الشاشة للقائمة وثلثاً للمنتج - وهو ما كان
      // يجعل اللوحة غير صالحة للاستخدام على الهاتف أصلاً.
      // الموضع والعرض والطبقة كلّها في `.nav-drawer` بـ`theme.css` - لا هنا.
      //
      // **ولا `sticky` في هذا السطر:** كانت مكتوبةً هنا وهي **لا تعمل
      // أصلاً**، لأن `theme.css` خارج طبقات Tailwind فتغلب قواعدُه أدواتِها.
      // صنفٌ لا أثر له في سطرٍ يقرؤه الناس ليفهموا سلوك العنصر أسوأ من
      // غيابه: كلّفنا هذا الالتباسُ نفسه بحثاً في عطلين مختلفين.
      className={`nav-drawer flex h-[100dvh] shrink-0 flex-col overflow-hidden border-e border-border bg-surface ${
        mobileOpen ? "is-open" : ""
      } ${collapsed ? "is-collapsed" : ""}`}
    >
      {/* صفّ الشعار بارتفاع رأس الصفحة نفسه (SHELL_HEADER_H) وبنفس الحدّ
          السفلي، فيمتدّ الخطّان كخطّ واحد عبر الشاشة. كان ارتفاع هذا الصفّ
          حرّاً يتبع محتواه، فينكسر الخطّ عند الحدّ بين العمودين. */}
      <div className="flex h-[68px] shrink-0 items-center gap-2 border-b border-border px-3">
        <a
          href="/dashboard"
          className={`flex min-w-0 items-center gap-2 no-underline ${collapsed ? "w-full justify-center px-0" : "px-2"}`}
        >
          {/* الشعار من `public/` لا مرسوماً بالكود: كان مربّعاً أزرق بأيقونة
              قائمة مهامّ لا علاقة لها بالعلامة، بينما ملفّ الشعار الحقيقيّ
              موجود ولا يستعمله شيء - فتعديله لا يظهر. راجع `BrandMark`. */}
          <BrandMark size={28} />
          {!collapsed && (
            <span className="text-[16px] font-bold tracking-tight text-text-primary">AdLoop</span>
          )}
        </a>
        {/* موضع الشارة هنا لا في الرأس: صفّ الشعار فيه متّسع دائماً، ورأس
            الهاتف لا يتّسع. وهي بجانب اسم المنتج فتُقرأ كوصفٍ للمساحة
            المفتوحة - وهو ما تعنيه فعلاً. */}
        {brandSlot && !collapsed && <div className="ms-auto shrink-0">{brandSlot}</div>}
      </div>

      {/* 🔴 **حقل بحثٍ ثانٍ أُزيل من هنا.** كان يبحث في المصدر نفسه الذي
          يبحث فيه حقلُ الرأس بعد توحيدهما، فصار يعطي النتيجة نفسها في
          مكانين - وحقلان يجيبان جواباً واحداً ليسا خياراً بل تردّداً:
          يسأل القارئ أيّهما «البحث الحقيقيّ». */}
      <nav
        ref={navRef}
        onScroll={measureMore}
        // 🔴 `pb-11` لا `py-4`: المؤشّر يطفو فوق آخر القائمة، فبلا مساحةٍ
        // محجوزةٍ له يقف على عنصرٍ حقيقيّ ويبتلع دوسته - قِيس على الصفحة
        // الحيّة فوجِد فوق رابط «MCP» بالضبط، فالنقر يمرّر بدل أن يفتح.
        //
        // والحشوة ثابتةٌ لا مشروطةٌ بظهوره: لو تغيّرت بظهوره لغيّرت ارتفاع
        // المحتوى، فأعادت قياسه، فأظهرته أو أخفته - حلقةٌ تهتزّ عند الحدّ.
        className="no-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-3 pt-4 pb-11"
      >
        {NAV_GROUPS.map((group, i) => (
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
                          id={navItemId(item.href)}
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
                            aria-label={expanded ? t(locale, "sidebar.collapseSection") : t(locale, "sidebar.expandSection")}
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
                            // لا تظهر إلّا حين يوجد ما يُقارَن فعلاً.
                            if (child.needsTwoStores && storeCount < 2) return null;

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
                                {/* أداء الفيديو مربوطٌ بيوتيوب ولا شعار له في
                                    `PlatformLogo`، فيأخذ أيقونتها مباشرةً بدل
                                    أن يبقى الرابط الوحيد بلا علامة. */}
                                {!child.nested && child.href.endsWith("/video-performance") ? (
                                  <PlayCircle size={14} className="shrink-0 text-critical" />
                                ) : !child.nested && plat ? (
                                  <PlatformLogo platform={plat} size={14} />
                                ) : null}
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
        ))}

        {/* مبدّل مساحات العمل - عنصر أساسي أسفل القائمة */}
        {/* 🔴 كان يُصيَّر في حالة الطيّ أيضاً بينما `supportSlot` تحته يحترمها:
            مبدّلٌ بعرضه الكامل داخل شريط عرضه ٦٨ بكسل يفيض خارج حدّه ويطفو
            على المحتوى. الشقّان زرّان عريضان بنصّ، فحكمهما واحد. */}
        {workspaceSlot && !collapsed && (
          <div className="border-t border-border pt-3">{workspaceSlot}</div>
        )}

        {/* الدعم الفني كعنصر في القائمة (بدل الزر العائم) */}
        {supportSlot && !collapsed && <div className="border-t border-border pt-3">{supportSlot}</div>}

        {/* 🔴 نفس فخّ `.btn` الذي تكرّر في المنتج: حشوتها الأفقية ١٫١٥rem
            (٣٧ بكسل للجانبين) داخل شريط مطويّ عرضه ٦٨ ناقص حشوته ٢٤ = ٤٤
            بكسل متاحة، فتُسحق الأيقونة وتُقصّ. `btn-icon` تصفّر الحشوة وتثبّت
            المربّع - وهي الحالة التي وُضعت لها في نظام التصميم. */}
        <button
          onClick={toggleCollapse}
          title={t(locale, collapsed ? "sidebar.expandMenu" : "sidebar.collapseMenu")}
          aria-label={t(locale, collapsed ? "sidebar.expandMenu" : "sidebar.collapseMenu")}
          className={`btn btn-secondary mt-2 text-text-faint ${collapsed ? "btn-icon mx-auto" : "py-[7px]"}`}
        >
          <CollapseIcon size={16} strokeWidth={1.75} />
          {!collapsed && <span>{t(locale, "sidebar.collapseMenu")}</span>}
        </button>
      </nav>

      {/* مؤشّر «تحته المزيد».
          تدرّجٌ يذوب فيه آخرُ سطرٍ بدل أن يُقصّ نظيفاً - الحافّة النظيفة
          تُقرأ نهايةً، والذائبة تُقرأ استمراراً. والسهم فوقه هو الفعل:
          صغيرٌ وهادئ، ولا يزاحم عنصراً في القائمة. */}
      {moreBelow && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-2">
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface via-surface/85 to-transparent" />
          <button
            type="button"
            onClick={scrollToEnd}
            aria-label={t(locale, "sidebar.moreBelow")}
            title={t(locale, "sidebar.moreBelow")}
            className="pointer-events-auto relative flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-raised text-text-faint shadow-sm transition-colors hover:border-accent hover:text-accent"
          >
            <ChevronsDown size={13} strokeWidth={2} />
          </button>
        </div>
      )}
    </aside>
    </>
  );
}
