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
import { UsageCapBar } from "@/app/components/UsageCapBar";
import { getUsageState } from "@/lib/usageCaps";
import { DemoBadge } from "@/app/components/DemoBadge";
import { getMonthlyAiUsage } from "@/lib/aiRateLimit";
import { ThemeModeToggle } from "@/app/components/ThemeModeToggle";
import { getNavBadges } from "@/lib/navBadges";
import { LegalLinks } from "@/app/components/LegalLinks";
import { MobileNavButton } from "@/app/components/MobileNavButton";
import { isDemoExpired } from "@/lib/demo";
import { DemoExpiredGate } from "@/app/components/DemoExpiredGate";
import { isOwnerEmail } from "@/lib/owner";
// next/font/google بيحمّل ملف الخط فعلياً وقت الـ build ويربطه بمتغير CSS -
// ده الفرق عن مجرد كتابة اسم الخط في font-family من غير ما يكون مستورد
// فعلياً (المشكلة اللي حصلت في المعاينة السابقة)
// 🔴 **العربية وحدها من هنا - واللاتينية من Inter تحت.**
//
// كانت هذه الاستدعاءة تخدم الكتابتين معاً (`subsets: ["arabic", "latin"]`).
// عربيّتها ممتازة، أمّا لاتينيّتها فهي IBM Plex Sans: قامةٌ صغيرة وأشكالُ
// حروفٍ ذاتُ طابع، صُمّمت للنصّ المطبوع لا لواجهةٍ نصُّها ١٢-١٣ بكسل -
// وعند هذا الحجم تفقد حدّتها على شبكة البكسل فتُقرأ «مبكسلة».
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

