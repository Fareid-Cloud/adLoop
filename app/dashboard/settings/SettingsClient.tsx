// app/dashboard/settings/SettingsClient.tsx
//
// إعدادات شاملة - لكل نظام في المنتج تحكّم صريح هنا (تشغيل/إيقاف +
// عتبات قابلة للتعديل)، لا أرقاماً مثبّتة داخل الكود.

"use client";

import { Toggle } from "@/app/components/ui/Toggle";
import { ConnectionTester } from "@/app/components/ConnectionTester";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { useState, useMemo, useEffect, createContext, useContext, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings as SettingsIcon, Bot, Cpu, Sparkles, Terminal, Brain, Zap, Upload, Search, User, Palette, Plug, Building2, RefreshCw, TriangleAlert, ShieldCheck, Check, ChevronDown } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import { PushNotificationToggle } from "@/app/components/PushNotificationToggle";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { OptionGroup } from "@/app/components/ui/OptionGroup";
import { TabNav } from "@/app/components/ui/TabNav";
import { ThemeModeCard } from "@/app/components/ui/ThemeModeCard";
import type { LucideIcon } from "lucide-react";
import { Select } from "@/app/components/ui/Select";
import {
  SETTINGS_SEARCH_INDEX,
  SETTINGS_TAB_LABEL_KEYS,
  settingsEntryHref,
  type SettingsTabKey,
} from "@/lib/settingsSearchIndex";

// سياق اللغة بدل تمريرها كخاصية عبر أربعة عشر مكوّناً فرعياً. الملف واحد
// وشجرته كلها في العميل، فالسياق هنا أنظف وأقل عرضة للخطأ من تمرير
// خاصية تُنسى في مكوّن واحد فيبقى نصّه بلغة واحدة دون أن يلاحظ أحد.
const SettingsLocaleContext = createContext<Locale>("ar");
/** حساب المالك يرى الأعطاب التقنية باسمها؛ المشترك يرى ما يعنيه هو. */
const OwnerContext = createContext(false);

function useT() {
  const locale = useContext(SettingsLocaleContext);
  return (k: string, vars?: Record<string, string | number>) => t(locale, `settings.${k}`, vars);
}

const AVATAR_ICONS = [
  { key: "bot", Icon: Bot },
  { key: "cpu", Icon: Cpu },
  { key: "sparkles", Icon: Sparkles },
  { key: "terminal", Icon: Terminal },
  { key: "brain", Icon: Brain },
  { key: "zap", Icon: Zap },
] as const;

// الرمادي يصلح للوضعين الفاتح والداكن معاً (لا يميل لأيّهما)، و"فيسبوك"
// أزرق ميتا الرسمي #0866FF - يألفه من يقضي يومه في مدير إعلانات ميتا.
const THEME_COLORS = ["blue", "facebook", "purple", "sky", "gray", "orange", "red"] as const;

const THEME_COLOR_KEYS: Record<(typeof THEME_COLORS)[number], string> = {
  blue: "colorBlue",
  facebook: "colorFacebook",
  purple: "colorPurple",
  sky: "colorSky",
  gray: "colorGray",
  orange: "colorOrange",
  red: "colorRed",
};

interface UserData {
  name: string | null;
  email: string;
  avatarIcon: string | null;
  avatarImageUrl: string | null;
  preferredLocale: string;
  themeColor: string;
  themeMode: string;
  timezone: string;
  marketingOptOut: boolean;
  businessScale: string | null;
}

interface WorkspaceData {
  id: string;
  name: string;
  currency: string;
  /** عملة الحساب الإعلانيّ المربوط - `null` قبل أوّل مزامنة */
  dataCurrency: string | null;
  isDemo: boolean;
  targetLocation: string | null;
  profitMarginPct: number | null;
  monthlyChangeCeilingPct: number;
  facebookPageId: string | null;
  whatsappPhoneNumberId: string | null;
  whatsappBusinessPhone: string | null;
  googleAdsCustomerId: string | null;
  useModeledAttribution: boolean;
  responseTimeThresholdMinutes: number;
  messengerInactivityThresholdMinutes: number;
  primaryConversionSource: string;
  autoReplyText: string | null;
  enableAIInsights: boolean;
  enableAutomationRules: boolean;
  enableDailyDiagnostics: boolean;
  enablePricingHealthChecks: boolean;
  adFatigueFrequencyThreshold: number;
  ctrDropThresholdPct: number;
  pricingWarningThresholdPct: number;
  pricingCriticalThresholdPct: number;
  rtoAnomalyMultiplier: number;
  automationMonthlyBudgetChangeCeilingPct: number | null;
  notifyUrgentByEmail: boolean;
  notifyHighByEmail: boolean;
  notificationEmail: string | null;
  /** هل البريد مضبوط على الخادم أصلاً - لا تفضيل بل قدرة */
  emailEnabled: boolean;
  // إعادة رفع التحويلات - التوكنات نفسها لا تصل هنا أبداً، فقط وجودها
  conversionSyncEnabled: boolean;
  conversionSyncVerifiedOnly: boolean;
  metaPixelId: string | null;
  googleConversionActionId: string | null;
  tiktokPixelCode: string | null;
  hasMetaCapiToken?: boolean;
  hasTiktokCapiToken?: boolean;
}

interface ConnectedPlatformData {
  platform: string;
  connectedAt: string;
  expiresAt: string | null;
}

const TABS = [
  { key: "profile", labelKey: "tabProfile", icon: User },
  { key: "preferences", labelKey: "tabPreferences", icon: Palette },
  { key: "accounts", labelKey: "tabAccounts", icon: Plug },
  { key: "workspace", labelKey: "tabWorkspace", icon: Building2 },
  { key: "automation", labelKey: "tabAutomation", icon: Zap },
  { key: "conversionSync", labelKey: "tabConversionSync", icon: RefreshCw },
  { key: "security", labelKey: "tabSecurity", icon: ShieldCheck },
  { key: "danger", labelKey: "tabDanger", icon: TriangleAlert },
] as const;

// 🔴 سبعة تبويبات في صفٍّ واحد تُقرأ قائمةً مسطّحة: «مساحة العمل» و«الملفّ
// الشخصيّ» و«المنطقة الخطرة» بوزنٍ واحد، رغم أنّ الأوّل يخصّ حساباً
// إعلانياً والثاني يخصّك أنت والثالث يحذف كلّ شيء. المجموعة تقول أيّها
// يخصّ ماذا **قبل** أن يُقرأ اسمُ التبويب - وهو ما يجعل الصفحة «متقسّمة
// بمنطق» لا مجرّد مرتّبة.
const TAB_GROUPS: ReadonlyArray<{
  titleKey: string;
  keys: ReadonlyArray<(typeof TABS)[number]["key"]>;
}> = [
  { titleKey: "grpAccount", keys: ["profile", "preferences", "security"] },
  { titleKey: "grpWorkspace", keys: ["workspace", "accounts", "automation", "conversionSync"] },
  { titleKey: "grpAdvanced", keys: ["danger"] },
];



