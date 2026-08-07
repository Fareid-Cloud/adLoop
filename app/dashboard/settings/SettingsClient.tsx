// app/dashboard/settings/SettingsClient.tsx
//
// إعدادات شاملة - لكل نظام في المنتج تحكّم صريح هنا (تشغيل/إيقاف +
// عتبات قابلة للتعديل)، لا أرقاماً مثبّتة داخل الكود.

"use client";

import { Toggle } from "@/app/components/ui/Toggle";
import { ConnectionTester } from "@/app/components/ConnectionTester";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { useState, useMemo, useEffect, createContext, useContext } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, Cpu, Sparkles, Terminal, Brain, Zap, Upload, Search } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import { PushNotificationToggle } from "@/app/components/PushNotificationToggle";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { LegalLinks } from "@/app/components/LegalLinks";

// سياق اللغة بدل تمريرها كخاصية عبر أربعة عشر مكوّناً فرعياً. الملف واحد
// وشجرته كلها في العميل، فالسياق هنا أنظف وأقل عرضة للخطأ من تمرير
// خاصية تُنسى في مكوّن واحد فيبقى نصّه بلغة واحدة دون أن يلاحظ أحد.
const SettingsLocaleContext = createContext<Locale>("ar");

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
  { key: "profile", labelKey: "tabProfile" },
  { key: "preferences", labelKey: "tabPreferences" },
  { key: "accounts", labelKey: "tabAccounts" },
  { key: "workspace", labelKey: "tabWorkspace" },
  { key: "automation", labelKey: "tabAutomation" },
  { key: "conversionSync", labelKey: "tabConversionSync" },
  { key: "danger", labelKey: "tabDanger" },
] as const;

// فهرس بحث حقيقي - كل سطر هنا يمثّل حقلاً موجوداً فعلاً في أحد التبويبات
// أعلاه، لا أسماء وهمية. أي حقل جديد يُضاف إلى تبويب يجب أن يُضاف هنا
// أيضاً كي يبقى البحث دقيقاً ومطابقاً للواقع.
const SEARCH_INDEX: Array<{ labelKey: string; tab: (typeof TABS)[number]["key"] }> = [
  { labelKey: "idxName", tab: "profile" },
  { labelKey: "idxAvatar", tab: "profile" },
  { labelKey: "idxLanguage", tab: "preferences" },
  { labelKey: "idxMode", tab: "preferences" },
  { labelKey: "idxAccent", tab: "preferences" },
  { labelKey: "idxTimezone", tab: "preferences" },
  { labelKey: "idxGoogle", tab: "accounts" },
  { labelKey: "idxMeta", tab: "accounts" },
  { labelKey: "idxWorkspaceName", tab: "workspace" },
  { labelKey: "idxCurrency", tab: "workspace" },
  { labelKey: "idxMarket", tab: "workspace" },
  { labelKey: "idxCampaigns", tab: "workspace" },
  { labelKey: "idxAi", tab: "automation" },
  { labelKey: "idxRules", tab: "automation" },
  { labelKey: "idxDaily", tab: "automation" },
  { labelKey: "idxPricingHealth", tab: "automation" },
  { labelKey: "idxModeled", tab: "automation" },
  { labelKey: "idxResponse", tab: "automation" },
  { labelKey: "idxFatigue", tab: "automation" },
  { labelKey: "idxCtr", tab: "automation" },
  { labelKey: "idxPriceWarn", tab: "automation" },
  { labelKey: "idxPriceCrit", tab: "automation" },
  { labelKey: "idxRto", tab: "automation" },
  { labelKey: "idxCeiling", tab: "automation" },
  { labelKey: "idxSyncEnable", tab: "conversionSync" },
  { labelKey: "idxMetaPixel", tab: "conversionSync" },
  { labelKey: "idxCapiToken", tab: "conversionSync" },
  { labelKey: "idxGoogleAction", tab: "conversionSync" },
  { labelKey: "idxTiktokPixel", tab: "conversionSync" },
  { labelKey: "idxDeleteWorkspace", tab: "danger" },
];

