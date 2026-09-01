// app/components/ui/PageEmptyStates.tsx
//
// حالات فارغة مخصّصة لكل صفحة في الداشبورد - كل صفحة ليها نصّها ואיقونتها
// وحدثها الخاص. بدل EmptyState العامة اللي بتعرض نفس الشكل في كل مكان.
//
// المبدأ: الصفحة الفارغة مش "مفيش بيانات" بس - دي فرصة تقول للمستخدم
// "تعالى نبدأ" بأسلوب يليق بالمحتوى اللي المفروض يظهر هنا.

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Megaphone, BarChart3, ShoppingCart, Target, ShieldCheck,
  Zap, FileText, Users, Settings, ArrowLeft, Link2, Globe,
} from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

interface PageEmptyProps {
  locale: Locale;
  workspaceId?: string;
}

// ═══════════════════════════════════════════════════════════════
// Base component - الشكل المشترك لكل حالات الصفحة الفارغة
// ═══════════════════════════════════════════════════════════════

function PageEmpty({
  icon: Icon,
  iconColor,
  title,
  description,
  action,
  locale,
}: {
  icon: typeof Megaphone;
  iconColor: string;
  title: string;
  description: string;
  action?: ReactNode;
  locale: Locale;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: `${iconColor}15`, color: iconColor }}
      >
        <Icon size={26} />
      </span>
      <h3 className="mb-2 text-[16px] font-semibold text-text-primary">{title}</h3>
      <p className="mb-6 max-w-sm text-[13px] leading-relaxed text-text-muted">{description}</p>
      {action}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Campaigns page
// ═══════════════════════════════════════════════════════════════

export function CampaignsEmpty({ locale, workspaceId }: PageEmptyProps) {
  const ar = locale === "ar";
  return (
    <PageEmpty
      icon={Megaphone}
      iconColor="var(--accent)"
      title={t(locale, "emptyStates.noCampaignsLinkedYet")}
      description={
        t(locale, "emptyStates.descCampaigns")
      }
      locale={locale}
      action={
        <Link href="/dashboard/integrations" className="btn btn-primary">
          <Link2 size={15} />
          {t(locale, "emptyStates.connectAccount")}
          <ArrowLeft size={13} className="rtl:rotate-0 ltr:rotate-180" />
        </Link>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Diagnostics / Tracking page
// ═══════════════════════════════════════════════════════════════

export function TrackingEmpty({ locale }: PageEmptyProps) {
  const ar = locale === "ar";
  return (
    <PageEmpty
      icon={ShieldCheck}
      iconColor="var(--verified)"
      title={t(locale, "emptyStates.trackingNotSetUp")}
      description={
        t(locale, "emptyStates.descTracking")
      }
      locale={locale}
      action={
        <Link href="/dashboard/tracking" className="btn btn-primary">
          <Zap size={15} />
          {t(locale, "emptyStates.setUpTracking")}
          <ArrowLeft size={13} className="rtl:rotate-0 ltr:rotate-180" />
        </Link>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Truth Center page
// ═══════════════════════════════════════════════════════════════

export function TruthCenterEmpty({ locale }: PageEmptyProps) {
  const ar = locale === "ar";
  return (
    <PageEmpty
      icon={BarChart3}
      iconColor="var(--gap)"
      title={t(locale, "emptyStates.notEnoughDataYet")}
      description={
        t(locale, "emptyStates.descTruth")
      }
      locale={locale}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Ecommerce / Store page
// ═══════════════════════════════════════════════════════════════

export function StoreEmpty({ locale }: PageEmptyProps) {
  const ar = locale === "ar";
  return (
    <PageEmpty
      icon={ShoppingCart}
      iconColor="var(--accent)"
      title={t(locale, "emptyStates.noStoreConnectedYet")}
      description={
        t(locale, "emptyStates.descStore")
      }
      locale={locale}
      action={
        <Link href="/dashboard/integrations" className="btn btn-primary">
          <Link2 size={15} />
          {t(locale, "emptyStates.connectStore")}
          <ArrowLeft size={13} className="rtl:rotate-0 ltr:rotate-180" />
        </Link>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Reports page
// ═══════════════════════════════════════════════════════════════

export function ReportsEmpty({ locale }: PageEmptyProps) {
  const ar = locale === "ar";
  return (
    <PageEmpty
      icon={FileText}
      iconColor="var(--accent)"
      title={t(locale, "emptyStates.noSavedReportsYet")}
      description={
        t(locale, "emptyStates.descReports")
      }
      locale={locale}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Competitors page
// ═══════════════════════════════════════════════════════════════

export function CompetitorsEmpty({ locale }: PageEmptyProps) {
  const ar = locale === "ar";
  return (
    <PageEmpty
      icon={Users}
      iconColor="var(--accent)"
      title={t(locale, "emptyStates.noCompetitorsTrackedYet")}
      description={
        t(locale, "emptyStates.descCompetitors")
      }
      locale={locale}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Settings page
// ═══════════════════════════════════════════════════════════════

export function SettingsEmpty({ locale }: PageEmptyProps) {
  const ar = locale === "ar";
  return (
    <PageEmpty
      icon={Settings}
      iconColor="var(--text-muted)"
      title={t(locale, "emptyStates.yourSettingsAreReady")}
      description={
        t(locale, "emptyStates.descSettings")
      }
      locale={locale}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Integrations page (when nothing connected)
// ═══════════════════════════════════════════════════════════════

export function IntegrationsEmpty({ locale }: PageEmptyProps) {
  const ar = locale === "ar";
  return (
    <PageEmpty
      icon={Globe}
      iconColor="var(--accent)"
      title={t(locale, "emptyStates.noPlatformsConnectedYet")}
      description={
        t(locale, "emptyStates.descPlatforms")
      }
      locale={locale}
    />
  );
}