export function SettingsClient({
  user,
  workspaces,
  connectedPlatforms,
  isOwner,
}: {
  user: UserData;
  workspaces: WorkspaceData[];
  connectedPlatforms: ConnectedPlatformData[];
  isOwner: boolean;
}) {
  // التبويب الأوّلي من الرابط: بدونه كان كل زرّ يشير إلى إعداد بعينه
  // يهبط بالمستخدم على «الملف الشخصي» ويتركه يبحث عمّا أُرسل إليه.
  const searchParams = useSearchParams();
  const settingsRouter = useRouter();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(
    TABS.some((t) => t.key === requestedTab)
      ? (requestedTab as SettingsTabKey)
      : "profile"
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");

  const locale: Locale = (user.preferredLocale as Locale) ?? "ar";
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `settings.${k}`, vars);

  // البحث يطابق النص المعروض بلغة الواجهة لا المفتاح - المستخدم يكتب ما يرى
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return SETTINGS_SEARCH_INDEX.filter((item) => tr(item.labelKey).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, locale]);

  // ═══ الهبوط عند الحقل نفسه ═══
  //
  // 🔴 **بالاسم المعروض لا بسمةٍ على كلّ حقل.** البديل أن يحمل كلٌّ من
  // الحقول الثلاثين `data-search-id`، وهي قائمةٌ موازيةٌ للفهرس تُصان
  // يدوياً - وأوّلُ حقلٍ يُضاف بعدها يظهر في البحث ولا يُهبَط عنده، وهو
  // عطلٌ صامت لا يشكو منه أحد.
  //
  // والفهرس يضمن أصلاً أنّ لكلّ بندٍ فيه حقلاً حقيقياً بهذا الاسم بعينه،
  // فالاسمُ رابطٌ قائمٌ لا رابطٌ نخترعه. يبقى مصدرٌ واحد يُصان.
  //
  // وإن لم يُطابَق شيء لم يُكسر شيء: التبويب الصحيح مفتوح، وهو ما كان
  // يحدث قبل هذا كلّه.
  const highlightKey = searchParams.get("highlight");
  useEffect(() => {
    if (!highlightKey) return;
    const entry = SETTINGS_SEARCH_INDEX.find((e) => e.labelKey === highlightKey);
    if (!entry) return;
    setActiveTab(entry.tab);

    const wanted = t(locale, `settings.${entry.labelKey}`).trim();
    let cancelled = false;
    let observer: MutationObserver | null = null;

    function tryFind(): boolean {
      if (cancelled) return false;
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>("label, h2, h3, h4, p, span, div")
      );
      // الأعمقُ نصّاً: عنصرٌ نصُّه هو الاسم وحده ولا يحتوي ابناً يقوله كذلك -
      // وإلّا وقع الاختيار على غلافٍ كبير يبتلع نصف التبويب.
      const hit = nodes.find(
        (el) =>
          el.textContent?.trim() === wanted &&
          !Array.from(el.children).some((c) => c.textContent?.trim() === wanted)
      );
      if (!hit) return false;
      const box = (hit.closest("li, section, .card") as HTMLElement | null) ?? hit;
      box.scrollIntoView({ behavior: "smooth", block: "center" });
      box.classList.add("search-found");
      window.setTimeout(() => box.classList.remove("search-found"), 2600);
      observer?.disconnect();
      return true;
    }

    // التبويب يُصيَّر بعد هذا التأثير، فالحقل قد لا يكون في الصفحة بعد.
    if (tryFind()) return;
    observer = new MutationObserver(() => {
      tryFind();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const stop = window.setTimeout(() => observer?.disconnect(), 8000);
    return () => {
      cancelled = true;
      window.clearTimeout(stop);
      observer?.disconnect();
    };
  }, [highlightKey, locale]);

  return (
    <SettingsLocaleContext.Provider value={locale}>
    <OwnerContext.Provider value={isOwner}>
    <div className="mx-auto max-w-5xl">
      <PageHeader icon={SettingsIcon} tone="accent" title={tr("title")} description={tr("pageSubtitle")} />

      <div className="relative mb-6 max-w-md">
        <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-text-faint" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={tr("searchPlaceholder")}
          // 🔴 `field-icon-start` لا `ps-9`: حشوة `.field` مكتوبة في
          // `theme.css` **خارج طبقات Tailwind**، فتغلب أيّ أداة حشو مهما
          // بلغت أولويّتها - وكانت العدسة تقع فوق نصّ العنصر النائب.
          // الصنف الجاهز مكتوب في الملفّ نفسه بعدها، فيغلبها بدوره.
          className="field field-icon-start w-full"
        />
        {searchResults.length > 0 && (
          <div className="card absolute z-10 mt-1 w-full overflow-hidden bg-surface-raised shadow-lg">
            {searchResults.map((r) => (
              <button
                key={r.labelKey}
                onClick={() => {
                  setActiveTab(r.tab);
                  setSearchQuery("");
                  // 🔴 فتحُ التبويب نصفُ الوصول. التبويب الواحد يحمل عشرة
                  // حقول، فمن بحث عن «السقف الشهري» يُترك يقرؤها ليجده.
                  // `highlight` هو ما ينزل به `SearchHighlight` عند الحقل
                  // نفسه ويُعلّمه - والمعرّف هو `labelKey` بلا جدولٍ وسيط.
                  settingsRouter.replace(settingsEntryHref(r), { scroll: false });
                }}
                className="block w-full rounded-lg px-4 py-2.5 text-start text-sm text-text-primary transition-colors hover:bg-surface"
              >
                {tr(r.labelKey)}
                <span className="ms-2 text-xs text-text-faint">
                  {tr("inTab", { tab: tr(SETTINGS_TAB_LABEL_KEYS[r.tab]) })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* الهاتف: تبويبات أفقية. عمودٌ جانبيّ في ٣٧٥ بكسل يأكل نصف العرض
          ويترك للمحتوى النصف الآخر. */}
      <TabNav
        items={TABS.map((tab) => ({ key: tab.key, label: tr(tab.labelKey), icon: tab.icon }))}
        active={activeTab}
        onChange={(k) => setActiveTab(k as SettingsTabKey)}
        ariaLabel={tr("title")}
        className="mb-7 md:hidden"
      />

      {/* 🔴 **الشكل من المرجع الذي أرسله المالك، بعد جولتين خاطئتين.**
          كان إطاراً واحداً بلا معنى، ثمّ أُزيل الإطار كلّه فتناثر كلّ شيء.
          والمرجع يقول شيئاً ثالثاً: **لوحةٌ واحدة تضمّ القائمة والمحتوى
          معاً**، والقائمة داخلها يفصلها خطٌّ رأسيّ، والبطاقات تطفو فوق
          سطحٍ أخفت قليلاً من سطحها هي - فيُقرأ الطفوّ من فرق السطحين لا
          من ظلٍّ ثقيل.

          والفرق عن الجولة الأولى أنّ الإطار هنا يحدّ **شيئاً حقيقياً**:
          مساحة الإعداد بقائمتها ومحتواها، مفصولةً عن رأس الصفحة فوقها. */}
      {/* حدٌّ خفيفٌ **ثابت**: يرسم حدود المنطقة، ولا يستجيب للمرور فوقه.
          `.card` تُفتّح حدَّها عند التأشير لأنّها عنصرٌ يُتعامَل معه؛ وهذه
          مساحةُ صفحةٍ لا تُضغط ولا تُفتَح، فتفاعلُها يَعِد بفعلٍ لا وجود له. */}
      {/* 🔴 **`overflow-hidden` هنا كانت تُبطل `sticky` في العمود الأيسر.**
          أيّ قيمةِ `overflow` غير `visible` على أيّ سلفٍ تجعله حاويةَ تمرير،
          فيلتصق الابن بها لا بالشاشة - أي لا يلتصق بشيءٍ عملياً. كانت
          موضوعةً لقصّ الأبناء عند الحواف الدائرية، وتلك تُنجَز بتدوير
          العمودين نفسيهما بلا قصٍّ يكسر شيئاً. */}
      <div className="rounded-2xl border border-border bg-surface md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
        {/* الشاشة الواسعة: عمودٌ مجمَّع. `sticky` كي يبقى مرئياً في تبويب
            طويل - التنقّل الذي يمرّ خارج الشاشة يعادل غيابه. */}
        <nav
          className="hidden border-e border-border md:block md:rounded-s-2xl"
          aria-label={tr("title")}
        >
          {/* بارتفاعٍ محدود وتمريرٍ داخليّ: قائمةٌ أطول من الشاشة كانت
              ستُخفي آخرَ أقسامها بلا سبيلٍ للوصول إليها. والتمرير على هذا
              العنصر نفسه لا على سلفه، فلا يُبطل التصاقَه. */}
          <div className="settings-rail sticky flex flex-col gap-6 overflow-y-auto p-5">
            {TAB_GROUPS.map((group) => (
              <div key={group.titleKey}>
                <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">
                  {tr(group.titleKey)}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.keys.map((key) => {
                    const tab = TABS.find((x) => x.key === key)!;
                    const on = activeTab === key;
                    const Icon = tab.icon;
                    // الخطر لونُه دلاليّ حتى وهو ساكن: العنصر الذي يحذف
                    // الحساب لا يُقرأ كأخيه الذي يبدّل لغة الواجهة.
                    const danger = key === "danger";
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTab(key)}
                        aria-current={on ? "page" : undefined}
                        className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-start text-[13px] font-medium transition-colors ${
                          on
                            ? danger
                              ? "bg-critical/10 text-critical"
                              // العنصر المحدَّد بلون الهوية لا برماديّ أغمق:
                              // الرماديّ يقول «مضغوط»، واللبنيّ يقول «أنت هنا» -
                              // وهو ما يحتاجه تنقّلٌ لا زرّ.
                              : "bg-accent/10 text-accent"
                            : danger
                              ? "text-critical/75 hover:bg-critical/8 hover:text-critical"
                              : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
                        }`}
                      >
                        <Icon size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
                        <span className="leading-tight">{tr(tab.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* سطحُ اللوحة أبيضُ الهوية لا رماديّ الصفحة - بطلب المالك، وهو
            محقّ: الرماديّ كان يجعل اللوحة تبدو منطقةً معطّلة. والبطاقات
            فوقه تُقرأ ببياضها وحدّها، لا بفرق درجةٍ عن سطحٍ كامد. */}
        <div className="min-w-0 bg-surface p-5 md:p-6">
      {activeTab === "profile" && <ProfileTab user={user} />}
      {activeTab === "preferences" && <PreferencesTab user={user} />}
      {activeTab === "accounts" && <AccountsTab connectedPlatforms={connectedPlatforms} />}
      {activeTab === "workspace" && workspaces.length > 0 && (
        <WorkspaceTab
          key={activeWorkspaceId}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={setActiveWorkspaceId}
        />
      )}
      {activeTab === "automation" && workspaces.length > 0 && (
        <AutomationTab
          key={activeWorkspaceId}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={setActiveWorkspaceId}
        />
      )}
      {activeTab === "conversionSync" && workspaces.length > 0 && (
        <ConversionSyncTab
          key={activeWorkspaceId}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={setActiveWorkspaceId}
        />
      )}
      {activeTab === "security" && (
        <SettingsSection icon={ShieldCheck} title={tr("tabSecurity")} boxed description={tr("secSecurityDesc")}>
          {searchParams.get("mfaRequired") === "1" && isOwner && (
            <div className="mb-4 rounded-xl border border-critical/30 bg-critical/10 px-4 py-3 text-[13px] text-critical">
              {tr("mfaRequiredBanner")}
            </div>
          )}
          <ChangePasswordFields />
          <MfaFields />
          {isOwner && <SignOutEverywhereField />}
        </SettingsSection>
      )}
      {activeTab === "danger" && workspaces.length > 0 && (
        <DangerZoneTab workspaces={workspaces} />
      )}
        </div>
      </div>
    </div>
    </OwnerContext.Provider>
    </SettingsLocaleContext.Provider>
  );
}

// ==================== الملف الشخصي ====================

function ProfileTab({ user }: { user: UserData }) {
  const tr = useT();
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [avatarIcon, setAvatarIcon] = useState(user.avatarIcon ?? "bot");
  const [avatarImageUrl, setAvatarImageUrl] = useState(user.avatarImageUrl);
  const [saving, setSaving] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // نحوّل الصورة إلى base64 ونخزّنها مباشرة - مقبول لحجم صورة شخصية صغيرة،
    // دون الحاجة إلى خدمة تخزين ملفات منفصلة (S3 مثلاً) لغرض بهذه البساطة
    const reader = new FileReader();
    reader.onload = () => setAvatarImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatarIcon, avatarImageUrl }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <SettingsSection icon={User} title={tr("tabProfile")} boxed description={tr("secProfileDesc")}>
      <FieldLabel>{tr("idxName")}</FieldLabel>
      <TextInput value={name} onChange={setName} placeholder={tr("namePlaceholder")} />

      <FieldLabel>{tr("idxAvatar")}</FieldLabel>
      <div className="mb-2 flex flex-wrap gap-2">
        {AVATAR_ICONS.map(({ key, Icon }) => (
          <button
            key={key}
            onClick={() => {
              setAvatarIcon(key);
              setAvatarImageUrl(null);
            }}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              avatarIcon === key && !avatarImageUrl
                ? "bg-accent text-white"
                : "bg-surface-raised text-text-muted hover:text-text-primary"
            }`}
          >
            <Icon size={20} />
          </button>
        ))}
        <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-surface-raised text-text-muted hover:text-text-primary">
          {avatarImageUrl ? (
            <img src={avatarImageUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <Upload size={18} />
          )}
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </label>
      </div>
      <p className="mb-4 text-xs text-text-faint">{tr("avatarHint")}</p>

      <SaveButton onClick={handleSave} saving={saving} />
    </SettingsSection>
  );
}

// ==================== التفضيلات ====================

function PreferencesTab({ user }: { user: UserData }) {
  const tr = useT();
  const router = useRouter();
  const [locale, setLocale] = useState(user.preferredLocale);
  const [themeColor, setThemeColor] = useState(user.themeColor);
  const [themeMode, setThemeMode] = useState(user.themeMode);
  const [timezone, setTimezone] = useState(user.timezone);
  const [marketingOptOut, setMarketingOptOut] = useState(user.marketingOptOut);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredLocale: locale, themeColor, themeMode, timezone, marketingOptOut }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <SettingsSection icon={Palette} title={tr("tabPreferences")} boxed description={tr("secPrefsDesc")}>
      {/* عمودان: ما يخصّ **اللغة** وما يخصّ **المظهر**. كانا قائمةً واحدة
          طويلة، فيقع لونُ التمييز على بُعد تمريرةٍ من الوضع الذي يظهر
          عليه - وهما يُختاران معاً بالعين لا كلٌّ على حدة. */}
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">
            {tr("grpInterface")}
          </div>
          <FieldLabel>{tr("idxLanguage")}</FieldLabel>
          <ToggleGroup
            options={[{ value: "ar", label: tr("langArabic") }, { value: "en", label: "English" }]}
            value={locale}
            onChange={setLocale}
          />

          <FieldLabel>{tr("idxTimezone")}</FieldLabel>
          {/* مجموعات بدل قائمة مسطّحة: القائمة صارت أطول من أن تُمسح بالعين */}
          <Select
            locale={locale as Locale}
            value={timezone}
            onChange={setTimezone}
            ariaLabel={tr("idxTimezone")}
            className="mb-4"
            options={[
              { value: "Asia/Riyadh", label: tr("tzRiyadh"), group: tr("tzGroupGulf") },
              { value: "Africa/Cairo", label: tr("tzCairo"), group: tr("tzGroupGulf") },
              { value: "Asia/Dubai", label: tr("tzDubai"), group: tr("tzGroupGulf") },
              { value: "Asia/Kuwait", label: tr("tzKuwait"), group: tr("tzGroupGulf") },
              { value: "Europe/Istanbul", label: tr("tzIstanbul"), group: tr("tzGroupGulf") },
              { value: "Europe/London", label: tr("tzLondon"), group: tr("tzGroupEurope") },
              { value: "Europe/Paris", label: tr("tzParis"), group: tr("tzGroupEurope") },
              { value: "Europe/Berlin", label: tr("tzBerlin"), group: tr("tzGroupEurope") },
              { value: "America/New_York", label: tr("tzNewYork"), group: tr("tzGroupAmericas") },
              { value: "America/Chicago", label: tr("tzChicago"), group: tr("tzGroupAmericas") },
              { value: "America/Los_Angeles", label: tr("tzLosAngeles"), group: tr("tzGroupAmericas") },
            ]}
          />
        </div>

        <div className="md:border-s md:border-border md:ps-8">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">
            {tr("grpAppearance")}
          </div>

          {/* 🔴 **كان كبسولتين مكتوباً عليهما «فاتح» و«داكن».** والكلمة
              تسمّي ولا تُري: مَن لم يجرّب الوضع الداكن لا يعرف منها أهو
              رماديّ فحميّ أم أزرقُ ليليّ، ولا أين يقع لونُ التمييز عليه.
              فيضغط ليرى ثمّ يرجع - أي أنّ الاختيار كان يُجرَّب لا يُقرأ. */}
          <FieldLabel>{tr("mode")}</FieldLabel>
          <div className="mb-5 grid grid-cols-2 gap-3">
            {(["light", "dark"] as const).map((m) => (
              <ThemeModeCard
                key={m}
                mode={m}
                label={tr(m === "light" ? "modeLight" : "modeDark")}
                selected={themeMode === m}
                onSelect={() => setThemeMode(m)}
              />
            ))}
          </div>

          {/* الألوان السبعة كما هي - لا يُضاف إليها ولا يُعدَّل عليها.
              ما تغيّر شكلُ الاختيار وحده: علامةٌ صريحة بدل تكبيرٍ طفيف
              كان يترك «أيّها المختار؟» سؤالاً قائماً. */}
          <FieldLabel>{tr("idxAccent")}</FieldLabel>
          <div className="mb-4 flex flex-wrap gap-2.5">
            {THEME_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setThemeColor(c)}
                data-accent={c}
                title={tr(THEME_COLOR_KEYS[c])}
                aria-label={tr(THEME_COLOR_KEYS[c])}
                aria-pressed={themeColor === c}
                className={`relative h-8 w-8 rounded-full bg-accent transition-transform hover:scale-105 ${
                  themeColor === c ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""
                }`}
              >
                {themeColor === c && (
                  <Check
                    size={14}
                    strokeWidth={3}
                    className="absolute inset-0 m-auto text-white"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 🔴 حُذف من هنا بند «المستندات القانونية»: الروابط الثلاثة نفسها
          في تذييل **كلّ** صفحة داخل اللوحة، ونسخةٌ ثانيةٌ منها في
          التفضيلات لا تضيف وصولاً - تضيف بنداً يمرّ عليه المستخدم وهو
          يبحث عن إعداد. الإعدادات لما يُضبَط، لا لما يُقرأ. */}
      {/* 🔴 **كان قسماً بعنوانٍ وشرحٍ لمفتاحٍ واحد.** والعنوان يَعِد بما
          تحته: يقرأ المستخدم «رسائل تسويقية» فيتوقّع مجموعةَ خيارات، ثمّ
          يجد سطراً واحداً - فيبدو القسم ناقصاً لا مكتملاً. الخيار الواحد
          يقف بذاته، وشرحُه تحت اسمه حيث يخصّه. */}
      <div className="mt-8 border-t border-border pt-6">
        <ToggleRow
          label={tr("marketingToggle")}
          hint={tr("marketingHint")}
          checked={!marketingOptOut}
          onChange={(v) => setMarketingOptOut(!v)}
        />
      </div>

      {/* 🔴 **إعادة الجولة كانت تقف بجانب «احفظ» كأنّهما زوجان.** وهي
          ليست إعداداً يُحفَظ أصلاً: ضغطةٌ واحدة تفعل الفعل فوراً وتغادر
          الصفحة. وضعُها في صفّ الحفظ يوحي بأنّها اختيارٌ ينتظر تأكيداً،
          ويوحي عكسياً بأنّ «احفظ» يخصّ الجولة. الفعل الفوريّ في سطره،
          والحفظ وحده في صفّه. */}
      <div className="mt-6 border-t border-border pt-6">
        <FieldRowAction
          label={tr("tour")}
          hint={tr("tourHint")}
          actionLabel={tr("tourRestart")}
          onAction={async () => {
            await fetch("/api/onboarding/progress", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ step: 0, completed: false, dismissed: false }),
            });
            router.push("/dashboard");
          }}
        />
      </div>

      <div className="flex justify-end pt-2">
        <SaveButton onClick={handleSave} saving={saving} />
      </div>
    </SettingsSection>
  );
}

// ==================== الحسابات المرتبطة ====================

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  TIKTOK_ADS: "TikTok Ads",
};

function DisconnectButton({ platform }: { platform: string }) {
  const tr = useT();
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/connected-platforms/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });
    setDisconnecting(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-critical">{tr("sure")}</span>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="btn btn-danger btn-sm rounded-full"
        >
          {disconnecting ? tr("disconnecting") : tr("disconnect")}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-text-faint">
          {tr("cancel")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-verified/12 px-3 py-1 text-[12px] font-medium text-verified">
        {tr("connected")}
      </span>
      {/* رماديٌّ ساكنٌ يحمرّ عند التأشير: الفعلُ هدمٌ لا تنقّل، فلونُ الهوية
          كان يَعِد بشيءٍ آمن. و`focus:outline-none` **ليست** إلغاءً للتركيز -
          `focus-visible` تُبقيه لمن يتنقّل بلوحة المفاتيح، وتمنعه وحده عن
          الضغط بالفأرة حيث كان يرسم مستطيلاً حول النصّ بلا سبب. */}
      <button
        onClick={() => setConfirming(true)}
        className="rounded text-[12.5px] text-text-muted outline-none transition-colors hover:text-critical focus-visible:ring-2 focus-visible:ring-critical/40"
      >
        {tr("disconnectAccount")}
      </button>
    </div>
  );
}

