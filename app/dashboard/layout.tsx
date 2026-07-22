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
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import { SupportChat } from "@/app/components/SupportChat";
import { ImpersonationBanner } from "@/app/components/ImpersonationBanner";
import { NotificationBell } from "@/app/components/NotificationBell";
import { NotificationToast } from "@/app/components/NotificationToast";
import { WelcomeGate } from "@/app/components/WelcomeGate";
import { AccountMenu } from "@/app/components/AccountMenu";
import { SidebarNav } from "@/app/components/SidebarNav";
// next/font/google بيحمّل ملف الخط فعلياً وقت الـ build ويربطه بمتغير CSS -
// ده الفرق عن مجرد كتابة اسم الخط في font-family من غير ما يكون مستورد
// فعلياً (المشكلة اللي حصلت في المعاينة السابقة)
const display = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
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
  const mode = user?.themeMode ?? "light";

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

  // بوابة الترحيب بتظهر لحد ما المستخدم يخلّصها أو يتخطاها (مش مربوطة
  // بعدد أيام - بوابة أولية إجبارية الظهور، لكن التخطّي متاح دائماً)
  const showOnboarding = !!user && !user.onboardingCompleted && !user.onboardingDismissed;

  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-accent={accent}
      data-mode={mode}
      className={`${display.variable} ${plexMono.variable} flex min-h-screen flex-col bg-bg font-display`}
    >
      {isImpersonating && <ImpersonationBanner />}
      <div className="flex flex-1">
      <SidebarNav locale={locale} />

      <main className="flex-1 px-10 py-8">
        <div className="mb-4 flex items-center justify-end gap-3">
          <div id="tour-notification-bell"><NotificationBell /></div>
          {user && (
            <AccountMenu
              name={user.name}
              email={user.email}
              avatarUrl={user.avatarUrl ?? null}
              locale={locale}
            />
          )}
        </div>
        {children}
      </main>
      </div>
      {user && <SupportChat name={user.name ?? ""} email={user.email} />}
      {showOnboarding && <WelcomeGate locale={locale} startStep={user!.onboardingStep} />}
      <NotificationToast />
    </div>
  );
}
