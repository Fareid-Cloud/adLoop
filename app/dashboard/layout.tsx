// app/dashboard/layout.tsx
//
// القشرة الأساسية للداشبورد - نافيجيشن بـ 6 أقسام مبنية على "الهدف" مش
// "المصدر" (زي ما اتفقنا: مفيش صفحة منفصلة لكل منصة، المنصة فلتر جوه
// كل صفحة، مش تقسيم أساسي).

// theme.css بقى بيتحمّل من app/layout.tsx (الجذري) مش هنا - عشان يوصل
// لكل صفحة في المنتج (تسجيل الدخول، التسجيل، إلخ)، مش الداشبورد بس
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { SupportChat } from "@/app/components/SupportChat";
import { ImpersonationBanner } from "@/app/components/ImpersonationBanner";
import { NotificationBell } from "@/app/components/NotificationBell";
import { NotificationToast } from "@/app/components/NotificationToast";
import { WelcomeGate } from "@/app/components/WelcomeGate";
import { AccountMenu } from "@/app/components/AccountMenu";
import { TopSearch } from "@/app/components/TopSearch";
import { LiveDataProvider } from "@/app/components/LiveData";
import { HelpButton } from "@/app/components/HelpButton";
import { AiCreditBadge } from "@/app/components/AiCreditBadge";
import { MONTHLY_LIMIT } from "@/lib/aiRateLimit";
import { SidebarNav } from "@/app/components/SidebarNav";
import { WorkspaceSwitcher } from "@/app/components/WorkspaceSwitcher";
import { getEntitlements } from "@/lib/entitlements";
import { TrialBar } from "@/app/components/TrialBar";
// next/font/google بيحمّل ملف الخط فعلياً وقت الـ build ويربطه بمتغير CSS -
// ده الفرق عن مجرد كتابة اسم الخط في font-family من غير ما يكون مستورد
// فعلياً (المشكلة اللي حصلت في المعاينة السابقة)
const display = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// خط الأرقام: Inter بأرقام جدولية (tabular figures) بدل خط برمجي.
// السبب: IBM Plex Mono خط شيفرة - حروفه عريضة وميكانيكية، فتبدو المبالغ
// المالية كأنها مخرجات طرفية لا أرقام منتج. Inter يعطي أرقاماً متساوية
// العرض (تصطفّ رأسياً في الجداول) بمظهر تحريري نظيف.
const numeric = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono-code",
  display: "swap",
});