function AccountsTab({ connectedPlatforms }: { connectedPlatforms: ConnectedPlatformData[] }) {
  const tr = useT();
  const connectedMap = new Map(connectedPlatforms.map((c) => [c.platform, c]));

  return (
    <SettingsSection icon={Plug} title={tr("tabAccounts")} description={tr("secAccountsDesc")}>
      {(["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"] as const).map((platform) => {
        const connection = connectedMap.get(platform);
        return (
          <div key={platform} className="card mb-3 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <PlatformLogo platform={platform} size={18} />
              <div>
              <div className="text-sm text-text-primary">{PLATFORM_LABELS[platform]}</div>
              {connection && (
                <div className="text-xs text-text-faint">
                  {connection.expiresAt ? tr("connectedExpires", { date: new Date(connection.expiresAt).toLocaleDateString() }) : tr("connected")}
                </div>
              )}
              </div>
            </div>
            {connection ? (
              <DisconnectButton platform={platform} />
            ) : (
              <a
                href={`/api/oauth/${platform === "GOOGLE_ADS" ? "google-ads" : platform === "META_ADS" ? "meta" : "tiktok"}/start`}
                className="btn btn-primary btn-sm rounded-full"
              >
                {tr("connectAccount")}
              </a>
            )}
            </div>

            {/* فحص الاتصال - يوضّح أين توقّف المسار بدل رسالة عامة */}
            {connection && (
              <div className="mt-3 border-t border-border pt-3">
                <ConnectionTester platform={platform} compact locale={useContext(SettingsLocaleContext)} />
              </div>
            )}
          </div>
        );
      })}
    </SettingsSection>
  );
}

// ==================== مساحة العمل ====================

