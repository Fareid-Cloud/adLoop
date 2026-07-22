// app/dashboard/settings/SettingsClient.tsx
//
// إعدادات شاملة - كل نظام في المنتج له تحكم صريح هنا (تشغيل/إيقاف +
// عتبات قابلة للتعديل)، مش أرقام مقفولة جوه الكود بعد النهاردة.

"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, Cpu, Sparkles, Terminal, Brain, Zap, Upload, Search } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import { PushNotificationToggle } from "@/app/components/PushNotificationToggle";

const AVATAR_ICONS = [
  { key: "bot", Icon: Bot },
  { key: "cpu", Icon: Cpu },
  { key: "sparkles", Icon: Sparkles },
  { key: "terminal", Icon: Terminal },
  { key: "brain", Icon: Brain },
  { key: "zap", Icon: Zap },
] as const;

const THEME_COLORS = ["blue", "purple", "orange", "sky", "red"] as const;

interface UserData {
  name: string | null;
  email: string;
  avatarIcon: string | null;
  avatarImageUrl: string | null;
  preferredLocale: string;
  themeColor: string;
  themeMode: string;
  timezone: string;
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
}

interface ConnectedPlatformData {
  platform: string;
  connectedAt: string;
  expiresAt: string | null;
}

const TABS = [
  { key: "profile", label: "الملف الشخصي" },
  { key: "preferences", label: "التفضيلات" },
  { key: "accounts", label: "الحسابات المرتبطة" },
  { key: "workspace", label: "مساحة العمل" },
  { key: "automation", label: "التحكم والأتمتة" },
  { key: "danger", label: "منطقة الخطر" },
] as const;

