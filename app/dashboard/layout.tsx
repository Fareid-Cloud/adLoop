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
import { Almarai, IBM_Plex_Mono } from "next/font/google";
import { FeedbackWidget } from "@/app/components/FeedbackWidget";
import { ImpersonationBanner } from "@/app/components/ImpersonationBanner";
import { NotificationBell } from "@/app/components/NotificationBell";
import { NotificationToast } from "@/app/components/NotificationToast";
import { OnboardingTour } from "@/app/components/OnboardingTour";
import { OnboardingCelebration } from "@/app/components/OnboardingCelebration";
import { SidebarNav } from "@/app/components/SidebarNav";
// next/font/google بيحمّل ملف الخط فعلياً وقت الـ build ويربطه بمتغير CSS -
// ده الفرق عن مجرد كتابة اسم الخط في font-family من غير ما يكون مستورد
// فعلياً (المشكلة اللي حصلت في المعاينة السابقة)
const almarai = Almarai({
  subsets: ["arabic"],
  weight: ["300", "400", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
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
  const mode = user?.themeMode ?? "dark";

  // تسجيل "آخر نشاط فعلي" - أساس تنبيه "معملتش فتح من فترة". Throttle
  // نص ساعة عشان منكتبش على قاعدة البيانات مع كل تنقّل بين الصفحات
  if (user) {
    const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000);
    const isNewDay = !user.lastActiveAt || user.lastActiveAt.toDateString() !== new Date().toDateString();

    if (!user.lastActiveAt || user.lastActiveAt < halfHourAgo) {
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
    }
  }

  const ONBOARDING_AUTO_HIDE_DAYS = 10;
  const showOnboarding =
    !!user &&
    !user.onboardingCompleted &&
    !user.onboardingDismissed &&
    user.onboardingActiveDaysSeen < ONBOARDING_AUTO_HIDE_DAYS;

  const showCelebration = !!user?.onboardingCompleted && !user.onboardingCelebrationShown;
  if (showCelebration && user) {
    void prisma.user.update({ where: { id: user.id }, data: { onboardingCelebrationShown: true } }).catch(() => {});
  }

  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-accent={accent}
      data-mode={mode}
      className={`${almarai.variable} ${plexMono.variable} flex min-h-screen flex-col bg-bg font-display`}
    >
      {isImpersonating && <ImpersonationBanner />}
      <div className="flex flex-1">
      <SidebarNav locale={locale} />

      <main className="flex-1 px-10 py-8">
        <div className="mb-4 flex items-center justify-end gap-3">
          {user && (
            <div className="flex items-center gap-2">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name ?? user.email} className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised text-xs text-text-muted">
                  {(user.name ?? user.email)[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-[13px] text-text-muted">{user.name ?? user.email}</span>
            </div>
          )}
          <div id="tour-notification-bell"><NotificationBell /></div>
        </div>
        {children}
      </main>
      </div>
      <FeedbackWidget />
      {showOnboarding && (
        <OnboardingTour
          step={user!.onboardingStep}
          completed={user!.onboardingCompleted}
          dismissed={user!.onboardingDismissed}
        />
      )}
      <OnboardingCelebration show={showCelebration} />
      <NotificationToast />
    </div>
  );
}
