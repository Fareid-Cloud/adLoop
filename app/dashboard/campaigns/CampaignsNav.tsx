"use client";

// app/dashboard/campaigns/CampaignsNav.tsx
//
// تنقّل أقسام الحملات - **مستويان صريحان: نطاقٌ ثمّ صفحة.**
//
// المسار: خمسة وعشرون رابطاً في صفّ واحد بلا تصنيف ← أربع بطاقات لكلّ
// منصّة ← تبويبات فوق صفٍّ من الأزرار ← ما هنا. وكلّ خطوة حلّت التي قبلها
// وأبقت واحدة. آخر ما بقي **علّتان**:
//
// **١) الصفّ الثاني كان أحد عشر زرّاً ملتفّاً في سطرين ونصف.** الزرّ وزنه
// البصريّ وزن «طبّق» و«احفظ» في الصفحة نفسها، فيتنافس التنقّل مع الإجراء
// على العين. وهو يلتفّ التفافاً غير متساوٍ يتغيّر مع طول الترجمة.
//
// **٢) والأهمّ: التنقّل كان يُصيَّر في `page.tsx` وحدها.** مَن يفتح «درجة
// الجودة» يفقد الشريط كلّه - لا تبويب ولا رابط - فلا سبيل إلى صفحةٍ
// مجاورة إلّا بزرّ الرجوع. أُصلح بنقله إلى `layout.tsx`: يظهر في الثلاثين
// صفحة، ويعرف موضعه من المسار وحده.
//
// **النطاق مِفتاحٌ مجمَّع والصفحات تبويبات بخطّ سفليّ:** شكلان مختلفان
// لمستويين مختلفين. لو كان الاثنان تبويبات لتساويا في العين، ولا يُعرف
// أيّهما يحكم الآخر.

import { usePathname } from "next/navigation";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { TabNav, type TabItem } from "@/app/components/ui/TabNav";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { Layers } from "lucide-react";

interface NavSection {
  id: string;
  labelKey?: string;
  labelRaw?: string;
  platform?: string;
  color: string;
  links: Array<{ href: string; key: string }>;
}

// المفاتيح لا النصوص: القسم يُترجَم كاملاً مع لغة الواجهة. الأسماء التجارية
// (Google / Meta / TikTok / Spark Ads) تبقى كما هي في اللغتين عمداً.
const SECTIONS: NavSection[] = [
  {
    id: "cross",
    labelKey: "crossPlatform",
    color: "var(--accent)",
    links: [
      { href: "/dashboard/campaigns", key: "overview" },
      { href: "/dashboard/campaigns/attribution-engine", key: "attributionEngine" },
      { href: "/dashboard/campaigns/attribution-path", key: "attributionPath" },
      { href: "/dashboard/campaigns/budget-simulator", key: "budgetSimulator" },
      { href: "/dashboard/campaigns/monthly-forecast", key: "monthlyForecast" },
      { href: "/dashboard/campaigns/creatives", key: "creatives" },
      { href: "/dashboard/campaigns/video-performance", key: "videoPerformance" },
      { href: "/dashboard/campaigns/lead-forms", key: "leadForms" },
    ],
  },
  {
    id: "google",
    labelRaw: "Google",
    platform: "GOOGLE_ADS",
    color: "#1A73E8",
    links: [
      { href: "/dashboard/campaigns/google-hub", key: "googleHub" },
      { href: "/dashboard/campaigns/quality-score", key: "qualityScore" },
      { href: "/dashboard/campaigns/search-terms", key: "searchTerms" },
      { href: "/dashboard/campaigns/match-types", key: "matchTypes" },
      { href: "/dashboard/campaigns/shopping", key: "shopping" },
      { href: "/dashboard/campaigns/pmax", key: "pmax" },
      { href: "/dashboard/campaigns/youtube", key: "youtube" },
      { href: "/dashboard/campaigns/display-placements", key: "displayPlacements" },
      { href: "/dashboard/campaigns/device-geo", key: "deviceGeo" },
      { href: "/dashboard/campaigns/audience", key: "audience" },
      { href: "/dashboard/campaigns/portfolio", key: "portfolio" },
    ],
  },
  {
    id: "meta",
    labelRaw: "Meta",
    platform: "META_ADS",
    color: "#0866FF",
    links: [
      { href: "/dashboard/campaigns/meta-hub", key: "metaHub" },
      { href: "/dashboard/campaigns/placements", key: "placements" },
      { href: "/dashboard/campaigns/content-formats", key: "contentFormats" },
      { href: "/dashboard/campaigns/catalog-ads", key: "catalogAds" },
      { href: "/dashboard/campaigns/learning-phase", key: "learningPhase" },
      { href: "/dashboard/campaigns/seasonal-trend", key: "seasonalTrend" },
      { href: "/dashboard/campaigns/competitor-ads", key: "competitorAds" },
    ],
  },
  {
    id: "tiktok",
    labelRaw: "TikTok",
    platform: "TIKTOK_ADS",
    color: "#FE2C55",
    links: [
      { href: "/dashboard/campaigns/tiktok-hub", key: "tiktokHub" },
      { href: "/dashboard/campaigns/tiktok-hook-rate", key: "hookRate" },
      { href: "/dashboard/campaigns/tiktok-fatigue", key: "tiktokFatigue" },
      { href: "/dashboard/campaigns/tiktok-spark-ads", key: "sparkAds" },
    ],
  },
];

