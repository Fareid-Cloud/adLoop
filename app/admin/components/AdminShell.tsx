"use client";

// app/admin/components/AdminShell.tsx
//
// هيكل لوحة المالك: قائمة جانبية + شريط علوي + منطقة المحتوى.
//
// **حالة الطي والـ`<aside>` في نفس المكوّن** - نفس الدرس اللي اتاخد في
// القائمة الجانبية للعميل: فصلهم بيخلّي الطيّ يشتغل بصرياً من غير ما
// الإطار الفعلي يضيق، فالمحتوى بيفضل مزنوق جنب مساحة فاضية.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, LifeBuoy, TrendingUp, CreditCard, Flag,
  Activity, ScrollText, ShieldCheck, PanelLeftClose, PanelLeftOpen,
  ArrowLeft, ShieldAlert, Lock, Bot, Menu, X, Radio, Star, Briefcase, Table2,
} from "lucide-react";
import type { AdminNavGroup } from "@/lib/adminNavConfig";
import { getCsrfHeader } from "@/lib/csrfClient";

const ICONS: Record<string, typeof Users> = {
  LayoutDashboard, Users, LifeBuoy, TrendingUp, CreditCard, Flag, Activity, ScrollText, ShieldCheck,
  Bot, Radio, Star, Briefcase, Table2,
};

export function AdminShell({
  groups,
  ownerName,
  ownerEmail,
  role,
  mode,
  children,
}: {
  groups: AdminNavGroup[];
  ownerName: string;
  ownerEmail: string;
  role: string;
  /** وضعُ العرض من حساب المالك نفسه - راجع التعليق عند `data-mode`. */
  mode: "light" | "dark";
  children: ReactNode;
}) {
  const pathname = usePathname();
  // 🔴 **مطويّة افتراضياً وبتتوسّع عند المرور - إلّا لو اختار هو.**
  //
  // القائمةُ بعرضٍ ثابت بتاخد ٢٤٠ بكسلاً من شاشةٍ فيها أربعةُ أعمدة،
  // فالمحادثةُ بتتضغط بلا داعٍ وهي أهمُّ ما فيها. والطيُّ الدائم بيخلّي
  // التنقّلَ تخميناً بالأيقونات.
  //
  // فالسلوكُ الافتراضيّ: مطويّة، وبتفتح لمّا الماوس يقرب. **وأوّل ما
  // يدوس الزرّ، اختيارُه بيثبت لباقي الجلسة** - قرارٌ صريح بيغلب أيّ
  // ذكاءٍ تلقائيّ، وإلّا القائمةُ بتتحرّك تحت إيده وهو مختار عكس ده.
  const [pinnedChoice, setPinnedChoice] = useState<boolean | null>(null);
  const [hovering, setHovering] = useState(false);
  const collapsed = pinnedChoice ?? !hovering;
  const setCollapsed = (fn: (c: boolean) => boolean) =>
    setPinnedChoice((p) => fn(p ?? !hovering));
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 🔴 **الدرج بيتقفل مع كلّ تنقّل.** من غير ده بتدوس على بند، الصفحة
  // بتتغيّر وراه، والدرج فاضل مغطّيها - فتحسّ إنّ الدوسة ماشتغلتش وتدوس
  // تاني. وربطُه بالمسار لا بحدث الضغط بيغطّي الرجوع بزرار المتصفّح كمان.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const router = useRouter();

  async function lockConsole() {
    // الخادم هو اللي بيمسح الكوكي: هي `httpOnly` فالجافاسكربت مايشوفهاش
    // أصلاً - وده مقصود، ومحاولة مسحها من هنا كانت هتفشل بصمت وتدّي
    // إحساس قفل من غير قفل.
    await fetch("/api/admin/lock", { method: "POST", headers: getCsrfHeader() }).catch(() => {});
    router.replace("/admin-unlock");
    router.refresh();
  }

  return (
    // 🔴 **الوضع بقى من حساب المالك بدل `dark` مثبَّتاً.**
    //
    // كان `data-mode="dark" data-mode-fixed=""` - يعني اللوحة داكنة على
    // طول حتى لو صاحبها شغّال فاتح في كل مكان تاني، وزرار الوضع في
    // الإعدادات مابيلمسهاش. **والهويّة اللي كانت مقصودة من التثبيت لونها
    // الأحمر (`data-accent="red"`) لا الظلمة**، وهو باقٍ زيّ ما هو -
    // فاللوحة بتفضل متميّزة عن حساب العميل في الوضعين.
    <div
      dir="ltr"
      data-accent="red"
      data-mode={mode}
      // بلا `data-mode-fixed`: العلامة دي بتستثني العنصر من زرّ الوضع،
      // وكانت صحيحة لمّا اللوحة كانت مثبَّتة داكنة. دلوقتي هي بتتبع
      // الحساب، فاستثناؤها كان هيمنع التبديل الحيّ عنها وحدها.
      className="flex min-h-screen bg-bg text-text-primary"
    >
      {/* ═══ الموبايل: شريطٌ علويّ ودرجٌ منزلق ═══
          القائمة كانت `<aside>` عاديّة بعرض ٢٤٠px و`shrink-0` جوّه `flex`،
          فعلى شاشة ٣٦٠px بتاخد تلتين العرض ويفضل للمحتوى مئةٌ وعشرون -
          والنتيجة عمودُ نصٍّ بكلمة في السطر. الديسكتوب أوّلاً قرارٌ صحيح،
          لكنّه مش سببٌ لإنّ الصفحة تبقى غير قابلة للقراءة على التليفون. */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      <aside
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={`fixed inset-y-0 start-0 z-50 flex h-screen w-64 shrink-0 flex-col border-e border-border bg-surface transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 lg:transition-[width] ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-16" : "lg:w-60"}`}
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
            className="hidden w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-text-faint transition-colors hover:bg-surface-raised hover:text-text-primary lg:flex"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && <span>Collapse</span>}
          </button>
          {/* قفل يدويّ: القفل بينتهي لوحده بعد ساعة، لكن "أنا ماشي من على
              المكتب دلوقتي" لحظة بيعرفها صاحبها هو - وانتظار انتهاء المهلة
              وقتها هو بالظبط الفجوة اللي القفل موجود عشانها. */}
          <button
            type="button"
            onClick={lockConsole}
            title="Lock the console"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-text-faint transition-colors hover:bg-critical/10 hover:text-critical"
          >
            <Lock size={16} />
            {!collapsed && <span>Lock console</span>}
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

      <div className="flex min-w-0 flex-1 flex-col">
        {/* الشريط ده هو المدخل الوحيد للقائمة تحت lg، فبيفضل لاصقاً:
            صفحةٌ طويلة والقائمة فوقها بعيد معناها رجوعٌ للأعلى قبل كلّ
            تنقّل. */}
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            className="btn-icon"
          >
            {drawerOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-critical/15 text-critical">
            <ShieldAlert size={15} />
          </span>
          <span className="truncate text-[13px] font-semibold">AdLoop</span>
          <span className="ms-auto shrink-0 rounded bg-critical/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-critical">
            {role}
          </span>
        </div>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
