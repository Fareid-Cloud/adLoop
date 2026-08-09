// app/dashboard/HomePanels.tsx
//
// اللوحات الثلاث أعلى الصفحة الرئيسية: تقدّم الإعداد، وسجلّ النشاط،
// والمنصّات المربوطة.
//
// قاعدتان تحكمانها:
//
// ١) **تظهر النتائج مبكراً.** كانت الصفحة تخفي كل شيء حتى تكتمل البيانات،
//    فيقف المستخدم أمام صفحة فارغة بعد أن أدّى ثلاث خطوات فعلاً. أي بيانات
//    وصلت تُعرض فوراً، والناقص يُقال بوضوح بدل أن يُخفى.
//
// ٢) **سجلّ النشاط من مصادر حقيقية لا مولَّد.** كل سطر فيه له صفّ في قاعدة
//    البيانات: عملية مزامنة، قرار طُبِّق، تحويل تحقّق. سجلّ نشاط مُخترع
//    أسوأ من غيابه لأنه يوحي بحياة ليست موجودة.

import Link from "next/link";
import {
  Check, ChevronLeft, RefreshCw, ShieldCheck, AlertTriangle, Zap,
  CircleDot, ArrowLeft, TrendingUp, Upload, ShieldAlert, GitBranch,
  MessageCircle, BookOpen,
} from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { t, relativeFromDate, type Locale } from "@/lib/i18n/dictionary";
import type { SetupProgress } from "@/lib/setupProgress";
import { OpenSupportButton } from "./OpenSupportButton";

export interface ActivityRow {
  id: string;
  kind: "SYNC" | "ACTION" | "VERIFIED" | "ALERT";
  title: string;
  detail: string | null;
  at: string;
  platform: string | null;
  ok: boolean;
}

export interface PlatformCard {
  platform: string;
  connected: boolean;
  campaignCount: number;
  lastSyncAt: string | null;
  healthy: boolean;
}

// ==================== تقدّم الإعداد (مضغوط) ====================

export function SetupProgressPanel({
  progress, locale, ctaHref,
}: {
  progress: SetupProgress;
  locale: Locale;
  ctaHref: string;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `homePanels.${k}`, v);
  const pct = Math.round((progress.completedCount / progress.total) * 100);

  return (
    <section className="card pad-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">
          {tr("readyPct", { pct })}
        </h2>
        <span className="text-[12px] text-text-muted">
          {tr("stepOf", { a: Math.min(progress.completedCount + 1, progress.total), b: progress.total })}
        </span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mb-3 flex flex-col gap-1">
        {progress.steps.map((s, i) => {
          const isNext = progress.nextStep?.id === s.id;
          return (
            <li
              key={s.id}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${isNext ? "bg-accent/[0.06]" : ""}`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  s.done ? "bg-verified text-white" : isNext ? "bg-accent text-white" : "border border-border bg-surface-raised text-text-faint"
                }`}
              >
                {/* 🔴 كانت `s.done ? <Check/> : i + 1`، فيبتلع المكتملُ رقمَه
                    ويُقرأ التسلسل ١ ٢ ٣ ٤ ٥ ✓ ٧ - رقمٌ ضائع يبدو خطأً في
                    الترقيم لا خطوةً منجَزة. الرقم موضعٌ في المسار والعلامة
                    حالة: معلومتان مختلفتان، والشارة كانت تحمل واحدةً فقط.
                    الرقم يبقى، والخلفية الخضراء وحدها تقول إنّها تمّت. */}
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[12.5px] font-medium ${s.done ? "text-text-muted" : "text-text-primary"}`}>
                  {locale === "en" ? s.titleEn : s.titleAr}
                </span>
                {isNext && (
                  <span className="block truncate text-[11px] text-text-muted">
                    {locale === "en" ? s.descEn : s.descAr}
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  s.done ? "bg-verified/12 text-verified" : isNext ? "bg-accent/12 text-accent" : "bg-surface-raised text-text-faint"
                }`}
              >
                {s.done ? tr("completed") : isNext ? tr("inProgress") : tr("pending")}
              </span>
            </li>
          );
        })}
      </ul>

      {progress.nextStep && (
        <Link
          href={ctaHref}
          className="btn btn-primary btn-block"
        >
          {tr("continueSetup")}
          <ArrowLeft size={14} className="rtl:rotate-0 ltr:rotate-180" />
        </Link>
      )}
    </section>
  );
}

// ==================== سجلّ النشاط ====================

const KIND_META: Record<ActivityRow["kind"], { Icon: typeof RefreshCw; tone: string }> = {
  SYNC: { Icon: RefreshCw, tone: "var(--accent)" },
  ACTION: { Icon: Zap, tone: "var(--gap)" },
  VERIFIED: { Icon: ShieldCheck, tone: "var(--verified)" },
  ALERT: { Icon: AlertTriangle, tone: "var(--critical)" },
};