function WorkspaceTab({
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
}: {
  workspaces: WorkspaceData[];
  activeWorkspaceId: string;
  onSwitchWorkspace: (id: string) => void;
}) {
  const tr = useT();
  // سياق اللغة موجود في هذا الملفّ أصلاً - نقرأه بدل تمرير خاصّية عبر طبقات
  const tabLocale = useContext(SettingsLocaleContext);
  const isOwner = useContext(OwnerContext);
  const router = useRouter();
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
  const [name, setName] = useState(workspace.name);
  const [currency, setCurrency] = useState(workspace.currency);
  const [targetLocation, setTargetLocation] = useState(workspace.targetLocation ?? "");
  const [profitMarginPct, setProfitMarginPct] = useState(workspace.profitMarginPct?.toString() ?? "");
  const [monthlyChangeCeilingPct, setMonthlyChangeCeilingPct] = useState(workspace.monthlyChangeCeilingPct.toString());
  const [facebookPageId, setFacebookPageId] = useState(workspace.facebookPageId ?? "");
  const [waPhoneNumberId, setWaPhoneNumberId] = useState(workspace.whatsappPhoneNumberId ?? "");
  const [waBusinessPhone, setWaBusinessPhone] = useState(workspace.whatsappBusinessPhone ?? "");
  const [googleAdsCustomerId, setGoogleAdsCustomerId] = useState(workspace.googleAdsCustomerId ?? "");
  const [linkCopied, setLinkCopied] = useState<string | null>(null);
  const [notifyUrgentByEmail, setNotifyUrgentByEmail] = useState(workspace.notifyUrgentByEmail);
  const [notifyHighByEmail, setNotifyHighByEmail] = useState(workspace.notifyHighByEmail);
  const [notificationEmail, setNotificationEmail] = useState(workspace.notificationEmail ?? "");
  // يُمرَّر من الخادم: المتصفّح لا يرى متغيّرات البيئة، وإخفاء الحقيقة عن
  // المستخدم هنا يعني أنّه يفعّل تنبيهات لا تصل ولا يعرف السبب أبداً.
  const emailEnabled = workspace.emailEnabled;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, currency, targetLocation,
        profitMarginPct: profitMarginPct ? Number(profitMarginPct) : null,
        monthlyChangeCeilingPct: Number(monthlyChangeCeilingPct) || 50,
        facebookPageId: facebookPageId || null,
        // الأرقام تُنظَّف من + والمسافات قبل الحفظ: نسخُها من واتساب أو
        // من لوحة Meta يجرّ معه هذه الرموز، وwa.me لا يقبلها.
        whatsappPhoneNumberId: waPhoneNumberId.replace(/[^0-9]/g, "") || null,
        whatsappBusinessPhone: waBusinessPhone.replace(/[^0-9]/g, "") || null,
        googleAdsCustomerId: googleAdsCustomerId.replace(/[^0-9]/g, "") || null,
        notifyUrgentByEmail, notifyHighByEmail,
        notificationEmail: notificationEmail || null,
      }),
    });

    // تبديل عملة مساحة العرض يُعيد بذرها بمعرّفٍ جديد، فلا يكفي تحديث
    // البيانات: الصفحة كلّها تُعاد لتقرأ المساحة الجديدة من الكوكي.
    const out = await res.json().catch(() => null);
    if (out?.reseeded) { window.location.reload(); return; }

    // 🔴 **الخطأ كان يُبتلَع.** الخادم يرفض تبديل العملة حين تأتي من حساب
    // إعلانيّ حقيقيّ، والواجهة تُنهي الحفظ وتُحدّث - فترتدّ القائمة إلى
    // القيمة القديمة بلا كلمة. من جهة المستخدم: «بختار الجنيه وبتثبت على
    // الريال». الرفض يظهر الآن حيث حدث.
    if (!res.ok) {
      setError(out?.error ?? tr("saveFailed"));
      setSaving(false);
      return;
    }
    setError("");

    setSaving(false);
    router.refresh();
  }

  return (
    <SettingsSection icon={Building2} title={tr("tabWorkspace")} description={tr("secWorkspaceDesc")}>
      {workspaces.length > 1 && (
        <WorkspaceSwitcher workspaces={workspaces} active={activeWorkspaceId} onSwitch={onSwitchWorkspace} />
      )}

      <FieldLabel>{tr("idxWorkspaceName")}</FieldLabel>
      <TextInput value={name} onChange={setName} placeholder={tr("wsNamePlaceholder")} />

      {/* ── العملة ────────────────────────────────────────────
          حالتان لا واحدة، لأنّ مصدر الرقم يختلف:

          • **حسابٌ إعلانيّ مربوط:** العملة وصلت مع البيانات نفسها، وجوجل
            وميتا تُثبتانها عند إنشاء الحساب ولا تسمحان بتبديلها. فتُعرَض
            ولا تُحرَّر - وقائمةٌ حرّة هنا كانت تُلصق لافتةً أخرى على المال
            نفسه بلا أن تحوّل ريالاً واحداً.
          • **مساحة عرض أو حسابٌ بلا ربط:** لا شيء يناقض الاختيار، فيُختار.
            وفي مساحة العرض تُعاد ولادة الأرقام بالعملة الجديدة **محوَّلةً**. */}
      <FieldLabel>{tr("idxCurrency")}</FieldLabel>
      {workspace.dataCurrency ? (
        <div className="mb-4">
          <div className="note border-border bg-surface-2 text-text-secondary">
            <span className="chip bg-accent/12 text-accent">{workspace.dataCurrency}</span>
            <span className="min-w-0 flex-1">{tr("currencyLockedNote")}</span>
          </div>
        </div>
      ) : (
        <>
          <Select
            locale={tabLocale}
            value={currency}
            onChange={setCurrency}
            ariaLabel={tr("idxCurrency")}
            className="mb-1.5"
            options={[
              { value: "SAR", label: tr("curSar") },
              { value: "EGP", label: tr("curEgp") },
              { value: "AED", label: tr("curAed") },
              { value: "KWD", label: tr("curKwd") },
              { value: "QAR", label: tr("curQar") },
              { value: "OMR", label: tr("curOmr") },
              { value: "BHD", label: tr("curBhd") },
              { value: "USD", label: tr("curUsd") },
              { value: "EUR", label: tr("curEur") },
              { value: "GBP", label: tr("curGbp") },
            ]}
          />
          <p className="mb-4 px-1 text-[11.5px] leading-relaxed text-text-faint">
            {workspace.isDemo ? tr("currencyDemoNote") : tr("currencyOpenNote")}
          </p>
        </>
      )}

      <FieldLabel>{tr("idxMarket")}</FieldLabel>
      <FieldHint>{tr("idxMarketHint")}</FieldHint>
      <Select
        locale={tabLocale}
        value={targetLocation}
        onChange={setTargetLocation}
        ariaLabel={tr("marketNone")}
        className="mb-4"
        options={[
          { value: "", label: tr("marketNone") },
          { value: "SA", label: tr("marketSa") },
          { value: "EG", label: tr("marketEg") },
          { value: "AE", label: tr("marketAe") },
          { value: "KW", label: tr("marketKw") },
        ]}
      />

      <FieldLabel>{tr("profitMargin")}</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">
        {tr("profitMarginHint")}
      </p>
      <input
        type="number"
        min="1"
        max="99"
        value={profitMarginPct}
        onChange={(e) => setProfitMarginPct(e.target.value)}
        placeholder={tr("egPlaceholder", { value: 30 })}
        className="field mb-4 w-full"
      />

      <FieldLabel>{tr("bidCeiling")}</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">
        {tr("bidCeilingHint")}
      </p>
      <input
        type="number"
        min="5"
        max="200"
        value={monthlyChangeCeilingPct}
        onChange={(e) => setMonthlyChangeCeilingPct(e.target.value)}
        className="field mb-4 w-full"
      />

      <FieldLabel>{tr("fbPageId")}</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">
        {tr("fbPageIdHint")}
      </p>
      <input
        type="text"
        value={facebookPageId}
        onChange={(e) => setFacebookPageId(e.target.value)}
        placeholder={tr("egPlaceholder", { value: "123456789012345" })}
        className="field mb-4 w-full"
      />

      <SettingsCard title={tr("waSection")}>
      <p className="mb-3 text-xs text-text-faint">{tr("waSectionHint")}</p>

      <FieldLabel>{tr("waPhoneNumberId")}</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">{tr("waPhoneNumberIdHint")}</p>
      <input
        type="text"
        value={waPhoneNumberId}
        onChange={(e) => setWaPhoneNumberId(e.target.value)}
        placeholder={tr("egPlaceholder", { value: "109876543210987" })}
        className="field mb-4 w-full"
      />

      <FieldLabel>{tr("waBusinessPhone")}</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">{tr("waBusinessPhoneHint")}</p>
      <input
        type="text"
        value={waBusinessPhone}
        onChange={(e) => setWaBusinessPhone(e.target.value)}
        placeholder={tr("egPlaceholder", { value: "9665XXXXXXXX" })}
        dir="ltr"
        className="field mb-4 w-full text-start"
      />

      <FieldLabel>{tr("waGoogleCustomerId")}</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">{tr("waGoogleCustomerIdHint")}</p>
      <input
        type="text"
        value={googleAdsCustomerId}
        onChange={(e) => setGoogleAdsCustomerId(e.target.value)}
        placeholder={tr("egPlaceholder", { value: "1234567890" })}
        dir="ltr"
        className="field mb-4 w-full text-start"
      />

      {/* الرابط يُولَّد هنا بمعرّف المساحة مدموجاً - نسخه ولصقه في الإعلان
          هو كلّ المطلوب. كتابته يدوياً كانت أوّل سبب لفشل التتبّع. */}
      <TrackerAdLink
        workspaceId={workspace.id}
        ready={Boolean(waPhoneNumberId.trim() && waBusinessPhone.trim())}
        copied={linkCopied}
        isOwner={isOwner}
        onCopied={(id) => {
          setLinkCopied(id);
          setTimeout(() => setLinkCopied(null), 2000);
        }}
      />

      </SettingsCard>

      <SettingsCard title={tr("alerts")}>
      <p className="mb-2 text-xs text-text-faint">
        {tr("alertsHint")}
      </p>
      {!emailEnabled && (
        <p className="card-ghost pad-sm mb-3 text-[11.5px] leading-relaxed text-gap">
          {tr("emailDisabled")}
        </p>
      )}
      <ToggleRow label={tr("emailUrgent")} checked={notifyUrgentByEmail} onChange={setNotifyUrgentByEmail} />
      <ToggleRow label={tr("emailHigh")} checked={notifyHighByEmail} onChange={setNotifyHighByEmail} />

      <div className="mb-2 mt-4 text-xs text-text-faint">{tr("pushHint")}</div>
      <div className="mb-4"><PushNotificationToggle locale={tabLocale} /></div>

      <FieldLabel>{tr("alertEmail")}</FieldLabel>
      <TextInput value={notificationEmail} onChange={setNotificationEmail} placeholder="you@example.com" />

      <FieldLabel>{tr("idxCampaigns")}</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">
        {tr("linkedCampaignsHint")}
      </p>
      <CampaignPicker workspaceId={workspace.id} />

      </SettingsCard>

      <div className="mt-4">
        <SaveButton onClick={handleSave} saving={saving} />
      </div>
    </SettingsSection>
  );
}

/**
 * رابط الإعلان جاهزاً للنسخ.
 *
 * كتابته يدوياً كانت أوّل أسباب فشل التتبّع: معرّف مساحة عمل ناقص حرفاً،
 * أو `{gclid}` مكتوبة `{{gclid}}`، تُنتج رابطاً يعمل بصرياً - يفتح واتساب
 * عادي - لكنه لا يسجّل شيئاً. فالمستخدم يظنّ التتبّع شغّالاً وهو ليس كذلك.
 * توليده هنا يزيل الفئة كلّها.
 */