export function SettingsClient({
  user,
  workspaces,
  connectedPlatforms,
}: {
  user: UserData;
  workspaces: WorkspaceData[];
  connectedPlatforms: ConnectedPlatformData[];
}) {
  // التبويب الأوّلي من الرابط: بدونه كان كل زرّ يشير إلى إعداد بعينه
  // يهبط بالمستخدم على «الملف الشخصي» ويتركه يبحث عمّا أُرسل إليه.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>(
    TABS.some((t) => t.key === requestedTab)
      ? (requestedTab as (typeof TABS)[number]["key"])
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
    return SEARCH_INDEX.filter((item) => tr(item.labelKey).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, locale]);

  return (
    <SettingsLocaleContext.Provider value={locale}>
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 page-title">{tr("title")}</h1>

      <div className="relative mb-4">
        <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-text-faint" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={tr("searchPlaceholder")}
          className="field w-full ps-9 pe-3"
        />
        {searchResults.length > 0 && (
          <div className="card absolute z-10 mt-1 w-full overflow-hidden bg-surface-raised shadow-lg">
            {searchResults.map((r) => (
              <button
                key={r.labelKey}
                onClick={() => {
                  setActiveTab(r.tab);
                  setSearchQuery("");
                }}
                className="block w-full px-4 py-2.5 text-start text-sm text-text-primary hover:bg-surface"
              >
                {tr(r.labelKey)}
                <span className="ms-2 text-xs text-text-faint">
                  {tr("inTab", { tab: tr(TABS.find((x) => x.key === r.tab)?.labelKey ?? "") })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* التفاف لا تمرير أفقي: شريط يتمرّر جانبياً يخفي تبويبات كاملة
          عن العين، فيظنّ المستخدم أنها غير موجودة. */}
      <div className="mb-6 flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            // النشط بلون الثيم لا برمادي أفتح بدرجة: `bg-surface-raised`
            // على `bg-surface` فرق لا تلتقطه العين، فيتوه المستخدم عن
            // موضعه بين تسعة تبويبات متشابهة.
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-accent text-white shadow-[0_2px_10px_-4px_var(--accent)]"
                : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
            }`}
          >
            {tr(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === "profile" && <ProfileTab user={user} />}
      {activeTab === "preferences" && <PreferencesTab user={user} />}
      {activeTab === "accounts" && <AccountsTab connectedPlatforms={connectedPlatforms} />}
      {activeTab === "workspace" && workspaces.length > 0 && (
        <WorkspaceTab
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={setActiveWorkspaceId}
        />
      )}
      {activeTab === "automation" && workspaces.length > 0 && (
        <AutomationTab
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={setActiveWorkspaceId}
        />
      )}
      {activeTab === "conversionSync" && workspaces.length > 0 && (
        <ConversionSyncTab
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={setActiveWorkspaceId}
        />
      )}
      {activeTab === "danger" && workspaces.length > 0 && (
        <>
          <MfaSection />
          <DangerZoneTab workspaces={workspaces} />
        </>
      )}
    </div>
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
    <SettingsSection>
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
    <SettingsSection>
      <FieldLabel>{tr("idxLanguage")}</FieldLabel>
      <ToggleGroup
        options={[{ value: "ar", label: tr("langArabic") }, { value: "en", label: "English" }]}
        value={locale}
        onChange={setLocale}
      />

      <FieldLabel>{tr("mode")}</FieldLabel>
      <ToggleGroup
        options={[{ value: "dark", label: tr("modeDark") }, { value: "light", label: tr("modeLight") }]}
        value={themeMode}
        onChange={setThemeMode}
      />

      <FieldLabel>{tr("idxAccent")}</FieldLabel>
      <div className="mb-4 flex gap-2">
        {THEME_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setThemeColor(c)}
            data-accent={c}
            title={tr(THEME_COLOR_KEYS[c])}
            aria-label={tr(THEME_COLOR_KEYS[c])}
            className={`h-8 w-8 rounded-full bg-accent transition-transform ${
              themeColor === c ? "scale-110 ring-2 ring-text-primary ring-offset-2 ring-offset-bg" : ""
            }`}
          />
        ))}
      </div>

      <div className="mb-2 mt-6 text-xs font-medium uppercase tracking-wider text-text-faint">{tr("legalSectionTitle")}</div>
      <p className="mb-2.5 text-xs text-text-faint">{tr("legalSectionHint")}</p>
      <LegalLinks locale={locale as Locale} variant="stacked" className="mb-2" />

      <div className="mb-2 mt-6 text-xs font-medium uppercase tracking-wider text-text-faint">{tr("marketingTitle")}</div>
      <p className="mb-2 text-xs text-text-faint">{tr("marketingHint")}</p>
      <ToggleRow
        label={tr("marketingToggle")}
        checked={!marketingOptOut}
        onChange={(v) => setMarketingOptOut(!v)}
      />

      <FieldLabel>{tr("idxTimezone")}</FieldLabel>
      <select
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
        className="field mb-4 w-full"
      >
        {/* مجموعات بدل قائمة مسطّحة: القائمة صارت أطول من أن تُمسح بالعين */}
        <optgroup label={tr("tzGroupGulf")}>
          <option value="Asia/Riyadh">{tr("tzRiyadh")}</option>
          <option value="Africa/Cairo">{tr("tzCairo")}</option>
          <option value="Asia/Dubai">{tr("tzDubai")}</option>
          <option value="Asia/Kuwait">{tr("tzKuwait")}</option>
          <option value="Europe/Istanbul">{tr("tzIstanbul")}</option>
        </optgroup>
        <optgroup label={tr("tzGroupEurope")}>
          <option value="Europe/London">{tr("tzLondon")}</option>
          <option value="Europe/Paris">{tr("tzParis")}</option>
          <option value="Europe/Berlin">{tr("tzBerlin")}</option>
        </optgroup>
        <optgroup label={tr("tzGroupAmericas")}>
          <option value="America/New_York">{tr("tzNewYork")}</option>
          <option value="America/Chicago">{tr("tzChicago")}</option>
          <option value="America/Los_Angeles">{tr("tzLosAngeles")}</option>
        </optgroup>
      </select>

      <FieldLabel>{tr("tour")}</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">{tr("tourHint")}</p>
      <button
        onClick={async () => {
          await fetch("/api/onboarding/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step: 0, completed: false, dismissed: false }),
          });
          router.push("/dashboard");
        }}
        className="mb-4 rounded-full bg-surface-raised px-3.5 py-1.5 text-xs text-text-primary"
      >
        {tr("tourRestart")}
      </button>

      <SaveButton onClick={handleSave} saving={saving} />
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
      <span className="rounded-full bg-verified/15 px-3 py-1 text-xs text-verified">{tr("connected")}</span>
      <button onClick={() => setConfirming(true)} className="text-xs text-text-faint hover:text-critical">
        {tr("disconnectAccount")}
      </button>
    </div>
  );
}

function AccountsTab({ connectedPlatforms }: { connectedPlatforms: ConnectedPlatformData[] }) {
  const tr = useT();
  const connectedMap = new Map(connectedPlatforms.map((c) => [c.platform, c]));

  return (
    <SettingsSection>
      {(["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"] as const).map((platform) => {
        const connection = connectedMap.get(platform);
        return (
          <div key={platform} className="card mb-2 bg-surface-raised px-4 py-3">
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [notifyUrgentByEmail, setNotifyUrgentByEmail] = useState(workspace.notifyUrgentByEmail);
  const [notifyHighByEmail, setNotifyHighByEmail] = useState(workspace.notifyHighByEmail);
  const [notificationEmail, setNotificationEmail] = useState(workspace.notificationEmail ?? "");
  // يُمرَّر من الخادم: المتصفّح لا يرى متغيّرات البيئة، وإخفاء الحقيقة عن
  // المستخدم هنا يعني أنّه يفعّل تنبيهات لا تصل ولا يعرف السبب أبداً.
  const emailEnabled = workspace.emailEnabled;
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/workspaces/${workspace.id}`, {
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
    setSaving(false);
    router.refresh();
  }

  return (
    <SettingsSection>
      {workspaces.length > 1 && (
        <WorkspaceSwitcher workspaces={workspaces} active={activeWorkspaceId} onSwitch={onSwitchWorkspace} />
      )}

      <FieldLabel>{tr("idxWorkspaceName")}</FieldLabel>
      <TextInput value={name} onChange={setName} placeholder={tr("wsNamePlaceholder")} />

      <FieldLabel>{tr("idxCurrency")}</FieldLabel>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="field mb-4 w-full"
      >
        <option value="SAR">{tr("curSar")}</option>
        <option value="EGP">{tr("curEgp")}</option>
        <option value="AED">{tr("curAed")}</option>
        <option value="KWD">{tr("curKwd")}</option>
        <option value="QAR">{tr("curQar")}</option>
        <option value="OMR">{tr("curOmr")}</option>
        <option value="BHD">{tr("curBhd")}</option>
        <option value="USD">{tr("curUsd")}</option>
        <option value="EUR">{tr("curEur")}</option>
        <option value="GBP">{tr("curGbp")}</option>
      </select>

      <FieldLabel>{tr("idxMarket")}</FieldLabel>
      <select
        value={targetLocation}
        onChange={(e) => setTargetLocation(e.target.value)}
        className="field mb-4 w-full"
      >
        <option value="">{tr("marketNone")}</option>
        <option value="SA">{tr("marketSa")}</option>
        <option value="EG">{tr("marketEg")}</option>
        <option value="AE">{tr("marketAe")}</option>
        <option value="KW">{tr("marketKw")}</option>
      </select>

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

      <div className="mb-2 mt-6 text-xs font-medium uppercase tracking-wider text-text-faint">{tr("waSection")}</div>
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
        onCopied={() => {
          setLinkCopied(true);
          setTimeout(() => setLinkCopied(false), 2000);
        }}
      />

      <div className="mb-2 mt-6 text-xs font-medium uppercase tracking-wider text-text-faint">{tr("alerts")}</div>
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
}: {
  workspaceId: string;
  ready: boolean;
  copied: boolean;
  onCopied: () => void;
}) {
  const tr = useT();
  const base = process.env.NEXT_PUBLIC_TRACKER_BASE_URL;
  const link = base
    ? `${base.replace(/\/$/, "")}/api/track-click?gclid={gclid}&ws=${workspaceId}`
    : null;

  // كلّ حالة تقول ما الناقص وأين يُضبط، لا "غير متاح" وتصمت.
  if (!ready || !link) {
    return (
      <div className="mb-4 surface-0/50 p-3.5">
        <div className="mb-1 text-[12.5px] font-medium text-text-primary">{tr("waLinkTitle")}</div>
        <p className="text-[11.5px] leading-relaxed text-text-faint">
          {!base ? tr("waLinkNeedsBase") : tr("waLinkNeedsSetup")}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-accent/30 bg-accent/[0.06] p-3.5">
      <div className="mb-1 text-[12.5px] font-medium text-text-primary">{tr("waLinkTitle")}</div>
      <p className="mb-2.5 text-[11.5px] leading-relaxed text-text-muted">{tr("waLinkHint")}</p>
      <div className="flex items-center gap-2">
        <code
          dir="ltr"
          className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-surface px-2.5 py-2 font-mono text-[11.5px] text-text-primary"
        >
          {link}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(link);
            onCopied();
          }}
          className="btn btn-primary shrink-0"
        >
          {copied ? tr("waCopied") : tr("waCopy")}
        </button>
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
  return (
    <div className="mb-4 flex gap-1.5">
      {workspaces.map((w) => (
        <button
          key={w.id}
          onClick={() => onSwitch(w.id)}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            active === w.id ? "bg-accent text-white" : "bg-surface-raised text-text-muted"
          }`}
        >
          {w.name}
        </button>
      ))}
    </div>
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

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <SettingsSection>
      {workspaces.length > 1 && (
        <WorkspaceSwitcher workspaces={workspaces} active={activeWorkspaceId} onSwitch={onSwitchWorkspace} />
      )}

      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-faint">{tr("switches")}</div>
      <ToggleRow
        label={tr("swAi")}
        checked={form.enableAIInsights}
        onChange={(v) => setForm({ ...form, enableAIInsights: v })}
      />
      <ToggleRow
        label={tr("swRules")}
        checked={form.enableAutomationRules}
        onChange={(v) => setForm({ ...form, enableAutomationRules: v })}
      />
      <ToggleRow
        label={tr("swDaily")}
        checked={form.enableDailyDiagnostics}
        onChange={(v) => setForm({ ...form, enableDailyDiagnostics: v })}
      />
      <ToggleRow
        label={tr("swPricing")}
        checked={form.enablePricingHealthChecks}
        onChange={(v) => setForm({ ...form, enablePricingHealthChecks: v })}
      />
      <ToggleRow
        label={tr("swModeled")}
        checked={form.useModeledAttribution}
        onChange={(v) => setForm({ ...form, useModeledAttribution: v })}
      />

      <div className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-text-faint">{tr("thresholdsHead")}</div>
      <NumberRow
        label={tr("thResponse")}
        value={form.responseTimeThresholdMinutes}
        onChange={(v) => setForm({ ...form, responseTimeThresholdMinutes: v })}
      />
      <NumberRow
        label={tr("thFatigue")}
        value={form.adFatigueFrequencyThreshold}
        step={0.1}
        onChange={(v) => setForm({ ...form, adFatigueFrequencyThreshold: v })}
      />
      <NumberRow
        label={tr("thMessenger")}
        value={form.messengerInactivityThresholdMinutes}
        onChange={(v) => setForm({ ...form, messengerInactivityThresholdMinutes: v })}
      />

      <div className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-text-faint">{tr("primarySourceHead")}</div>
      <div className="flex gap-2">
        {[
          { value: "WHATSAPP", label: tr("srcWhatsapp") },
          { value: "MESSENGER", label: tr("srcMessenger") },
          { value: "LEAD_FORM", label: tr("srcLeadForm") },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setForm({ ...form, primaryConversionSource: opt.value })}
            className={`rounded-full px-3 py-1.5 text-xs ${
              form.primaryConversionSource === opt.value
                ? "bg-accent text-white"
                : "bg-surface-raised text-text-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <NumberRow
        label={tr("thCtr")}
        value={form.ctrDropThresholdPct}
        onChange={(v) => setForm({ ...form, ctrDropThresholdPct: v })}
      />
      <NumberRow
        label={tr("thPriceWarn")}
        value={form.pricingWarningThresholdPct}
        onChange={(v) => setForm({ ...form, pricingWarningThresholdPct: v })}
      />
      <NumberRow
        label={tr("thPriceCrit")}
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
        value={form.automationMonthlyBudgetChangeCeilingPct}
        onChange={(v) => setForm({ ...form, automationMonthlyBudgetChangeCeilingPct: v })}
      />

      <div className="mt-4">
        <SaveButton onClick={handleSave} saving={saving} />
      </div>
    </SettingsSection>
  );
}

function MfaSection() {
  const tr = useT();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/mfa/status")
      .then((res) => res.json())
      .then((data) => setEnabled(data.enabled));
  }, []);

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
    <div className="card mb-4 p-4">
      <div className="mb-2 text-sm font-medium text-text-primary">{tr("mfaTitle")}</div>
      <p className="mb-3 text-xs text-text-muted">
        {tr("mfaHint")}
      </p>

      {enabled ? (
        !showDisableConfirm ? (
          <button
            onClick={() => setShowDisableConfirm(true)}
            className="rounded-full bg-surface-raised px-4 py-1.5 text-xs text-text-muted"
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
    <SettingsSection>
      <div className="btn btn-danger bg-critical/10 p-4">
        <div className="mb-2 text-sm font-medium text-critical">{tr("dzDeleteWorkspace")}</div>
        <p className="mb-3 text-xs text-text-muted">
          {tr("dzDeleteWorkspaceHint")}
        </p>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="field mb-2 w-full"
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
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
    <div className="btn btn-danger mt-4 bg-critical/10 p-4">
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
              className="rounded-full bg-surface-raised px-4 py-1.5 text-xs text-text-muted"
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
    <SettingsSection>
      {workspaces.length > 1 && (
        <WorkspaceSwitcher workspaces={workspaces} active={activeWorkspaceId} onSwitch={onSwitchWorkspace} />
      )}

      <p className="mb-4 text-[13px] leading-relaxed text-text-muted">
        {tr("csWhy")}
      </p>

      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-faint">{tr("csRunning")}</div>
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

      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-faint">
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

      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-faint">
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

      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-faint">
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

function SettingsSection({ children }: { children: React.ReactNode }) {
  return <div className="card p-6">{children}</div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs text-text-muted">{children}</div>;
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
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-text-primary">{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-text-primary">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="field w-20 px-2 py-1 text-end"
      />
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