export function RecentActivityPanel({
  rows, locale,
}: {
  rows: ActivityRow[];
  locale: Locale;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `homePanels.${k}`, v);

  return (
    <section className="card pad-md">
      {/* العنوان يلتفّ والرابط لا ينكمش: بلا `min-w-0` على الكتلة اليسرى
          يزاحم العنوانُ الرابطَ فيدفعه خارج البطاقة، وبلا `shrink-0` على
          الرابط ينضغط «View all» حتى يصير حرفاً واحداً. */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">
            {tr("recentActivity")}
          </h2>
          <p className="mt-0.5 text-[12px] text-text-muted">{tr("recentActivityHint")}</p>
        </div>
        <Link
          href="/dashboard/actions"
          className="shrink-0 whitespace-nowrap pt-0.5 text-[12px] font-medium text-accent no-underline"
        >
          {tr("viewAll")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="card-ghost pad-lg text-center text-[12.5px] text-text-muted">
          {tr("noActivity")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => {
            const { Icon, tone } = KIND_META[r.kind];
            return (
              <li key={r.id} className="flex items-start gap-2.5">
                <span className="w-[52px] shrink-0 pt-0.5 text-[11px] tabular-nums text-text-faint">
                  {relativeFromDate(locale, r.at) ?? "—"}
                </span>
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: r.ok ? "var(--verified)" : "var(--critical)" }}
                />
                <span className="min-w-0 flex-1">
                  {/* 🔴 `min-w-0` هنا أيضاً لا على الأب وحده: عنصر المرونة
                      يأخذ `min-width: auto` افتراضياً، أي أنّه **يرفض أن
                      يضيق دون عرض محتواه**. فالـ`truncate` على الابن لا
                      يعمل - لا شيء يسمح له بالضيق - ويتمدّد الصفّ حتى يدفع
                      عمود الشبكة كلّه خارج الشاشة. وهذا سبب «البطاقات
                      مقطوعة» على سطح المكتب والهاتف معاً: القصّ ليس في
                      البطاقة بل في صفٍّ داخلها لا يقبل الانكماش.
                      القاعدة: كلّ سلف بين `truncate` وحدّ الشاشة يحتاج
                      `min-w-0` - واحد يفوت يُبطل السلسلة كلّها. */}
                  <span className="flex min-w-0 items-center gap-1.5">
                    {r.platform ? <PlatformLogo platform={r.platform} size={13} /> : <Icon size={12} style={{ color: tone }} />}
                    <span className="truncate text-[12.5px] font-medium text-text-primary">{r.title}</span>
                  </span>
                  {r.detail && <span className="mt-0.5 block truncate text-[11.5px] text-text-muted">{r.detail}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ==================== المنصّات المربوطة ====================

export function ConnectedPlatformsPanel({
  cards, locale,
}: {
  cards: PlatformCard[];
  locale: Locale;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `homePanels.${k}`, v);
  const connected = cards.filter((c) => c.connected);
  const allHealthy = connected.length > 0 && connected.every((c) => c.healthy);

  return (
    <section className="card pad-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">{tr("connectedPlatforms")}</h2>
        {connected.length > 0 && (
          <span className={`flex items-center gap-1.5 text-[12px] ${allHealthy ? "text-verified" : "text-gap"}`}>
            <CircleDot size={12} />
            {allHealthy ? tr("allOperational") : tr("someNeedAttention")}
          </span>
        )}
      </div>

      {connected.length === 0 ? (
        <Link
          href="/dashboard/integrations"
          className="flex items-center justify-between gap-2 card-ghost pad-md no-underline"
        >
          <span className="text-[12.5px] text-text-muted">{tr("noPlatforms")}</span>
          <span className="flex items-center gap-1 text-[12.5px] font-medium text-accent">
            {tr("connectNow")}
            <ChevronLeft size={13} className="rtl:rotate-0 ltr:rotate-180" />
          </span>
        </Link>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {connected.map((c) => (
            <Link
              key={c.platform}
              href="/dashboard/integrations"
              className="bg-surface-raised p-3 no-underline transition-colors hover:border-accent"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <PlatformLogo platform={c.platform} size={20} />
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: c.healthy ? "var(--verified)" : "var(--gap)" }}
                />
              </div>
              <div className="truncate text-[12.5px] font-medium text-text-primary">
                {t(locale, `common.p${platformKey(c.platform)}`)}
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                {tr("nCampaigns", { n: c.campaignCount })}
              </div>
              <div className="mt-0.5 text-[10.5px] text-text-faint">
                {c.lastSyncAt ? tr("lastSync", { when: relativeFromDate(locale, c.lastSyncAt) ?? "—" }) : tr("neverSynced")}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}


// ==================== ماذا تحصل بعد التفعيل ====================
//
// يُعرض **قبل ظهور النتائج**: المستخدم الذي لم يركّب الوسم بعد يقف أمام
// لوحة بلا أرقام، فيحتاج أن يعرف ما ينتظره تحديداً لا أن يُترك يخمّن.
// يختفي وحده فور وصول أوّل بيانات - عندها الأرقام تتكلّم عن نفسها.

const BENEFITS = [
  { key: "VerifiedLeads", Icon: ShieldCheck, tone: "var(--verified)" },
  { key: "RealRoas", Icon: TrendingUp, tone: "var(--accent)" },
  { key: "OfflineUpload", Icon: Upload, tone: "var(--accent)" },
  { key: "FakeDetection", Icon: ShieldAlert, tone: "var(--critical)" },
  { key: "Attribution", Icon: GitBranch, tone: "var(--gap)" },
  { key: "Automation", Icon: Zap, tone: "var(--gap)" },
] as const;

export function AfterActivationPanel({ locale }: { locale: Locale }) {
  const tr = (k: string) => t(locale, `homePanels.${k}`);
  return (
    <section className="card pad-md">
      <h2 className="section-title">{tr("afterActivation")}</h2>
      <p className="mb-3 mt-0.5 text-[12px] leading-relaxed text-text-muted">{tr("afterActivationHint")}</p>
      <ul className="flex flex-col gap-2.5">
        {BENEFITS.map(({ key, Icon, tone }) => (
          <li key={key} className="flex items-start gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `color-mix(in srgb, ${tone} 12%, transparent)`, color: tone }}
            >
              <Icon size={15} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium text-text-primary">{tr(`a${key}`)}</span>
              <span className="block text-[11.5px] leading-relaxed text-text-muted">{tr(`a${key}Body`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ==================== الدعم ====================

export function SupportPanel({
  locale, whatsappNumber,
}: {
  locale: Locale;
  /** رقم واتساب الدعم - يُخفى الخيار كلّه إن لم يُضبط بدل رابط معطّل */
  whatsappNumber: string | null;
}) {
  const tr = (k: string) => t(locale, `homePanels.${k}`);
  const waHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}`
    : null;

  return (
    <section className="card pad-md">
      <h2 className="section-title">{tr("support")}</h2>
      <p className="mb-3 mt-0.5 text-[12px] text-text-muted">{tr("supportHint")}</p>

      <div className="flex flex-col gap-2">
        <SupportRow
          Icon={MessageCircle}
          tone="var(--accent)"
          title={tr("supportChat")}
          body={tr("supportChatBody")}
          opensSupport
        />
        {waHref && (
          <SupportRow
            Icon={MessageCircle}
            tone="#25D366"
            title={tr("supportWhatsapp")}
            body={tr("supportWhatsappBody")}
            href={waHref}
            external
          />
        )}
        <SupportRow
          Icon={BookOpen}
          tone="var(--gap)"
          title={tr("supportGuide")}
          body={tr("supportGuideBody")}
          href="/dashboard/help"
        />
      </div>
    </section>
  );
}

function SupportRow({
  Icon, tone, title, body, href, external, opensSupport,
}: {
  Icon: typeof MessageCircle;
  tone: string;
  title: string;
  body: string;
  href?: string;
  external?: boolean;
  /** يفتح درج الدعم الجانبي - المُعالِج نفسه يعيش في مكوّن عميل */
  opensSupport?: boolean;
}) {
  const inner = (
    <>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in srgb, ${tone} 12%, transparent)`, color: tone }}
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium text-text-primary">{title}</span>
        <span className="block text-[11.5px] text-text-muted">{body}</span>
      </span>
      <ChevronLeft size={14} className="shrink-0 text-text-faint rtl:rotate-0 ltr:rotate-180" />
    </>
  );

  const cls = "flex items-center gap-2.5 bg-surface-raised p-2.5 no-underline transition-colors hover:border-accent";

  if (opensSupport)
    return <OpenSupportButton className={`${cls} w-full text-start`}>{inner}</OpenSupportButton>;
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
    : <Link href={href ?? "#"} className={cls}>{inner}</Link>;
}

/** GOOGLE_ADS → Google، لمطابقة مفاتيح أسماء المنصّات في القاموس */
function platformKey(platform: string): string {
  return {
    GOOGLE_ADS: "Google",
    META_ADS: "Meta",
    TIKTOK_ADS: "Tiktok",
    SNAPCHAT_ADS: "Snapchat",
  }[platform] ?? "Google";
}