function TrackerAdLink({
  workspaceId,
  ready,
  copied,
  onCopied,
  isOwner,
}: {
  workspaceId: string;
  ready: boolean;
  /** معرّف الرابط المنسوخ للتوّ - زرّان الآن، فالقيمة المنطقية لا تكفي */
  copied: string | null;
  onCopied: (id: string) => void;
  /** مالك المنتج وحده يرى العطب التقنيّ باسمه - هو من يملك إصلاحه */
  isOwner: boolean;
}) {
  const tr = useT();
  const base = process.env.NEXT_PUBLIC_TRACKER_BASE_URL;
  // 🔴 **رابطان لا رابط واحد - والسبب أنّ المنصّات لا تتصرّف بالطريقة نفسها.**
  //
  // كان المولَّد واحداً بصيغة جوجل (`?gclid={gclid}`) للجميع، فمن يعلن على
  // ميتا ينسخه كما هو: ميتا لا تعرف هذا الماكرو فيصل **حرفياً**، والمتتبّع
  // كان يراه قيمةً موجودة فيسجّل **نقرة ميتا على أنّها نقرة جوجل** بمعرّفٍ
  // مخترَع - تلويثٌ لطبقة الحقيقة نفسها، أسوأ من ألّا يُسجَّل شيء.
  //
  // والصحيح بحسب توثيق كلّ منصّة: جوجل وحدها لا تُلحق المعرّف تلقائياً
  // فتحتاج الماكرو صراحةً؛ وميتا وتيك توك وسناب تُلحقه بنفسها، وإضافته
  // يدوياً عندها تُنتج نسخةً مكرّرة تُضعف الإسناد. فالرابط الثاني **بلا
  // أيّ ماكرو** - وهو ليس نقصاً بل هو الصواب.
  const root = base ? `${base.replace(/\/$/, "")}/api/track-click?ws=${workspaceId}` : null;
  const googleLink = root ? `${root}&gclid={gclid}` : null;
  const link = root;

  // كلّ حالة تقول ما الناقص وأين يُضبط، لا "غير متاح" وتصمت.
  //
  // 🔴 **لكنّ «ما الناقص» يختلف باختلاف مَن يقرأ.**
  //
  // `NEXT_PUBLIC_TRACKER_BASE_URL` متغيّرُ بيئةٍ **واحد على النشر كلّه**،
  // لا إعدادٌ لكلّ مشترك: المتتبّع متعدّد المستأجرين يعرف صاحب الرسالة من
  // قاعدة البيانات المشتركة عبر `phone_number_id`. أي أنّ ضبطه عملُ مالك
  // المنتج مرّةً واحدة، لا عملُ المشترك أبداً.
  //
  // وكانت الرسالة تُعرض للجميع باسم المتغيّر: يقرأ المشترك اسم متغيّرٍ
  // برمجيّ وإحالةً إلى «دليل تفعيل» لا يملكه ولا يستطيع فعل شيء حياله -
  // عطبٌ في منتجنا معروضٌ عليه كأنّه نقصٌ في إعداده هو.
  if (!ready || !link) {
    const ownerProblem = !base;
    return (
      <div className="mb-4 surface-0/50 p-3.5">
        <div className="mb-1 text-[12.5px] font-medium text-text-primary">{tr("waLinkTitle")}</div>
        <p className="text-[11.5px] leading-relaxed text-text-faint">
          {ownerProblem
            ? isOwner
              ? tr("waLinkNeedsBase")
              : tr("waLinkUnavailable")
            : tr("waLinkNeedsSetup")}
        </p>
      </div>
    );
  }

  const rows: Array<{ id: string; label: string; why: string; url: string }> = [
    { id: "google", label: tr("waLinkGoogle"), why: tr("waLinkGoogleWhy"), url: googleLink! },
    { id: "rest", label: tr("waLinkOthers"), why: tr("waLinkOthersWhy"), url: link },
  ];

  return (
    <div className="mb-4 rounded-xl border border-accent/30 bg-accent/[0.06] p-3.5">
      <div className="mb-1 text-[12.5px] font-medium text-text-primary">{tr("waLinkTitle")}</div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-muted">{tr("waLinkHint")}</p>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id}>
            <div className="mb-1 text-[11.5px] font-medium text-text-primary">{row.label}</div>
            {/* السبب بجوار الرابط لا في دليلٍ منفصل: من ينسخ رابطاً بلا
                ماكرو يظنّه ناقصاً ويضيفه بنفسه - فيكسر ما جاء ليصلحه. */}
            <p className="mb-1.5 text-[11px] leading-relaxed text-text-faint">{row.why}</p>
            <div className="flex items-center gap-2">
              <code
                dir="ltr"
                className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-surface px-2.5 py-2 font-mono text-[11.5px] text-text-primary"
              >
                {row.url}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(row.url);
                  onCopied(row.id);
                }}
                className="btn btn-primary shrink-0"
              >
                {copied === row.id ? tr("waCopied") : tr("waCopy")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignPicker({ workspaceId }: { workspaceId: string }) {
  const tr = useT();
  // إصلاح خلل أساسي: كان المكوّن مقصوراً على GOOGLE_ADS منذ البداية -
  // أي أن ميتا وتيك توك لم يكن أحد يستطيع ربط حملاتهما من الواجهة إطلاقاً،
  // رغم أن كل المزامنة والتحليل مبنيان على افتراض وجود CampaignLink لهما
  const [platform, setPlatform] = useState<"GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS">("GOOGLE_ADS");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<
    Array<{ accountId: string; accountName: string; campaigns: Array<{ id: string; name: string; status: string; recentlyActive: boolean }> }>
  >([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [saved, setSaved] = useState(false);

  const PLATFORM_TABS: Array<{ value: typeof platform; label: string }> = [
    { value: "GOOGLE_ADS", label: tr("platGoogle") },
    { value: "META_ADS", label: tr("platMeta") },
    { value: "TIKTOK_ADS", label: tr("platTiktok") },
  ];

  function switchPlatform(next: typeof platform) {
    setPlatform(next);
    // نصفّر الحالة عند تغيير المنصة - القائمة تخصّ منصة أخرى تماماً، فلا
    // معنى لإبقاء الاختيار السابق أو عرض بيانات المنصة القديمة خطأً
    setAccounts([]);
    setSelected(new Set());
    setSaved(false);
  }

  async function loadCampaigns() {
    setLoading(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/available-campaigns?platform=${platform}`);
    if (res.ok) {
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    }
    setLoading(false);
  }

  async function saveCampaigns() {
    const campaigns = accounts.flatMap((acc) =>
      acc.campaigns
        .filter((c) => selected.has(c.id))
        .map((c) => ({
          platform,
          externalAccountId: acc.accountId,
          externalCampaignId: c.id,
          campaignName: c.name,
        }))
    );

    await fetch(`/api/workspaces/${workspaceId}/campaign-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaigns }),
    });
    setSaved(true);
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {PLATFORM_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => switchPlatform(tab.value)}
            className={`rounded-full px-3 py-1.5 text-xs ${
              platform === tab.value ? "bg-accent text-white" : "bg-surface-raised text-text-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {accounts.length === 0 ? (
        <button
          onClick={loadCampaigns}
          disabled={loading}
          className="btn btn-secondary btn-sm"
        >
          {loading ? tr("loadingCampaigns") : tr("loadCampaigns")}
        </button>
      ) : (
        <CampaignPickerList
          accounts={accounts}
          selected={selected}
          setSelected={setSelected}
          showAll={showAll}
          setShowAll={setShowAll}
          saved={saved}
          saveCampaigns={saveCampaigns}
        />
      )}
    </div>
  );
}

function CampaignPickerList({
  accounts,
  selected,
  setSelected,
  showAll,
  setShowAll,
  saved,
  saveCampaigns,
}: {
  accounts: Array<{ accountId: string; accountName: string; campaigns: Array<{ id: string; name: string; status: string; recentlyActive: boolean }> }>;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  showAll: boolean;
  setShowAll: (fn: (s: boolean) => boolean) => void;
  saved: boolean;
  saveCampaigns: () => void;
}) {
  const tr = useT();
  const totalCount = accounts.reduce((s, a) => s + a.campaigns.length, 0);
  const activeCount = accounts.reduce((s, a) => s + a.campaigns.filter((c) => c.recentlyActive).length, 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-text-faint">
          {showAll ? tr("showAllCampaigns", { n: totalCount }) : tr("activeLast10", { n: activeCount })}
        </p>
        {totalCount > activeCount && (
          <button
            onClick={() => setShowAll((s) => !s)}
            className="text-xs text-accent"
          >
            {showAll ? tr("hideOld") : tr("showMore", { n: totalCount - activeCount })}
          </button>
        )}
      </div>

      {accounts.map((acc) => {
        const visibleCampaigns = showAll ? acc.campaigns : acc.campaigns.filter((c) => c.recentlyActive);
        if (visibleCampaigns.length === 0) return null;

        return (
          <div key={acc.accountId} className="mb-3">
            <div className="mb-1.5 text-xs font-medium text-text-muted">{acc.accountName}</div>
            {visibleCampaigns.map((c) => (
              <label key={c.id} className="flex items-center gap-2 py-1 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(c.id);
                    else next.delete(c.id);
                    setSelected(next);
                  }}
                />
                {c.name}
                {!c.recentlyActive && <span className="text-xs text-text-faint">{tr("notRecentlyActive")}</span>}
              </label>
            ))}
          </div>
        );
      })}
      <button onClick={saveCampaigns} className="btn btn-primary btn-sm mt-2 rounded-full">
        {saved ? tr("savedTick") : tr("saveSelection")}
      </button>
      <p className="mt-2 text-xs text-text-faint">
        {tr("historyNote")}
      </p>
    </div>
  );
}

function WorkspaceSwitcher({
  workspaces,
  active,
  onSwitch,
}: {
  workspaces: WorkspaceData[];
  active: string;
  onSwitch: (id: string) => void;
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const current = workspaces.find((w) => w.id === active) ?? workspaces[0];

  // الإغلاق بالضغط خارجه: قائمةٌ تبقى مفتوحة بعد أن يُصرَف النظر عنها
  // تغطّي ما تحتها، فيضغط المستخدم عليها وهو يقصد ما وراءها.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // لوحةٌ مبوَّبة (قائمة اختيار) تعيش في `<body>` لا في شجرتنا،
      // فدوستُها تُقرأ «خارجاً» وتُغلق ما هي بداخله. راجع `Select.tsx`.
      const target = e.target as HTMLElement;
      if (target.closest?.("[data-portal-panel]")) return;
      if (!boxRef.current?.contains(target)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    // 🔴 **كانت كبسولاتٍ مصفوفة، واحدةٌ لكلّ مساحة.**
    //
    // وهي تعمل عند اثنتين وتنهار عند عشر: صفٌّ يطول حتى يلتفّ أو يخرج من
    // الشاشة. والأهمّ أنّها **لا تقول أين أنت** إلّا بالتلوين - فالمساحة
    // النشطة والمساحات الأخرى معروضةٌ بالوزن نفسه، بينما السؤال الأوّل
    // دائماً «أرقام مَن هذه؟».
    //
    // القائمة تجيبه قبل أن يُفتَح شيء: المساحة الحالية وحدها ظاهرة، وما
    // عداها خلف ضغطة. وهي لا تطول مهما بلغ العدد.
    <div ref={boxRef} className="relative mb-5 max-w-sm">
      <div className="mb-1.5 text-[12px] font-medium text-text-muted">{tr("wsCurrent")}</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-start transition-colors hover:border-border-visible"
      >
        <WorkspaceMark name={current.name} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-primary">
          {current.name}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="pop-shadow absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-surface p-1.5"
        >
          {workspaces.map((w) => {
            const on = w.id === active;
            return (
              <button
                key={w.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  onSwitch(w.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors ${
                  on ? "bg-surface-raised" : "hover:bg-surface-raised"
                }`}
              >
                <WorkspaceMark name={w.name} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{w.name}</span>
                {on && (
                  <span className="shrink-0 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent">
                    {tr("wsCurrentChip")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** أوّل حرفٍ في مربّع - يميّز المساحات في القائمة قبل قراءة الاسم.
 *  `bdi` لأنّ الحرف قد يكون عربياً في واجهةٍ إنجليزية أو العكس. */
function WorkspaceMark({ name }: { name: string }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-[12px] font-semibold uppercase text-accent">
      <bdi>{name.trim().charAt(0) || "?"}</bdi>
    </span>
  );
}

// ==================== التحكم والأتمتة ====================

function AutomationTab({
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
}: {
  workspaces: WorkspaceData[];
  activeWorkspaceId: string;
  onSwitchWorkspace: (id: string) => void;
}) {
  const router = useRouter();
  const tr = useT();
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  const [form, setForm] = useState({
    enableAIInsights: workspace.enableAIInsights,
    enableAutomationRules: workspace.enableAutomationRules,
    enableDailyDiagnostics: workspace.enableDailyDiagnostics,
    enablePricingHealthChecks: workspace.enablePricingHealthChecks,
    useModeledAttribution: workspace.useModeledAttribution,
    responseTimeThresholdMinutes: workspace.responseTimeThresholdMinutes,
    messengerInactivityThresholdMinutes: workspace.messengerInactivityThresholdMinutes,
    primaryConversionSource: workspace.primaryConversionSource,
    adFatigueFrequencyThreshold: workspace.adFatigueFrequencyThreshold,
    ctrDropThresholdPct: workspace.ctrDropThresholdPct,
    pricingWarningThresholdPct: workspace.pricingWarningThresholdPct,
    pricingCriticalThresholdPct: workspace.pricingCriticalThresholdPct,
    rtoAnomalyMultiplier: workspace.rtoAnomalyMultiplier,
    automationMonthlyBudgetChangeCeilingPct: workspace.automationMonthlyBudgetChangeCeilingPct ?? 50,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    // تبديل عملة مساحة العرض يُعيد بذرها بمعرّفٍ جديد، فلا يكفي تحديث
    // البيانات: الصفحة كلّها تُعاد لتقرأ المساحة الجديدة من الكوكي.
    const out = await res.json().catch(() => null);
    if (out?.reseeded) { window.location.reload(); return; }
    if (!res.ok) {
      setError(out?.error ?? tr("saveFailed"));
      setSaving(false);
      return;
    }
    setError("");

    setSaving(false);
    router.refresh();
  }

  return (
    <SettingsSection icon={Zap} title={tr("tabAutomation")} description={tr("secAutomationDesc")}>
      {workspaces.length > 1 && (
        <WorkspaceSwitcher workspaces={workspaces} active={activeWorkspaceId} onSwitch={onSwitchWorkspace} />
      )}

      <SettingsCard title={tr("switches")}>
      <ToggleRow
        label={tr("swAi")}
        hint={tr("swAiHint")}
        checked={form.enableAIInsights}
        onChange={(v) => setForm({ ...form, enableAIInsights: v })}
      />
      <ToggleRow
        label={tr("swRules")}
        hint={tr("swRulesHint")}
        checked={form.enableAutomationRules}
        onChange={(v) => setForm({ ...form, enableAutomationRules: v })}
      />
      <ToggleRow
        label={tr("swDaily")}
        hint={tr("swDailyHint")}
        checked={form.enableDailyDiagnostics}
        onChange={(v) => setForm({ ...form, enableDailyDiagnostics: v })}
      />
      <ToggleRow
        label={tr("swPricing")}
        hint={tr("swPricingHint")}
        checked={form.enablePricingHealthChecks}
        onChange={(v) => setForm({ ...form, enablePricingHealthChecks: v })}
      />
      <ToggleRow
        label={tr("swModeled")}
        hint={tr("swModeledHint")}
        checked={form.useModeledAttribution}
        onChange={(v) => setForm({ ...form, useModeledAttribution: v })}
      />

      </SettingsCard>

      <SettingsCard title={tr("thresholdsHead")}>
      <NumberRow
        label={tr("thResponse")}
        hint={tr("thResponseHint")}
        suffix={tr("unitMinutes")}
        value={form.responseTimeThresholdMinutes}
        onChange={(v) => setForm({ ...form, responseTimeThresholdMinutes: v })}
      />
      <NumberRow
        label={tr("thFatigue")}
        hint={tr("thFatigueHint")}
        value={form.adFatigueFrequencyThreshold}
        step={0.1}
        onChange={(v) => setForm({ ...form, adFatigueFrequencyThreshold: v })}
      />
      <NumberRow
        label={tr("thMessenger")}
        hint={tr("thMessengerHint")}
        suffix={tr("unitMinutes")}
        value={form.messengerInactivityThresholdMinutes}
        onChange={(v) => setForm({ ...form, messengerInactivityThresholdMinutes: v })}
      />

      {/* 🔴 **كان مكتوباً كعنوان مجموعة** (حرفٌ كبير، رماديّ باهت)، وتحته
          الكبسولات، ثمّ تتبعه خمسة حدود عددية **بلا عنوانٍ خاصّ بها**.
          فتقرأ العين: «اختر واتساب، ثمّ اضبط ما تحته» - بينما هو اختيارٌ
          واحد لا يحكم شيئاً ممّا بعده. وهو ما قاله المالك بالحرف: «عاملة
          زي كأني بختار كل حاجة وأظبط تحتها، مش كأني بختار أنهي فيهم».
          صار حقلاً باسمه وشرحِه وأداتِه - أي بالبنية نفسها التي لكلّ حقل
          آخر في الصفحة، فيُقرأ واحداً منها لا عنواناً لها. */}
      <div className="mt-8 border-t border-border pt-6">
        <FieldLabel>{tr("primarySourceHead")}</FieldLabel>
        <FieldHint>{tr("primarySourceHint")}</FieldHint>
        <div className="mb-4">
          <OptionGroup
            options={[
              { value: "WHATSAPP", label: tr("srcWhatsapp") },
              { value: "MESSENGER", label: tr("srcMessenger") },
              { value: "LEAD_FORM", label: tr("srcLeadForm") },
            ]}
            value={form.primaryConversionSource}
            onChange={(v) => setForm({ ...form, primaryConversionSource: v })}
          />
        </div>
      </div>

      {/* الحدود التي كانت تقع تحت الاختيار تعود إلى مجموعتها: كانت ثلاثة
          فوقه وخمسة تحته، فبدت مجموعتين يفصل بينهما إعدادٌ لا يخصّ أيّاً منهما. */}
      </SettingsCard>

      <SettingsCard title={tr("thresholdsMoreHead")}>
      <NumberRow
        label={tr("thCtr")}
        hint={tr("thCtrHint")}
        suffix={"%"}
        value={form.ctrDropThresholdPct}
        onChange={(v) => setForm({ ...form, ctrDropThresholdPct: v })}
      />
      <NumberRow
        label={tr("thPriceWarn")}
        suffix={"%"}
        value={form.pricingWarningThresholdPct}
        onChange={(v) => setForm({ ...form, pricingWarningThresholdPct: v })}
      />
      <NumberRow
        label={tr("thPriceCrit")}
        suffix={"%"}
        value={form.pricingCriticalThresholdPct}
        onChange={(v) => setForm({ ...form, pricingCriticalThresholdPct: v })}
      />
      <NumberRow
        label={tr("thRto")}
        value={form.rtoAnomalyMultiplier}
        step={0.1}
        onChange={(v) => setForm({ ...form, rtoAnomalyMultiplier: v })}
      />
      <NumberRow
        label={tr("thCeiling")}
        hint={tr("thCeilingHint")}
        suffix={"%"}
        value={form.automationMonthlyBudgetChangeCeilingPct}
        onChange={(v) => setForm({ ...form, automationMonthlyBudgetChangeCeilingPct: v })}
      />

      </SettingsCard>

      <div className="mt-4">
        <SaveButton onClick={handleSave} saving={saving} />
      </div>
    </SettingsSection>
  );
}

/** تغيير كلمة المرور - **بالحالية شرطاً، ولو كانت الجلسة قائمة.**
 *
 *  الجلسة تثبت أنّ هذا المتصفّح دخل يوماً ما، لا أنّ الجالس أمامه الآن هو
 *  صاحب الحساب. جهازٌ مفتوحٌ في مكتب يكفي لتغيير كلمة المرور وقفلِ صاحبها
 *  خارج حسابه، ولذلك تُطلَب الحالية. المنطق كلّه في المسار الخلفيّ؛ وهذه
 *  الواجهة لا تحرس شيئاً - تشرح فقط لماذا تُطلَب. */
function ChangePasswordFields() {
  const tr = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const locale = useContext(SettingsLocaleContext);

  // التطابق يُفحَص هنا لا في الخادم: خطأٌ في إعادة الكتابة ليس شأناً أمنياً
  // بل زلّةُ لوحة مفاتيح، وردُّها فوراً أسرع من رحلةٍ إلى الخادم وأوضح.
  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;
  const ready = current.length > 0 && next.length >= 8 && next === confirm && !busy;

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: tr("pwChanged") });
      setCurrent("");
      setNext("");
      setConfirm("");
    } else {
      setMsg({ ok: false, text: t(locale, data?.errorKey ?? "api.genericError") });
    }
  }

  return (
    <div>
      <div className="mb-1 text-[13px] font-medium text-text-primary">{tr("pwTitle")}</div>
      <p className="mb-3 text-[12px] leading-5 text-text-muted">{tr("pwHint")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel>{tr("pwCurrent")}</FieldLabel>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className="field w-full"
          />
        </div>
        <div>
          <FieldLabel>{tr("pwNew")}</FieldLabel>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className="field w-full"
          />
          {tooShort && <p className="mt-1 text-[11px] text-gap">{tr("pwTooShort")}</p>}
        </div>
        <div>
          <FieldLabel>{tr("pwConfirm")}</FieldLabel>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="field w-full"
          />
          {mismatch && <p className="mt-1 text-[11px] text-critical">{tr("pwMismatch")}</p>}
        </div>
      </div>

      {msg && (
        <p className={`mt-3 text-[12px] ${msg.ok ? "text-verified" : "text-critical"}`}>
          {msg.text}
        </p>
      )}

      <button onClick={submit} disabled={!ready} className="btn btn-primary btn-sm mt-3">
        {busy ? tr("pwSaving") : tr("pwSave")}
      </button>
    </div>
  );
}

/** إبطال كل جلسة مفتوحة فوراً - نفس آلية تسجيل الخروج العادي بالظبط
 *  (`sessionInvalidatedAt`)، لكن مستدعاة عمداً كإجراء طوارئ من صاحب
 *  لوحة تحكم شاملة يشكّ إن حسابه اتفتح من حد غيره. بيسجّل خروج الجهاز
 *  ده كمان - ده مقصود، مش عيب: أي توكن أصدر قبل اللحظة دي بيترفض. */
function SignOutEverywhereField() {
  const tr = useT();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!window.confirm(tr("signOutConfirm"))) return;
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST", headers: getCsrfHeader() });
    window.location.href = "/login";
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="mb-1 text-[13px] font-medium text-text-primary">{tr("signOutTitle")}</div>
      <p className="mb-3 text-[12px] leading-5 text-text-muted">{tr("signOutHint")}</p>
      <button onClick={submit} disabled={busy} className="btn btn-danger btn-sm">
        {tr("signOutButton")}
      </button>
    </div>
  );
}