// فهرس بحث حقيقي - كل سطر هنا بيمثّل حقل فعلاً موجود في إحدى التبويبات
// فوق، مش أسماء وهمية. لو ضفت حقل جديد لأي تبويب، لازم يتضاف هنا أيضاً
// عشان البحث يفضل دقيق ومطابق للواقع.
const SEARCH_INDEX: Array<{ label: string; tab: (typeof TABS)[number]["key"] }> = [
  { label: "الاسم", tab: "profile" },
  { label: "الصورة الشخصية", tab: "profile" },
  { label: "اللغة", tab: "preferences" },
  { label: "الوضع الداكن الفاتح", tab: "preferences" },
  { label: "اللون الأساسي", tab: "preferences" },
  { label: "المنطقة الزمنية", tab: "preferences" },
  { label: "ربط Google Ads", tab: "accounts" },
  { label: "ربط Meta Ads", tab: "accounts" },
  { label: "اسم مساحة العمل", tab: "workspace" },
  { label: "العملة", tab: "workspace" },
  { label: "السوق المستهدف", tab: "workspace" },
  { label: "الحملات المرتبطة", tab: "workspace" },
  { label: "تحليلات الذكاء الاصطناعي", tab: "automation" },
  { label: "قواعد الأتمتة", tab: "automation" },
  { label: "التشخيص اليومي", tab: "automation" },
  { label: "فحص صحة التسعير", tab: "automation" },
  { label: "المحادثات المجهولة Modeled Attribution", tab: "automation" },
  { label: "حد سرعة الرد", tab: "automation" },
  { label: "حد تكرار الإعلان تعب الكرياتيف", tab: "automation" },
  { label: "حد انخفاض CTR", tab: "automation" },
  { label: "حد تحذير التسعير", tab: "automation" },
  { label: "حد خطر التسعير", tab: "automation" },
  { label: "مضاعف المرتجعات الشاذة", tab: "automation" },
  { label: "السقف الشهري لتغييرات الأتمتة", tab: "automation" },
  { label: "حذف مساحة عمل", tab: "danger" },
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
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("profile");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim();
    return SEARCH_INDEX.filter((item) => item.label.includes(q));
  }, [searchQuery]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-[26px] font-semibold text-text-primary">الإعدادات</h1>

      <div className="relative mb-4">
        <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-text-faint" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث في الإعدادات..."
          className="w-full rounded-xl bg-surface py-2 ps-9 pe-3 text-sm text-text-primary outline-none"
        />
        {searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl bg-surface-raised shadow-lg">
            {searchResults.map((r) => (
              <button
                key={r.label}
                onClick={() => {
                  setActiveTab(r.tab);
                  setSearchQuery("");
                }}
                className="block w-full px-4 py-2.5 text-start text-sm text-text-primary hover:bg-surface"
              >
                {r.label}
                <span className="ms-2 text-xs text-text-faint">
                  في {TABS.find((t) => t.key === r.tab)?.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors ${
              activeTab === tab.key
                ? "bg-surface-raised text-text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {tab.label}
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
      {activeTab === "danger" && workspaces.length > 0 && (
        <>
          <MfaSection />
          <DangerZoneTab workspaces={workspaces} />
        </>
      )}
    </div>
  );
}

// ==================== الملف الشخصي ====================

function ProfileTab({ user }: { user: UserData }) {
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [avatarIcon, setAvatarIcon] = useState(user.avatarIcon ?? "bot");
  const [avatarImageUrl, setAvatarImageUrl] = useState(user.avatarImageUrl);
  const [saving, setSaving] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // نحول الصورة لـ base64 ونخزنها مباشرة - مقبول لحجم صورة شخصية صغيرة،
    // من غير ما نحتاج نضيف خدمة تخزين ملفات منفصلة (S3 مثلاً) لحاجة بسيطة كده
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
      <FieldLabel>الاسم</FieldLabel>
      <TextInput value={name} onChange={setName} placeholder="اسمك" />

      <FieldLabel>الصورة الشخصية</FieldLabel>
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
      <p className="mb-4 text-xs text-text-faint">اختار أيقونة جاهزة، أو ارفع صورتك الشخصية.</p>

      <SaveButton onClick={handleSave} saving={saving} />
    </SettingsSection>
  );
}

// ==================== التفضيلات ====================

function PreferencesTab({ user }: { user: UserData }) {
  const router = useRouter();
  const [locale, setLocale] = useState(user.preferredLocale);
  const [themeColor, setThemeColor] = useState(user.themeColor);
  const [themeMode, setThemeMode] = useState(user.themeMode);
  const [timezone, setTimezone] = useState(user.timezone);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredLocale: locale, themeColor, themeMode, timezone }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <SettingsSection>
      <FieldLabel>اللغة</FieldLabel>
      <ToggleGroup
        options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]}
        value={locale}
        onChange={setLocale}
      />

      <FieldLabel>الوضع</FieldLabel>
      <ToggleGroup
        options={[{ value: "dark", label: "داكن" }, { value: "light", label: "فاتح" }]}
        value={themeMode}
        onChange={setThemeMode}
      />

      <FieldLabel>اللون الأساسي</FieldLabel>
      <div className="mb-4 flex gap-2">
        {THEME_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setThemeColor(c)}
            data-accent={c}
            className={`h-8 w-8 rounded-full bg-accent transition-transform ${
              themeColor === c ? "scale-110 ring-2 ring-text-primary ring-offset-2 ring-offset-bg" : ""
            }`}
          />
        ))}
      </div>

      <FieldLabel>المنطقة الزمنية</FieldLabel>
      <select
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
        className="mb-4 w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
      >
        <option value="Asia/Riyadh">الرياض (GMT+3)</option>
        <option value="Africa/Cairo">القاهرة (GMT+2)</option>
        <option value="Asia/Dubai">دبي (GMT+4)</option>
        <option value="Asia/Kuwait">الكويت (GMT+3)</option>
      </select>

      <FieldLabel>الجولة التعريفية</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">يمكنك إعادة الجولة التعريفية في أي وقت.</p>
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
        إعادة الجولة التعريفية
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
        <span className="text-xs text-critical">متأكد؟</span>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="rounded-full bg-critical px-3 py-1 text-xs text-white"
        >
          {disconnecting ? "جارٍ الفصل..." : "افصل"}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-text-faint">
          إلغاء
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-verified/15 px-3 py-1 text-xs text-verified">متصل</span>
      <button onClick={() => setConfirming(true)} className="text-xs text-text-faint hover:text-critical">
        فصل الحساب
      </button>
    </div>
  );
}