// **Inter للاتينيّة كلّها - نصّاً وأرقاماً.**
//
// مصمَّم لهذا الحجم بالذات: قامةٌ عالية، فتحاتٌ واسعة، وتلميحٌ مضبوط على
// شبكة البكسل. وهو خطّ واجهات SaaS القياسيّ لهذا السبب لا لموضة.
//
// **واستدعاءٌ واحد يخدم الاثنين:** كان يُحمَّل هنا للأرقام وحدها بينما
// يُحمَّل خطٌّ ثانٍ للنصّ. وما يميّز الأرقام ليس الخطّ بل
// `font-variant-numeric: tabular-nums` في `theme.css` - أي أنّ تحميله
// مرّتين كان يُنزّل الملفّ نفسه بذريعة فرقٍ مصدرُه CSS.
const latin = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-latin",
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
  //
  // **إلا داخل العرض التجريبي.** من دخل ليشاهد المنتج جاهزاً فوجئ بنافذة
  // تطالبه بربط حساب إعلاني حقيقي فوق مساحة كل خطواتها مكتملة أصلاً -
  // نقيض الغرض من الديمو تماماً. البوابة تعود فور رجوعه لمساحته.
  const showOnboardingBase = !!user && !user.onboardingCompleted && !user.onboardingDismissed;

  // مساحات العمل ومبدّلها - المساحة النشطة من الكوكي، وإلا الأقدم
  // مصدر حقيقة واحد للحدود: الجدول المحلّي السابق كان يحمل باقة `growth`
  // لا وجود لها ويمنح `pro` خمس عشرة مساحة بينما الكتالوج يمنحها ثلاثاً.
  const entitlements = user ? await getEntitlements(user.id) : null;

  const workspaceLimit = entitlements?.limits.workspaces ?? 1;

  let allWorkspaces: Array<{ id: string; name: string; currency: string; isDemo: boolean }> = [];
  if (user) {
    try {
      allWorkspaces = await prisma.workspace.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, currency: true, isDemo: true },
      });
    } catch (err) {
      console.error("[layout] تعذّر جلب مساحات العمل:", err);
    }
  }
  const activeId = cookieStore.get("adloop_workspace")?.value;
  const activeWorkspace = allWorkspaces.find((w) => w.id === activeId) ?? allWorkspaces[0] ?? null;

  // حالة الديمو من المساحة النشطة - الديمو مساحة عادية بعلامة، لا مسار
  // موازٍ يحتاج فحصاً منفصلاً في كل صفحة.
  const demoWs = activeWorkspace && user
    ? await prisma.workspace.findFirst({
        where: { id: activeWorkspace.id, userId: user.id, isDemo: true },
        select: { demoExpiresAt: true },
      })
    : null;

  const showOnboarding = showOnboardingBase && !demoWs;

  // الرصيد المتبقّي = ما تبقّى من مخصّص الباقة + المشترى
  const creditsUsed = user ? await getMonthlyAiUsage(user.id) : 0;
  const creditsLeft = entitlements
    ? Math.max(0, entitlements.limits.aiCredits - creditsUsed) + entitlements.purchasedCredits
    : 0;

  // عدّادات الأقسام - استعلام واحد خفيف، وفشله يُخفيها ولا يُسقط اللوحة
  const navBadges = await getNavBadges(activeWorkspace?.id ?? null);

  // حالة سقف الاستهلاك: قراءة صفّ واحد بمفتاحه (القياس نفسه يجري في الكرون
  // مرّةً يومياً، لا هنا). فشلها يُخفي الشريط ولا يُسقط اللوحة - وهذا الملفّ
  // يلفّ كلّ صفحات المنتج، فأيّ خطأ يُرمى منه يُسقطها جميعاً.
  const usage = user
    ? await getUsageState(user.id).catch((err) => {
        console.error("[layout] تعذّرت قراءة حالة سقف الاستهلاك:", err);
        return null;
      })
    : null;

  const demoDaysLeft = demoWs?.demoExpiresAt
    ? Math.max(0, Math.ceil((demoWs.demoExpiresAt.getTime() - Date.now()) / 86_400_000))
    : null;

  // 🔴 العدّاد كان يصل إلى صفر ولا يحدث شيء: `isDemoExpired` مبنيّة ولا
  // تُستدعى من أيّ مكان، فالعرض التجريبي مفتوح إلى الأبد. أرقام أمثلة
  // تبقى معروضة كأنها حقيقية هي أسوأ حالة ممكنة في منتج جوهره التحقّق.
  if (demoWs && activeWorkspace && (await isDemoExpired(activeWorkspace.id))) {
    return (
      <DemoExpiredGate
        locale={locale}
        accent={accent}
        mode={mode}
        fontVars={`${latin.variable} ${arabic.variable}`}
      />
    );
  }

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
      className={`${latin.variable} ${arabic.variable} flex min-h-screen flex-col bg-bg font-display`}
    >
      {isImpersonating && <ImpersonationBanner locale={locale} />}
      <LiveDataProvider>
      {/* 🔴 لون الشريط على الصفّ لا على الشريط وحده: الشريط ملتصق بارتفاع
          الشاشة، فإذا طالت الصفحة وقف عند حدّه وظهرت خلفية الصفحة تحته
          كقطعٍ في العمود. الصفّ يمتدّ بطول المحتوى، فما وراء الشريط لونه
          لونُه دائماً. و`main` يعيد لون الصفحة لنفسه. */}
      <div className="flex flex-1 bg-surface">
      <SidebarNav
        locale={locale}
        badges={navBadges}
        // انتقلت من رأس الصفحة: الرأس على الهاتف يحمل ستّة عناصر في ٦٨
        // بكسل، وهذه كانت تدفع البحث واسم المستخدم حتى يُقصّا معاً.
        brandSlot={
          demoWs ? (
            <DemoBadge
              locale={locale}
              daysLeft={demoDaysLeft}
              hasRealWorkspace={allWorkspaces.length > 1}
            />
          ) : null
        }
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
        supportSlot={user ? <SupportChat name={user.name ?? ""} email={user.email} variant="sidebar" locale={locale} /> : null}
      />

      {/* 🔴 عمود مرن بارتفاع الشاشة: كان `main` صندوقاً عادياً يتبع ارتفاع
          محتواه، فتظهر صفحة قصيرة (كالتشخيص قبل أوّل فحص) وتذييلها القانوني
          عالقاً في منتصف الشاشة وتحته فراغ - يُقرأ كأنّ الصفحة انتهت هناك
          وما تحته عطل. الآن يدفع المحتوى المرن التذييل إلى الأسفل دائماً. */}
      <main className="flex min-h-screen min-w-0 flex-1 flex-col bg-bg">
        {/* الهيدر ثابت أعلى الصفحة عند التمرير - كان يختفي مع النزول
            فيضيع البحث والإشعارات وقائمة الحساب */}
        {/* 🔴 لا backdrop-blur هنا: أي عنصر position:fixed داخل عنصر عليه
            backdrop-filter يتموضع بالنسبة إليه لا إلى الشاشة، فتُقصّ اللوحات
            المنبثقة (المساعدة، الإشعارات) على ارتفاع الهيدر. خلفية معتمة
            تعطي نفس الفصل البصري دون كسر أي عنصر بداخله. */}
        {/* ارتفاع ثابت ٦٨ بكسل مطابق لصفّ الشعار في القائمة الجانبية، فيصير
            الحدّان السفليّان خطّاً واحداً متّصلاً. الارتفاع الحرّ السابق كان
            يتبع محتواه فينكسر الخطّ عند حدّ العمودين. */}
        <div className="sticky top-0 z-40 mb-5 flex h-[68px] items-center gap-1.5 border-b border-border bg-bg px-3 sm:gap-3 sm:px-6 lg:px-10">
          <MobileNavButton locale={locale} />
          <TopSearch locale={locale} />
          <div className="flex flex-1 items-center justify-end gap-1.5">
          {/* شارة واحدة للرصيد. كانت اثنتين لنفس الرقم: واحدة تقرأ حدّاً
              ثابتاً وتتجاهل الباقة والرصيد المشترى، وأخرى تكرّرها. تُخفى
              في الديمو لأن الذكاء الاصطناعي معطَّل هناك.
              وتُخفى على الهاتف: رقمٌ إعلاميّ لا يُتخذ عنده قرار، ومكانه
              الطبيعيّ صفحة الاشتراك - بينما عرضه هنا يزاحم عناصر تُستعمل. */}
          {entitlements && !demoWs && (
            <span className="hidden sm:inline-flex">
              <AiCreditBadge
                remaining={creditsLeft}
                total={entitlements.limits.aiCredits + entitlements.purchasedCredits}
                locale={locale}
              />
            </span>
          )}
          <ThemeModeToggle initialMode={mode} locale={locale} />
          <HelpButton locale={locale} />
          <div id="tour-notification-bell"><NotificationBell locale={locale} /></div>
          {user && (
            <AccountMenu
              name={user.name}
              email={user.email}
              avatarUrl={user.avatarImageUrl ?? user.avatarUrl ?? null}
              avatarIcon={user.avatarIcon ?? null}
              locale={locale}
              isOwner={user.isAdmin || isOwnerEmail(user.email)}
            />
          )}
          </div>
        </div>
        {/* 🔴 شريط الاشتراك كان **تحت** صفّ العمودين لا داخله، وهذا سببُ
            عطلين معاً: (١) يمتدّ بعرض الشاشة كلّها فيمرّ تحت الشريط الجانبيّ
            لا داخل عمود المحتوى، (٢) والأهمّ: عنصر `sticky` يتوقّف عند حدّ
            حاوِيه، فوجودُ أيّ شيء أسفل الصفّ يعني أنّ الصفّ ينتهي قبل نهاية
            الصفحة - فيُدفع الشريط الجانبيّ إلى أعلى بمقدار ارتفاع هذا الشريط
            عند الوصول لآخر الصفحة، ويظهر أسفله قطعٌ بلون الخلفية.
            القاعدة: لا شيء في التدفّق بعد صفّ العمودين. */}
        {/* سقف الاستهلاك فوق شريط الاشتراك: توقّف المزامنة يعني أن كل رقم
            تحته لم يعد يتحدّث - وهي معلومة تسبق كلّ ما في الصفحة. لا يظهر
            داخل الديمو: أرقامه أمثلة لا تُقاس ولا تُحاسَب. */}
        {usage && !demoWs && (
          <div className="px-4 pt-1 sm:px-6 lg:px-10">
            <UsageCapBar state={usage} locale={locale} />
          </div>
        )}
        {entitlements && !demoWs && (
          <div className="px-4 pb-1 sm:px-6 lg:px-10">
            <TrialBar
              state={entitlements.state}
              trialDaysLeft={entitlements.trialDaysLeft}
              planKey={entitlements.planKey}
              locale={locale}
            />
          </div>
        )}
        <div className="flex-1 px-4 pb-10 sm:px-6 lg:px-10">{children}</div>

        {/* تذييل قانوني في كلّ صفحة داخل اللوحة: الصفحات الثلاث كانت
            مبنيّة بلا رابط واحد إليها في المنتج كلّه. */}
        <footer className="border-t border-border px-4 py-6 sm:px-6 lg:px-10">
          <LegalLinks locale={locale} variant="inline" />
        </footer>
      </main>
      </div>
      {/* حُذف شريط الديمو الذي كان هنا: كان يحتلّ عرض الشاشة أسفل الرأس
          في كل صفحة ويكرّر الرسالة نفسها، فيسرق مساحة من المحتوى الذي
          دخل المستخدم ليراه - نقيض غرض الديمو. صار شارة `DEMO` جنب
          الشعار، وتفاصيلها عند المرور عليها. */}

      {/* شريط الاشتراك انتقل إلى داخل عمود المحتوى أعلاه. لا يظهر داخل
          الديمو: بيع اشتراك فوق بيانات أمثلة يخلط رسالتين لا علاقة بينهما. */}

      {showOnboarding && activeWorkspace && onboardingState && (
        <WelcomeGate
          locale={locale}
          startStep={user!.onboardingStep}
          workspaceId={activeWorkspace.id}
          connectStates={onboardingState.connectStates}
          campaignCount={onboardingState.campaignCount}
        />
      )}
      <NotificationToast locale={locale} />
      </LiveDataProvider>
    </div>
  );
}