function MfaFields() {
  const tr = useT();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  /** الأكواد الصريحة - في الذاكرة فقط ولحظةَ توليدها. */
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  /** 🔴 **«حفظتها» لا تُصدَّق بلا فعل.**
   *
   *  الزرّ كان يُغلق اللوحة فوراً، والأكواد لا تُعرَض مرّةً ثانية أبداً
   *  (المخزَّن مجزّأ). فضغطةٌ بالغلط - أو استعجالٌ - تكلّف المستخدم
   *  أوراقه كلّها، ولا يكتشف ذلك إلّا يوم يفقد هاتفه.
   *
   *  فلا يُفتَح الزرّ إلّا بعد نسخٍ أو تنزيلٍ فعليّ. وهو ليس تعطيلاً
   *  للطريق: الطريق نفسه هو النسخ، والزرّ إقرارٌ بما جرى لا بديلٌ عنه. */
  const [codesTaken, setCodesTaken] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/mfa/status")
      .then((res) => res.json())
      .then((data) => setEnabled(data.enabled));
  }, []);

  // عدّ المتبقّي: من استهلك أوراقه دون أن يدري يبقى بلا شبكة أمان وهو
  // يظنّ العكس - والعدد وحده يكفي لتنبيهه.
  useEffect(() => {
    if (!enabled) return;
    fetch("/api/auth/mfa/backup-codes")
      .then((res) => res.json())
      .then((d) => setRemaining(typeof d.remaining === "number" ? d.remaining : null))
      .catch(() => setRemaining(null));
  }, [enabled]);

  async function regenerate() {
    setLoading(true);
    const res = await fetch("/api/auth/mfa/backup-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok && Array.isArray(data.backupCodes)) {
      setBackupCodes(data.backupCodes);
      setCodesTaken(false);
      // العدّاد لا يتغيّر بعد: الجديدة معلَّقة والقديمة عاملة، والرقم
      // المعروض هو ما يملكه فعلاً إلى أن يُقرّ.
    }
  }

  /** الإقرار: هنا تُبطَل القديمة وتُفعَّل الجديدة في الخادم. */
  async function confirmCodesSaved() {
    await fetch("/api/auth/mfa/backup-codes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
    }).catch(() => {});
    setRemaining(backupCodes?.length ?? null);
    setBackupCodes(null);
    setCodesTaken(false);
  }

  function downloadCodes() {
    if (!backupCodes) return;
    const nl = String.fromCharCode(10);
    const blob = new Blob([backupCodes.join(nl) + nl], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "adloop-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
    setCodesTaken(true);
  }

  async function startSetup() {
    setLoading(true);
    const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setSetupData(data);
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/mfa/verify-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ secret: setupData?.secret, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setEnabled(true);
    setSetupData(null);
    // 🔴 تُعرَض مرّةً واحدة: المخزَّن مجزّأٌ لا نصّ، فلا سبيل لإظهارها بعد
    // إغلاق هذه اللوحة - ولا حتى لنا.
    if (Array.isArray(data.backupCodes)) {
      setBackupCodes(data.backupCodes);
      setRemaining(data.backupCodes.length);
    }
    setCode("");
  }

  async function handleDisable() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/mfa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setEnabled(false);
    setShowDisableConfirm(false);
    setPassword("");
  }

  if (enabled === null) return null;

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[13px] font-medium text-text-primary">{tr("mfaTitle")}</span>
        {/* الحالة تُقرأ قبل الزرّ: «مفعّل» أو «غير مفعّل» هي الجواب على
            السؤال الذي يأتي المستخدم يحمله، والزرّ فعلٌ بعده. */}
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            enabled ? "bg-verified/12 text-verified" : "bg-surface-raised text-text-muted"
          }`}
        >
          {enabled ? tr("mfaOn") : tr("mfaOff")}
        </span>
      </div>
      <p className="mb-3 text-[12px] leading-5 text-text-muted">{tr("mfaHint")}</p>

      {/* 🔴 **نافذةٌ لا لوحةٌ في مجرى الصفحة.**
       *
       * الأكواد تُعرَض **مرّةً واحدة**: المخزَّن بصمةٌ لا نصّ، فمن أغلق دون
       * أن ينسخ فقدها إلى الأبد. ولوحةٌ صفراء بين بقيّة الإعدادات تُمرَّر
       * بالعين كتنبيهٍ آخر، بينما النافذة تحجب ما وراءها فلا تُغلَق إلّا
       * بقرار.
       *
       * وإلى `document.body` عبر بوّابة: الدرس المدفوع ثمنه في اختيار
       * الحملات - عنصرٌ داخل شجرةٍ لها سياق تكديسٍ خاصّ لا يعلوها مهما بلغ
       * رقم طبقته. */}
      {backupCodes && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="flex items-start gap-3 border-b border-border p-5">
              <span className="icon-badge mt-0.5 h-9 w-9 shrink-0 bg-gap/12 text-gap">
                <ShieldCheck size={17} />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-text-primary">{tr("bcTitle")}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{tr("bcHint")}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-2">
              {backupCodes.map((c) => (
                <code
                  key={c}
                  className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-center font-mono text-[13px] tracking-wider text-text-primary"
                >
                  {c}
                </code>
              ))}
            </div>

            <p className="px-5 pb-1 text-[11.5px] leading-relaxed text-text-faint">
              {codesTaken ? tr("bcOldStillValid") : tr("bcTakeFirst")}
            </p>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(backupCodes.join(String.fromCharCode(10)));
                  setCodesTaken(true);
                }}
                className="btn btn-secondary btn-sm"
              >
                {tr("bcCopy")}
              </button>
              {/* التنزيل بديلٌ عن النسخ لا زينة: حافظةٌ تُمسح بعد دقائق،
                  وملفٌّ يبقى. وأحدهما يكفي لفتح زرّ الإقرار. */}
              <button onClick={downloadCodes} className="btn btn-secondary btn-sm">
                {tr("bcDownload")}
              </button>
              {/* لا زرَّ إغلاقٍ صامت (X) ولا إغلاقَ بالنقر خارجها: الإغلاق
                  هنا يعني فقدَ الأكواد، فيكون بإقرارٍ صريح لا بحركةٍ عابرة.
                  ولا يُفتَح الإقرار قبل نسخٍ أو تنزيلٍ فعليّ. */}
              <button
                onClick={confirmCodesSaved}
                disabled={!codesTaken}
                title={codesTaken ? undefined : tr("bcTakeFirst")}
                className="btn btn-primary btn-sm"
              >
                {tr("bcSaved")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* عدّادُ المتبقّي: من استهلك أوراقه لا يعرف ذلك إلّا حين يحتاجها */}
      {enabled && !backupCodes && remaining !== null && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
          <span className={remaining <= 2 ? "font-medium text-gap" : "text-text-muted"}>
            {tr("bcRemaining", { n: remaining })}
          </span>
          <button
            onClick={regenerate}
            disabled={loading}
            className="text-[12px] text-accent transition-colors hover:text-text-primary"
          >
            {tr("bcRegenerate")}
          </button>
        </div>
      )}

      {enabled ? (
        !showDisableConfirm ? (
          <button
            onClick={() => setShowDisableConfirm(true)}
            // زرٌّ يُطفئ حمايةً: يُقرأ خطراً عند الاقتراب لا سطراً رمادياً ساكناً.
            className="rounded-full border border-border bg-surface-raised px-4 py-1.5 text-xs text-text-muted transition-colors hover:border-critical/40 hover:bg-critical/10 hover:text-critical"
          >
            {tr("mfaDisable")}
          </button>
        ) : (
          <div>
            <p className="mb-2 text-xs text-text-faint">{tr("mfaPasswordConfirm")}</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field mb-2 w-full"
            />
            {error && <p className="mb-2 text-xs text-critical">{error}</p>}
            <button
              onClick={handleDisable}
              disabled={loading}
              className="btn btn-danger btn-sm rounded-full"
            >
              {tr("mfaConfirmDisable")}
            </button>
          </div>
        )
      ) : setupData ? (
        <form onSubmit={confirmSetup}>
          <img src={setupData.qrCodeDataUrl} alt="QR Code" className="mb-2 h-40 w-40 rounded-xl bg-white p-2" />
          <p className="mb-2 text-xs text-text-faint">
            {tr("mfaScanHint")}
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="field mb-2 w-full text-center text-lg tracking-widest"
          />
          {error && <p className="mb-2 text-xs text-critical">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-sm rounded-full"
          >
            {loading ? tr("mfaVerifying") : tr("mfaEnable")}
          </button>
        </form>
      ) : (
        <button
          onClick={startSetup}
          disabled={loading}
          className="btn btn-primary btn-sm rounded-full"
        >
          {loading ? tr("mfaLoading") : tr("mfaTurnOn")}
        </button>
      )}
    </div>
  );
}

// ==================== منطقة الخطر ====================

function DangerZoneTab({ workspaces }: { workspaces: WorkspaceData[] }) {
  const tr = useT();
  const tabLocale = useContext(SettingsLocaleContext);
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [targetId, setTargetId] = useState(workspaces[0]?.id ?? "");
  const target = workspaces.find((w) => w.id === targetId);

  async function handleDelete() {
    if (!target || confirmText !== target.name) return;
    await fetch(`/api/workspaces/${target.id}`, { method: "DELETE", headers: getCsrfHeader() });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <SettingsSection icon={TriangleAlert} title={tr("tabDanger")} description={tr("secDangerDesc")}>
      <div className="note border-critical/35 bg-critical/10 p-4">
        <div className="mb-2 text-sm font-medium text-critical">{tr("dzDeleteWorkspace")}</div>
        <p className="mb-3 text-xs text-text-muted">
          {tr("dzDeleteWorkspaceHint")}
        </p>
        <Select
          locale={tabLocale}
          value={targetId}
          onChange={setTargetId}
          ariaLabel={tr("dzDeleteWorkspace")}
          className="mb-2"
          options={workspaces.map((w) => ({ value: w.id, label: w.name }))}
        />
        <p className="mb-2 text-xs text-text-faint">{tr("dzTypeName", { name: target?.name ?? "" })}</p>
        <TextInput value={confirmText} onChange={setConfirmText} placeholder={target?.name ?? ""} />
        <button
          onClick={handleDelete}
          disabled={confirmText !== target?.name}
          className="btn btn-danger btn-sm mt-2 rounded-full"
        >
          {tr("dzDeleteForever")}
        </button>
      </div>

      <div className="card mt-4 p-4">
        <div className="mb-2 text-sm font-medium text-text-primary">{tr("dzExport")}</div>
        <p className="mb-3 text-xs text-text-muted">
          {tr("dzExportHint")}
        </p>
        <a
          href="/api/account/export-data"
          className="btn btn-secondary btn-sm inline-block"
        >
          {tr("dzDownload")}
        </a>
      </div>

      <DeleteAccountSection />
    </SettingsSection>
  );
}

function DeleteAccountSection() {
  const tr = useT();
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function handleDeleteAccount() {
    setError("");
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = "/login";
    } else {
      const data = await res.json();
      setError(data.error ?? tr("genericError"));
    }
  }

  return (
    <div className="note mt-4 border-critical/35 bg-critical/10 p-4">
      <div className="mb-2 text-sm font-medium text-critical">{tr("dzDeleteAccount")}</div>
      <p className="mb-3 text-xs text-text-muted">
        {tr("dzDeleteAccountHint")}
      </p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="btn btn-danger btn-sm rounded-full"
        >
          {tr("dzDeleteMine")}
        </button>
      ) : (
        <div>
          <p className="mb-2 text-xs text-text-faint">{tr("mfaPasswordConfirm")}</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field mb-2 w-full"
          />
          {error && <p className="mb-2 text-xs text-critical">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleDeleteAccount}
              className="btn btn-danger btn-sm rounded-full"
            >
              {tr("dzConfirmDelete")}
            </button>
            <button
              onClick={() => setConfirming(false)}
              // زرٌّ يُطفئ حمايةً: يُقرأ خطراً عند الاقتراب لا سطراً رمادياً ساكناً.
            className="rounded-full border border-border bg-surface-raised px-4 py-1.5 text-xs text-text-muted transition-colors hover:border-critical/40 hover:bg-critical/10 hover:text-critical"
            >
              {tr("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== عناصر مشتركة ====================

// ==================== إعادة رفع التحويلات للمنصات ====================
//
// التوكنات لا تصل هذه الواجهة أبداً - نستقبل "هل يوجد توكن" فقط، ونعرض
// قناعاً. تركها فارغة عند الحفظ تُبقي التوكن المخزَّن كما هو، وكتابة مسافة
// فارغة صراحةً تمسحه. بدون هذا التمييز يمحو أي حفظ عادي توكناً سليماً.
const TOKEN_MASK = "••••••••••••••••";

function ConversionSyncTab({
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
}: {
  workspaces: WorkspaceData[];
  activeWorkspaceId: string;
  onSwitchWorkspace: (id: string) => void;
}) {
  const tr = useT();
  const router = useRouter();
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  const [form, setForm] = useState({
    conversionSyncEnabled: workspace.conversionSyncEnabled,
    conversionSyncVerifiedOnly: workspace.conversionSyncVerifiedOnly,
    metaPixelId: workspace.metaPixelId ?? "",
    metaCapiToken: workspace.hasMetaCapiToken ? TOKEN_MASK : "",
    googleConversionActionId: workspace.googleConversionActionId ?? "",
    tiktokPixelCode: workspace.tiktokPixelCode ?? "",
    tiktokCapiToken: workspace.hasTiktokCapiToken ? TOKEN_MASK : "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  const metaReady = !!form.metaPixelId && (!!workspace.hasMetaCapiToken || form.metaCapiToken !== "");
  const googleReady = !!form.googleConversionActionId;
  const tiktokReady = !!form.tiktokPixelCode && (!!workspace.hasTiktokCapiToken || form.tiktokCapiToken !== "");
  const anyReady = metaReady || googleReady || tiktokReady;

  return (
    <SettingsSection icon={RefreshCw} title={tr("tabConversionSync")} description={tr("secSyncDesc")}>
      {workspaces.length > 1 && (
        <WorkspaceSwitcher workspaces={workspaces} active={activeWorkspaceId} onSwitch={onSwitchWorkspace} />
      )}

      <p className="mb-4 text-[13px] leading-relaxed text-text-muted">
        {tr("csWhy")}
      </p>

      <SettingsCard title={tr("csRunning")}>
      <ToggleRow
        label={tr("csEnable")}
        checked={form.conversionSyncEnabled}
        onChange={(v) => setForm({ ...form, conversionSyncEnabled: v })}
      />
      <ToggleRow
        label={tr("csVerifiedOnly")}
        checked={form.conversionSyncVerifiedOnly}
        onChange={(v) => setForm({ ...form, conversionSyncVerifiedOnly: v })}
      />
      <p className="mb-5 mt-1.5 text-[12px] leading-relaxed text-text-faint">
        {tr("csVerifiedOnlyHint")}
      </p>

      {form.conversionSyncEnabled && !anyReady && (
        <div className="mb-5 rounded-xl border border-gap/30 bg-gap/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-gap">
          {tr("csNoPlatformWarn")}
        </div>
      )}

      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">
        {tr("csMetaHead")}
      </div>
      <FieldLabel>{tr("csPixelId")}</FieldLabel>
      <TextInput
        value={form.metaPixelId}
        onChange={(v) => setForm({ ...form, metaPixelId: v })}
        placeholder={tr("egPlaceholder", { value: "1234567890123456" })}
      />
      <FieldLabel>{tr("csMetaToken")}</FieldLabel>
      <TextInput
        value={form.metaCapiToken}
        onChange={(v) => setForm({ ...form, metaCapiToken: v })}
        placeholder={workspace.hasMetaCapiToken ? tr("csTokenSaved") : tr("csMetaTokenPlaceholder")}
      />

      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">
        {tr("csGoogleHead")}
      </div>
      <FieldLabel>{tr("csConversionActionId")}</FieldLabel>
      <TextInput
        value={form.googleConversionActionId}
        onChange={(v) => setForm({ ...form, googleConversionActionId: v })}
        placeholder={tr("csGoogleIdPlaceholder")}
      />
      <p className="-mt-2 mb-4 text-[12px] leading-relaxed text-text-faint">
        {tr("csGoogleHint")}
      </p>

      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">
        {tr("csTiktokHead")}
      </div>
      <FieldLabel>{tr("csPixelCode")}</FieldLabel>
      <TextInput
        value={form.tiktokPixelCode}
        onChange={(v) => setForm({ ...form, tiktokPixelCode: v })}
        placeholder={tr("csTiktokCodePlaceholder")}
      />
      <FieldLabel>{tr("csEventsToken")}</FieldLabel>
      <TextInput
        value={form.tiktokCapiToken}
        onChange={(v) => setForm({ ...form, tiktokCapiToken: v })}
        placeholder={workspace.hasTiktokCapiToken ? tr("csTokenSaved") : tr("csTiktokTokenPlaceholder")}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <ReadyChip label={tr("platMeta")} ready={metaReady} />
        <ReadyChip label={tr("platGoogle")} ready={googleReady} />
        <ReadyChip label={tr("platTiktok")} ready={tiktokReady} />
      </div>

      <p className="mb-4 text-[12px] leading-relaxed text-text-faint">
        {tr("csSafety")}
      </p>

      </SettingsCard>

      <div className="flex items-center gap-3">
        <SaveButton onClick={handleSave} saving={saving} />
        {saved && <span className="text-[12.5px] text-verified">{tr("csSavedNote")}</span>}
      </div>
    </SettingsSection>
  );
}

function ReadyChip({ label, ready }: { label: string; ready: boolean }) {
  const tr = useT();
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium ${
        ready ? "bg-verified/10 text-verified" : "bg-surface-raised text-text-faint"
      }`}
    >
      {label}: {ready ? tr("chipReady") : tr("chipNotSet")}
    </span>
  );
}