/** أدقّ رابطٍ يطابق المسار - لا أوّل ما يطابق.
 *
 *  🔴 `startsWith` وحده يجعل `/campaigns` (الفهرس) يطابق **كلّ** صفحة تحته،
 *  فيُضاء تبويب «نظرة عامّة» ومعه التبويب الصحيح في آنٍ واحد. الأطول يفوز. */
function matchLink(pathname: string): { section: NavSection; href: string } | null {
  let best: { section: NavSection; href: string } | null = null;
  for (const section of SECTIONS) {
    for (const link of section.links) {
      const hit = pathname === link.href || pathname.startsWith(`${link.href}/`);
      if (hit && (!best || link.href.length > best.href.length)) {
        best = { section, href: link.href };
      }
    }
  }
  return best;
}

export function CampaignsNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  // 🔴 **صفر `useState` هنا - والموضع يُقرأ من المسار وحده.**
  //
  // حين كان التبويب حالةً محلّية كان يبدأ من `cross` في كلّ تصيير، فمن
  // ينتقل بين صفحتَي جوجل يرى النطاق يقفز إلى «عامّ» بينه وبينهما. المسار
  // هو مصدر الحقيقة الوحيد: هو ما يبقى بعد إعادة التحميل وزرّ الرجوع.
  const match = matchLink(pathname);
  const section = match?.section ?? SECTIONS[0];

  const scopeTabs: TabItem[] = SECTIONS.map((s) => ({
    key: s.id,
    label: s.labelRaw ?? t(locale, `campNav.${s.labelKey}`),
    // النطاق ينتقل إلى **أوّل صفحة فيه** - فالضغط عليه فعلٌ مكتمل لا اختيارٌ
    // ينتظر اختياراً ثانياً بعده.
    href: s.links[0].href,
    count: s.links.length,
    iconNode: s.platform ? (
      <PlatformLogo platform={s.platform} size={15} />
    ) : (
      <Layers size={15} strokeWidth={2} />
    ),
  }));

  const pageTabs: TabItem[] = section.links.map((link) => ({
    key: link.href,
    label: t(locale, `campNav.${link.key}`),
    href: link.href,
  }));

  return (
    <div className="mb-6">
      {/* المستوى الأوّل: النطاق. مِفتاحٌ مجمَّع داخل خلفية واحدة - كتلة
          واحدة تُقرأ «اختر منها واحداً»، لا أربعة عناصر مستقلّة. */}
      {/* 🔴 **شكلٌ ثانٍ لنفس الفكرة.** كانت شريطاً رمادياً بأقراصٍ داخله،
          بينما مجموعة مركز الحقيقة أزرارٌ مستقلّة بحدٍّ وتظليلٍ من لون
          الهوية - ففكرةٌ واحدة («اختر واحداً») بلغتين بصريّتين، والمستخدم
          يتعلّم شكلاً في صفحةٍ ولا يجده في التي بعدها.

          هنا لغة `OptionGroup` نفسها: لا حاويةَ رمادية، بل خياراتٌ متجاورة
          المختارُ منها بحدٍّ وخلفيةٍ لبنيّة. */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {scopeTabs.map((tab) => {
          const on = tab.key === section.id;
          const color = SECTIONS.find((s) => s.id === tab.key)!.color;
          return (
            <a
              key={tab.key}
              href={tab.href}
              aria-current={on ? "true" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-medium no-underline transition-colors ${
                on
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface-raised text-text-muted hover:text-text-primary"
              }`}
            >
              <span className={on ? "" : "opacity-60"}>{tab.iconNode}</span>
              {tab.label}
              <span
                className="rounded-full px-1.5 py-px font-mono text-[11px] leading-4"
                style={
                  on
                    ? { backgroundColor: `${color}24`, color }
                    : { backgroundColor: "var(--surface)", color: "var(--text-faint)" }
                }
              >
                {tab.count}
              </span>
            </a>
          );
        })}
      </div>

      {/* المستوى الثاني: الصفحة. خطٌّ سفليّ بلون المنصّة - فاللون يقول أين
          أنت قبل أن تُقرأ كلمة، وهو اللون نفسه في التبويب والرأس والرسوم. */}
      <TabNav
        items={pageTabs}
        active={match?.href ?? section.links[0].href}
        accent={section.color}
        ariaLabel={t(locale, "campNav.pagesAria")}
      />
    </div>
  );
}