function AccountsTab({ connectedPlatforms }: { connectedPlatforms: ConnectedPlatformData[] }) {
  const connectedMap = new Map(connectedPlatforms.map((c) => [c.platform, c]));

  return (
    <SettingsSection>
      {(["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"] as const).map((platform) => {
        const connection = connectedMap.get(platform);
        return (
          <div
            key={platform}
            className="mb-2 flex items-center justify-between rounded-xl bg-surface-raised px-4 py-3"
          >
            <div>
              <div className="text-sm text-text-primary">{PLATFORM_LABELS[platform]}</div>
              {connection && (
                <div className="text-xs text-text-faint">
                  متصل {connection.expiresAt ? `— ينتهي ${new Date(connection.expiresAt).toLocaleDateString("ar")}` : ""}
                </div>
              )}
            </div>
            {connection ? (
              <DisconnectButton platform={platform} />
            ) : (
              <a
                href={`/api/oauth/${platform === "GOOGLE_ADS" ? "google-ads" : platform === "META_ADS" ? "meta" : "tiktok"}/start`}
                className="rounded-full bg-accent px-4 py-1.5 text-xs text-white no-underline"
              >
                اربط الحساب
              </a>
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
  const router = useRouter();
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
  const [name, setName] = useState(workspace.name);
  const [currency, setCurrency] = useState(workspace.currency);
  const [targetLocation, setTargetLocation] = useState(workspace.targetLocation ?? "");
  const [profitMarginPct, setProfitMarginPct] = useState(workspace.profitMarginPct?.toString() ?? "");
  const [monthlyChangeCeilingPct, setMonthlyChangeCeilingPct] = useState(workspace.monthlyChangeCeilingPct.toString());
  const [facebookPageId, setFacebookPageId] = useState(workspace.facebookPageId ?? "");
  const [notifyUrgentByEmail, setNotifyUrgentByEmail] = useState(workspace.notifyUrgentByEmail);
  const [notifyHighByEmail, setNotifyHighByEmail] = useState(workspace.notifyHighByEmail);
  const [notificationEmail, setNotificationEmail] = useState(workspace.notificationEmail ?? "");
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

      <FieldLabel>اسم مساحة العمل</FieldLabel>
      <TextInput value={name} onChange={setName} placeholder="اسم العميل أو المشروع" />

      <FieldLabel>العملة</FieldLabel>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="mb-4 w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
      >
        <option value="SAR">ريال سعودي (SAR)</option>
        <option value="EGP">جنيه مصري (EGP)</option>
        <option value="AED">درهم إماراتي (AED)</option>
        <option value="KWD">دينار كويتي (KWD)</option>
        <option value="USD">دولار أمريكي (USD)</option>
      </select>

      <FieldLabel>السوق المستهدف</FieldLabel>
      <select
        value={targetLocation}
        onChange={(e) => setTargetLocation(e.target.value)}
        className="mb-4 w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
      >
        <option value="">غير محدد</option>
        <option value="SA">السعودية</option>
        <option value="EG">مصر</option>
        <option value="AE">الإمارات</option>
        <option value="KW">الكويت</option>
      </select>

      <FieldLabel>هامش الربح التقريبي (%)</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">
        اختياري — إذا حُدِّد، يُستخدم لحساب "نقطة تعادل ROAS" الحقيقية الخاصة بك (= 100 ÷ الهامش) في قرارات
        Scale/Kill، بدل مقارنة نسبية بمتوسط حسابك بس.
      </p>
      <input
        type="number"
        min="1"
        max="99"
        value={profitMarginPct}
        onChange={(e) => setProfitMarginPct(e.target.value)}
        placeholder="مثال: 30"
        className="mb-4 w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
      />

      <FieldLabel>سقف التغيير الشهري لاستراتيجية المزايدة (%)</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">
        حد أقصى لمجموع نسب تغيير المزايدة اللي المنتج ممكن ينفّذها على نفس الإعلان/الحملة في الشهر
        الواحد - حاجز أمان يمنع تراكم تغييرات آلية متتالية من غير سقف.
      </p>
      <input
        type="number"
        min="5"
        max="200"
        value={monthlyChangeCeilingPct}
        onChange={(e) => setMonthlyChangeCeilingPct(e.target.value)}
        className="mb-4 w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
      />

      <FieldLabel>معرف صفحة فيسبوك (Page ID)</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">
        اختياري — مطلوب فقط إذا أردت تفعيل التحقق الحقيقي من جودة ليدز ماسنجر (تمييز الضغطة الخاطئة عن التواصل الحقيقي).
      </p>
      <input
        type="text"
        value={facebookPageId}
        onChange={(e) => setFacebookPageId(e.target.value)}
        placeholder="مثال: 123456789012345"
        className="mb-4 w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
      />

      <div className="mb-2 mt-2 text-xs font-medium uppercase tracking-wider text-text-faint">التنبيهات</div>
      <p className="mb-2 text-xs text-text-faint">
        التنبيهات دائماً موجودة داخل النظام (القرارات/التشخيص) - دي بس بتتحكم في هل توصل إيميل أيضاً.
      </p>
      <ToggleRow label="إيميل للتنبيهات العاجلة" checked={notifyUrgentByEmail} onChange={setNotifyUrgentByEmail} />
      <ToggleRow label="إيميل للتنبيهات المهمة" checked={notifyHighByEmail} onChange={setNotifyHighByEmail} />

      <div className="mb-2 mt-4 text-xs text-text-faint">إشعارات مباشرة على الموبايل حتى لو التطبيق مقفول</div>
      <div className="mb-4"><PushNotificationToggle /></div>

      <FieldLabel>إيميل التنبيهات (اختياري - افتراضياً إيميل حسابك)</FieldLabel>
      <TextInput value={notificationEmail} onChange={setNotificationEmail} placeholder="you@example.com" />

      <FieldLabel>الحملات المرتبطة</FieldLabel>
      <p className="mb-2 text-xs text-text-faint">
        اختار الحملات اللي تتبع مساحة العمل دي من الحسابات المرتبطة.
      </p>
      <CampaignPicker workspaceId={workspace.id} />

      <div className="mt-4">
        <SaveButton onClick={handleSave} saving={saving} />
      </div>
    </SettingsSection>
  );
}

function CampaignPicker({ workspaceId }: { workspaceId: string }) {
  // إصلاح باگ أساسي: كان الكومبوننت مقفول على GOOGLE_ADS فقط من الأول -
  // يعني ميتا وتيك توك محدش كان يقدر يربط حملاتهم من الواجهة خالص، حتى
  // لو كل المزامنة والتحليل مبني على افتراض وجود CampaignLink ليهم
  const [platform, setPlatform] = useState<"GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS">("GOOGLE_ADS");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<
    Array<{ accountId: string; accountName: string; campaigns: Array<{ id: string; name: string; status: string; recentlyActive: boolean }> }>
  >([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [saved, setSaved] = useState(false);

  const PLATFORM_TABS: Array<{ value: typeof platform; label: string }> = [
    { value: "GOOGLE_ADS", label: "جوجل" },
    { value: "META_ADS", label: "ميتا" },
    { value: "TIKTOK_ADS", label: "تيك توك" },
  ];

  function switchPlatform(next: typeof platform) {
    setPlatform(next);
    // بنصفّر الحالة عند تغيير المنصة - قائمة حملات منصة تانية خالص، مش
    // منطقي نسيب الاختيار القديم أو نعرض بيانات المنصة القديمة بالغلط
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
          className="rounded-full bg-surface-raised px-4 py-1.5 text-xs text-text-primary"
        >
          {loading ? "جارٍ التحميل..." : "تحميل الحملات المتاحة"}
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
  const totalCount = accounts.reduce((s, a) => s + a.campaigns.length, 0);
  const activeCount = accounts.reduce((s, a) => s + a.campaigns.filter((c) => c.recentlyActive).length, 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-text-faint">
          {showAll ? `عرض كل الحملات (${totalCount})` : `الحملات النشطة آخر 10 أيام (${activeCount})`}
        </p>
        {totalCount > activeCount && (
          <button
            onClick={() => setShowAll((s) => !s)}
            className="text-xs text-accent"
          >
            {showAll ? "إخفاء القديمة" : `عرض كل الحملات (${totalCount - activeCount} إضافية)`}
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
                {!c.recentlyActive && <span className="text-xs text-text-faint">(غير نشطة مؤخراً)</span>}
              </label>
            ))}
          </div>
        );
      })}
      <button onClick={saveCampaigns} className="mt-2 rounded-full bg-accent px-4 py-1.5 text-xs text-white">
        {saved ? "تم الحفظ ✓" : "احفظ الاختيار"}
      </button>
      <p className="mt-2 text-xs text-text-faint">
        هيتم سحب كامل التاريخ المتاح للحملات المختارة تلقائياً في الخلفية.
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

      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-faint">مفاتيح التشغيل</div>
      <ToggleRow
        label="تحليلات الذكاء الاصطناعي"
        checked={form.enableAIInsights}
        onChange={(v) => setForm({ ...form, enableAIInsights: v })}
      />
      <ToggleRow
        label="قواعد الأتمتة (التشغيل الذكي)"
        checked={form.enableAutomationRules}
        onChange={(v) => setForm({ ...form, enableAutomationRules: v })}
      />
      <ToggleRow
        label="التشخيص اليومي"
        checked={form.enableDailyDiagnostics}
        onChange={(v) => setForm({ ...form, enableDailyDiagnostics: v })}
      />
      <ToggleRow
        label="فحص صحة التسعير"
        checked={form.enablePricingHealthChecks}
        onChange={(v) => setForm({ ...form, enablePricingHealthChecks: v })}
      />
      <ToggleRow
        label="تضمين المحادثات المجهولة (Modeled Attribution)"
        checked={form.useModeledAttribution}
        onChange={(v) => setForm({ ...form, useModeledAttribution: v })}
      />

      <div className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-text-faint">العتبات</div>
      <NumberRow
        label="حد سرعة الرد (دقيقة)"
        value={form.responseTimeThresholdMinutes}
        onChange={(v) => setForm({ ...form, responseTimeThresholdMinutes: v })}
      />
      <NumberRow
        label="حد تكرار الإعلان (تعب الكرياتيف)"
        value={form.adFatigueFrequencyThreshold}
        step={0.1}
        onChange={(v) => setForm({ ...form, adFatigueFrequencyThreshold: v })}
      />
      <NumberRow
        label="حد اعتبار محادثة ماسنجر ضغطة بالخطأ (دقيقة)"
        value={form.messengerInactivityThresholdMinutes}
        onChange={(v) => setForm({ ...form, messengerInactivityThresholdMinutes: v })}
      />

      <div className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-text-faint">مصدر التحويل الأساسي</div>
      <div className="flex gap-2">
        {[
          { value: "WHATSAPP", label: "واتساب" },
          { value: "MESSENGER", label: "ماسنجر" },
          { value: "LEAD_FORM", label: "فورم" },
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
        label="حد انخفاض CTR (%)"
        value={form.ctrDropThresholdPct}
        onChange={(v) => setForm({ ...form, ctrDropThresholdPct: v })}
      />
      <NumberRow
        label="حد تحذير التسعير (%)"
        value={form.pricingWarningThresholdPct}
        onChange={(v) => setForm({ ...form, pricingWarningThresholdPct: v })}
      />
      <NumberRow
        label="حد خطر التسعير (%)"
        value={form.pricingCriticalThresholdPct}
        onChange={(v) => setForm({ ...form, pricingCriticalThresholdPct: v })}
      />
      <NumberRow
        label="مضاعف المرتجعات الشاذة"
        value={form.rtoAnomalyMultiplier}
        step={0.1}
        onChange={(v) => setForm({ ...form, rtoAnomalyMultiplier: v })}
      />
      <NumberRow
        label="السقف الشهري لتغييرات الأتمتة (%)"
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
    <div className="mb-4 rounded-xl bg-surface p-4">
      <div className="mb-2 text-sm font-medium text-text-primary">التحقق بخطوتين (MFA)</div>
      <p className="mb-3 text-xs text-text-muted">
        طبقة حماية إضافية — حتى لو عرف أحدٌ كلمة سرك، لن يستطيع الدخول دون رمز من تطبيق المصادقة الخاص بك.
      </p>

      {enabled ? (
        !showDisableConfirm ? (
          <button
            onClick={() => setShowDisableConfirm(true)}
            className="rounded-full bg-surface-raised px-4 py-1.5 text-xs text-text-muted"
          >
            إلغاء تفعيل التحقق بخطوتين
          </button>
        ) : (
          <div>
            <p className="mb-2 text-xs text-text-faint">أدخل كلمة المرور للتأكيد:</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-2 w-full rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
            />
            {error && <p className="mb-2 text-xs text-critical">{error}</p>}
            <button
              onClick={handleDisable}
              disabled={loading}
              className="rounded-full bg-critical px-4 py-1.5 text-xs text-white disabled:opacity-50"
            >
              تأكيد الإلغاء
            </button>
          </div>
        )
      ) : setupData ? (
        <form onSubmit={confirmSetup}>
          <img src={setupData.qrCodeDataUrl} alt="QR Code" className="mb-2 h-40 w-40 rounded-xl bg-white p-2" />
          <p className="mb-2 text-xs text-text-faint">
            امسح الكود بتطبيق Google Authenticator أو مشابه، وأدخل الكود المكوّن من 6 أرقام:
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="mb-2 w-full rounded-xl bg-surface-raised px-3 py-2 text-center text-lg tracking-widest text-text-primary outline-none"
          />
          {error && <p className="mb-2 text-xs text-critical">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-accent px-4 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {loading ? "جارٍ التأكيد..." : "تفعيل"}
          </button>
        </form>
      ) : (
        <button
          onClick={startSetup}
          disabled={loading}
          className="rounded-full bg-accent px-4 py-1.5 text-xs text-white disabled:opacity-50"
        >
          {loading ? "جارٍ التحميل..." : "فعّل التحقق بخطوتين"}
        </button>
      )}
    </div>
  );
}

// ==================== منطقة الخطر ====================

function DangerZoneTab({ workspaces }: { workspaces: WorkspaceData[] }) {
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
      <div className="rounded-xl bg-critical/10 p-4">
        <div className="mb-2 text-sm font-medium text-critical">حذف مساحة عمل</div>
        <p className="mb-3 text-xs text-text-muted">
          هذا الإجراء نهائي — كل البيانات المرتبطة (الحملات، المهام، التقارير) هتتمسح ومينفعش ترجع تاني.
        </p>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="mb-2 w-full rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <p className="mb-2 text-xs text-text-faint">اكتب اسم مساحة العمل ({target?.name}) للتأكيد:</p>
        <TextInput value={confirmText} onChange={setConfirmText} placeholder={target?.name ?? ""} />
        <button
          onClick={handleDelete}
          disabled={confirmText !== target?.name}
          className="mt-2 rounded-full bg-critical px-4 py-1.5 text-xs text-white disabled:opacity-40"
        >
          احذف نهائياً
        </button>
      </div>

      <div className="mt-4 rounded-xl bg-surface p-4">
        <div className="mb-2 text-sm font-medium text-text-primary">تصدير بياناتي</div>
        <p className="mb-3 text-xs text-text-muted">
          نسخة كاملة من بياناتك بصيغة JSON قابلة للقراءة والنقل.
        </p>
        <a
          href="/api/account/export-data"
          className="inline-block rounded-full bg-surface-raised px-4 py-1.5 text-xs text-text-primary no-underline"
        >
          تحميل بياناتي
        </a>
      </div>

      <DeleteAccountSection />
    </SettingsSection>
  );
}

function DeleteAccountSection() {
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
      setError(data.error ?? "حصل خطأ");
    }
  }

  return (
    <div className="mt-4 rounded-xl bg-critical/10 p-4">
      <div className="mb-2 text-sm font-medium text-critical">حذف الحساب نهائياً</div>
      <p className="mb-3 text-xs text-text-muted">
        سيُحذف حسابك وكل مساحات العمل والبيانات المرتبطة به بالكامل. إجراء نهائي لا رجعة فيه.
      </p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-full bg-critical px-4 py-1.5 text-xs text-white"
        >
          احذف حسابي
        </button>
      ) : (
        <div>
          <p className="mb-2 text-xs text-text-faint">أدخل كلمة المرور للتأكيد:</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-2 w-full rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
          />
          {error && <p className="mb-2 text-xs text-critical">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleDeleteAccount}
              className="rounded-full bg-critical px-4 py-1.5 text-xs text-white"
            >
              تأكيد الحذف النهائي
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-full bg-surface-raised px-4 py-1.5 text-xs text-text-muted"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== عناصر مشتركة ====================

function SettingsSection({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-surface p-6">{children}</div>;
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
      className="mb-4 w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
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
      <button
        onClick={() => onChange(!checked)}
        className={`h-6 w-11 rounded-full transition-colors ${checked ? "bg-verified" : "bg-surface-raised"}`}
      >
        <span
          className="block rounded-full bg-white transition-transform"
          style={{ height: 18, width: 18, transform: checked ? "translateX(-22px)" : "translateX(-2px)" }}
        />
      </button>
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
        className="w-20 rounded-lg bg-surface-raised px-2 py-1 text-end text-sm text-text-primary outline-none"
      />
    </div>
  );
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
    </button>
  );
}