// 🔴 كانت `<div className="card p-6">` عارية: **بطاقةٌ بلا عنوان**. تفتح
// التبويب فتجد حقولاً تبدأ من العدم - لا شيء يقول ما هذا القسم ولا لماذا
// تُضبَط هذه الحقول معاً. الاسم والوصف هنا ليسا زينةً: هما ما يحوّل
// كومةَ حقولٍ إلى قسمٍ له معنى.
function SettingsSection({
  title,
  description,
  icon: Icon,
  boxed = false,
  children,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  /** للأقسام التي لا عناوين داخلية لها: تُغلَّف ببطاقةٍ واحدة بدل أن تبدو
   *  حقولاً سائبةً بينما أخواتها في بطاقات. */
  boxed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      {title && (
        // رأسُ القسم لا بطاقة: هو عنوان ما تحته، فلو كان محاطاً بإطارٍ
        // صار عنصراً بجانبها لا فوقها.
        <div className="mb-5 flex items-start gap-3.5">
          {Icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-accent">
              <Icon size={19} strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0 pt-0.5">
            <h2 className="text-[17px] font-semibold leading-6 text-text-primary">{title}</h2>
            {description && (
              <p className="mt-1 text-[12.5px] leading-5 text-text-muted">{description}</p>
            )}
          </div>
        </div>
      )}
      {/* 🔴 **إطارٌ واحد، لا ثلاثة متداخلة.**
       *
       * أُعطي هذا الغلافُ إطاراً في جولةٍ سابقة، وكان خطأً: أبناؤه أصلاً
       * بطاقاتٌ لها إطاراتها (`SettingsCard` لكلّ عنوانٍ داخليّ)، ولوحةُ
       * الإعدادات حولهم جميعاً لها حدُّها. فصار الحقلُ داخل ثلاثة أطرٍ
       * متداخلة - عمقٌ كاذبٌ لا يفصل شيئاً، لأنّ الإطار إنّما يفصل حين
       * يكون وحده.
       *
       * فالإطار للبطاقة الداخلية وحدها، وهذا الغلاف تخطيطٌ لا سطح. */}
      <div className={boxed ? "card flex flex-col gap-4 p-5 sm:p-6" : "flex flex-col gap-4"}>
        {children}
      </div>
    </div>
  );
}

/** بطاقةٌ لعنوانٍ داخليّ واحد - «تتبّع واتساب» بإعداداته، وحدَه.
 *
 *  🔴 كانت العناوين الداخلية أسطراً يفصلها خطٌّ داخل بطاقةٍ واحدة طويلة،
 *  فتُقرأ قائمةً متّصلة لا مجموعاتٍ مستقلّة - ولا يُعرف أين ينتهي موضوعٌ
 *  ويبدأ الذي بعده إلّا بقراءة كلّ سطر. البطاقة تفصل بالبنية لا بخطّ. */
function SettingsCard({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      {title && (
        <div className="mb-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">
            {title}
          </h3>
          {description && (
            <p className="mt-1.5 text-[12.5px] leading-5 text-text-muted">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// 🔴 **هذا السطر وحده هو ما جعل الصفحة «سايحة على بعضها».**
//
// كان: `text-xs text-text-muted` - أي **ستايل نصّ الشرح بالحرف**. فحين
// يتجاور حقلان تقرأ العين أربعة أسطر متساوية الحجم واللون، ولا شيء فيها
// يقول أيّ سطرٍ اسمُ حقل وأيّها شرحُه - وهو سؤال المالك حرفياً: «مش بعرف
// الوصف تبع أنهي أوبشن».
//
// صار درجةَ «الحقل» في السُّلَّم: أكبر ممّا تحته **وأثقل وأغمق** - ثلاثة
// فروق معاً لأنّ فرقاً واحداً لا تلتقطه العين في المسح السريع.
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[13px] font-medium leading-5 text-text-primary">{children}</div>;
}

/** الشرح تحت اسم الحقل - درجةٌ أصغر وأفتح، فيُقرأ تابعاً لا ندّاً. */
function FieldHint({ children }: { children: React.ReactNode }) {
  return <div className="-mt-1 mb-2 text-[12px] leading-[1.55] text-text-muted">{children}</div>;
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="field mb-4 w-full"
    />
  );
}

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-4 flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-4 py-1.5 text-xs transition-colors ${
            value === opt.value ? "bg-accent text-white" : "bg-surface-raised text-text-muted"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  /** شرحٌ تحت الاسم: «ماذا يفعل هذا المفتاح؟» يُجاب في مكانه لا في وثيقة */
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-2 border-b border-border py-3.5 last:border-0">
      <div className="min-w-0">
        {/* درجة «الحقل»: ١٣px/medium/primary. كان `text-sm` عارياً فيتساوى
            مع الشرح تحته في الوزن واللون معاً. */}
        <div className="text-[13px] font-medium leading-5 text-text-primary">{label}</div>
        {hint && <p className="mt-1 text-[12px] leading-[1.55] text-text-muted">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function NumberRow({
  label,
  hint,
  value,
  onChange,
  step = 1,
  /** وحدة القياس بجانب الحقل - «دقيقة»، «٪» - فلا تُحشَر داخل الاسم */
  suffix,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-2 border-b border-border py-3.5 last:border-0">
      <div className="min-w-0">
        {/* درجة «الحقل»: ١٣px/medium/primary. كان `text-sm` عارياً فيتساوى
            مع الشرح تحته في الوزن واللون معاً. */}
        <div className="text-[13px] font-medium leading-5 text-text-primary">{label}</div>
        {hint && <p className="mt-1 text-[12px] leading-[1.55] text-text-muted">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="field w-24 px-2 py-1 text-end"
        />
        {/* 🔴 تُصيَّر دائماً حتى بلا وحدة. حين كانت مشروطةً، الصفّ الذي بلا
            وحدة يفقد عرضها فينزاح صندوقه وحده عن بقيّة الصفوف - وهو
            «البوكس المش متحاذي». `aria-hidden` كي لا يقرأ قارئ الشاشة فراغاً. */}
        <span aria-hidden className="w-8 shrink-0 text-[12px] text-text-faint">{suffix ?? ""}</span>
      </div>
    </div>
  );
}

/** صفٌّ اسمُه وشرحُه يمين، وزرّ فعلٍ **فوريّ** يسار.
 *
 *  الفرق عن `ToggleRow` أنّ هذا لا يُحفَظ: الضغط يفعل الفعل الآن. ولذلك
 *  زرُّه ثانويّ - لو كان أساسياً لنافس «احفظ» على أنّه إجراء الصفحة. */
function FieldRowAction({
  label,
  hint,
  actionLabel,
  onAction,
}: {
  label: string;
  hint?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="text-[13px] font-medium leading-5 text-text-primary">{label}</div>
        {hint && <p className="mt-1 text-[12px] leading-[1.55] text-text-muted">{hint}</p>}
      </div>
      <button type="button" onClick={onAction} className="btn btn-secondary btn-sm shrink-0">
        {actionLabel}
      </button>
    </div>
  );
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  const tr = useT();
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="btn btn-primary rounded-full"
    >
      {saving ? tr("savingShort") : tr("saveChanges")}
    </button>
  );
}