export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const isImpersonating = !!cookieStore.get("impersonating_by")?.value;
  // إصلاح باگ حقيقي: كانت القيم دي ثابتة بالكود، يعني لو المستخدم غيّر
  // تفضيلاته (لغة/لون/وضع) من الإعدادات، التغيير ماكانش بيظهر في الواجهة
  // خالص - كانت شغالة بالصدفة لأن القيم الافتراضية (عربي/أزرق/غامق)
  // بتتطابق مع القيم الثابتة، فمحدش لاحظ إلا لو غيّر تفضيلاته فعلياً
  const user = await getSessionUserFromCookies();
  const locale: "ar" | "en" = (user?.preferredLocale as "ar" | "en") ?? "ar";
  const accent = user?.themeColor ?? "blue";
  const mode = user?.themeMode ?? "light";

  // تسجيل "آخر نشاط فعلي" - أساس تنبيه "معملتش فتح من فترة". Throttle
  // نص ساعة عشان منكتبش على قاعدة البيانات مع كل تنقّل بين الصفحات
  if (user) {
    const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000);
    const isNewDay = !user.lastActiveAt || user.lastActiveAt.toDateString() !== new Date().toDateString();

    if (!user.lastActiveAt || user.lastActiveAt < halfHourAgo) {
      try {
      void prisma.user.update({
        where: { id: user.id },
        data: {
          lastActiveAt: new Date(),
          // "أيام استخدام فعلية" - مش أيام تقويمية عادية. أساس اختفاء
          // الجولة التعريفية تلقائياً بعد 7-10 أيام استخدام حقيقي
          ...(isNewDay && !user.onboardingCompleted && !user.onboardingDismissed
            ? { onboardingActiveDaysSeen: { increment: 1 } }
            : {}),
        },
      }).catch(() => {});
      } catch (err) {
        console.error("[layout] تعذّر تسجيل النشاط:", err);
      }
    }
  }

  // بوابة الإعداد الإجبارية: مستخدم لم يربط أي منصة بعد يُحوَّل إلى شاشة
  // الإعداد **قبل ظهور القائمة الجانبية وبقية البرنامج** - لأن اللوحة بلا
  // حساب مربوط لا تعرض شيئاً ذا معنى. التخطي الصريح يُلغي التحويل نهائياً.
  // ⚠️ قاعدة معمارية: هذا الملف يلفّ **كل** صفحات اللوحة. أي خطأ يُرمى هنا
  // لا تلتقطه dashboard/error.tsx (فهي تلتقط أخطاء الأبناء لا أخطاء الـlayout)،
  // بل يصعد إلى global-error فيُسقط التطبيق كله بشاشة "حدث خطأ غير متوقع".
  //
  // لذلك: **لا استعلامات حرجة ولا redirect هنا**. بوابة الإعداد الإجبارية
  // انتقلت إلى app/dashboard/page.tsx - التحويل هناك يحقّق نفس الغرض
  // للمستخدم الجديد (يهبط على اللوحة أولاً) دون تعريض بقية الصفحات للسقوط.

  // بوابة الترحيب بتظهر لحد ما المستخدم يخلّصها أو يتخطاها (مش مربوطة
  // بعدد أيام - بوابة أولية إجبارية الظهور، لكن التخطّي متاح دائماً)
  const showOnboarding = !!user && !user.onboardingCompleted && !user.onboardingDismissed;

  // مساحات العمل ومبدّلها - المساحة النشطة من الكوكي، وإلا الأقدم
  // مصدر حقيقة واحد للحدود: الجدول المحلّي السابق كان يحمل باقة `growth`
  // لا وجود لها ويمنح `pro` خمس عشرة مساحة بينما الكتالوج يمنحها ثلاثاً.
  const entitlements = user ? await getEntitlements(user.id) : null;
  const workspaceLimit = entitlements?.limits.workspaces ?? 1;

  let allWorkspaces: Array<{ id: string; name: string; currency: string }> = [];
  if (user) {
    try {
      allWorkspaces = await prisma.workspace.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, currency: true },
      });
    } catch (err) {
      console.error("[layout] تعذّر جلب مساحات العمل:", err);
    }
  }
  const activeId = cookieStore.get("adloop_workspace")?.value;
  const activeWorkspace = allWorkspaces.find((w) => w.id === activeId) ?? allWorkspaces[0] ?? null;

  // حالة الربط تُقرأ فقط حين تظهر البوابة فعلاً - استعلامان لكل تحميل
  // صفحة لمستخدم أنهى الإعداد هدر بلا مقابل.
  let onboardingState: {
    connectStates: { platform: string; connected: boolean; campaignCount: number }[];
    campaignCount: number;
  } | null = null;

  if (showOnboarding && activeWorkspace) {
    const [connections, links] = await Promise.all([
      prisma.connectedPlatform.findMany({ where: { userId: user!.id }, select: { platform: true } }),
      prisma.campaignLink.findMany({
        where: { workspaceId: activeWorkspace.id },
        select: { platform: true },
      }),
    ]);
    const connectedSet = new Set(connections.map((c: { platform: string }) => c.platform));
    onboardingState = {
      connectStates: ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"].map((p) => ({
        platform: p,
        connected: connectedSet.has(p),
        campaignCount: links.filter((l: { platform: string }) => l.platform === p).length,
      })),
      campaignCount: links.length,
    };
  }

  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-accent={accent}
      data-mode={mode}
      className={`${display.variable} ${numeric.variable} flex min-h-screen flex-col bg-bg font-display`}
    >
      {isImpersonating && <ImpersonationBanner />}
      <LiveDataProvider>
      <div className="flex flex-1">
      <SidebarNav
        locale={locale}
        workspaceSlot={
          activeWorkspace ? (
            <WorkspaceSwitcher
              current={activeWorkspace}
              workspaces={allWorkspaces}
              canAddMore={allWorkspaces.length < workspaceLimit}
              limit={workspaceLimit}
              locale={locale}
            />
          ) : null
        }
        supportSlot={user ? <SupportChat name={user.name ?? ""} email={user.email} variant="sidebar" label={locale === "ar" ? "الدعم الفني" : "Support"} /> : null}
      />

      <main className="min-w-0 flex-1">
        {/* الهيدر ثابت أعلى الصفحة عند التمرير - كان يختفي مع النزول
            فيضيع البحث والإشعارات وقائمة الحساب */}
        {/* 🔴 لا backdrop-blur هنا: أي عنصر position:fixed داخل عنصر عليه
            backdrop-filter يتموضع بالنسبة إليه لا إلى الشاشة، فتُقصّ اللوحات
            المنبثقة (المساعدة، الإشعارات) على ارتفاع الهيدر. خلفية معتمة
            تعطي نفس الفصل البصري دون كسر أي عنصر بداخله. */}
        <div className="sticky top-0 z-40 mb-5 flex items-center gap-3 border-b border-border bg-bg px-10 py-4">
          <TopSearch locale={locale} />
          <div className="flex flex-1 items-center justify-end gap-1.5">
          {user && (
            <AiCreditBadge
              remaining={Math.max(0, MONTHLY_LIMIT - (user.aiRefreshMonthlyCount ?? 0))}
              total={MONTHLY_LIMIT}
              locale={locale}
            />
          )}
          <HelpButton locale={locale} />
          <div id="tour-notification-bell"><NotificationBell /></div>
          {user && (
            <AccountMenu
              name={user.name}
              email={user.email}
              avatarUrl={user.avatarImageUrl ?? user.avatarUrl ?? null}
              avatarIcon={user.avatarIcon ?? null}
              locale={locale}
              isOwner={user.isAdmin || user.email === process.env.OWNER_EMAIL}
            />
          )}
          </div>
        </div>
        <div className="px-10 pb-10">{children}</div>
      </main>
      </div>
      {entitlements && (
        <div className="px-10 pt-4">
          <TrialBar
            state={entitlements.state}
            trialDaysLeft={entitlements.trialDaysLeft}
            planKey={entitlements.planKey}
            locale={locale}
          />
        </div>
      )}

      {showOnboarding && activeWorkspace && onboardingState && (
        <WelcomeGate
          locale={locale}
          startStep={user!.onboardingStep}
          workspaceId={activeWorkspace.id}
          connectStates={onboardingState.connectStates}
          campaignCount={onboardingState.campaignCount}
        />
      )}
      <NotificationToast />
      </LiveDataProvider>
    </div>
  );
}
