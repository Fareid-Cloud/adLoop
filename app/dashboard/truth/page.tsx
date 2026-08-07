// app/dashboard/truth/page.tsx
//
// قسم الحقيقة: الفجوة بين ما تعلنه كل منصة وما تحقّق فعلاً - جوهر المنتج
// في صفحة واحدة، مع طبقة الإسناد متعدّد اللمسات وحالة إعادة رفع التحويلات.
//
// كل الحساب في lib/truthKpis.ts - هذه الصفحة تتحقّق من الجلسة وتمرّر فقط.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getTruthSnapshot } from "@/lib/truthKpis";
import { TruthView } from "./TruthView";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams, toDateBounds, daysBetween } from "@/lib/dateRange";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function TruthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // ثلاثة أزرار ثابتة ← فترة حرّة: السؤال "وماذا عن الأسبوع الماضي؟"
  // لم يكن له جواب هنا.
  const period = periodFromParams(sp);
  const days = daysBetween(period.range.from, period.range.to);

  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return (
      <div className="py-20 text-center text-text-muted">{t(locale, "ui.sessionExpired")}</div>
    );
  }

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return (
      <EmptyState
        title={t(locale, "common.noWorkspace")}
        description={t(locale, "common.noWorkspaceHint")}
      />
    );
  }

  const snapshot = await getTruthSnapshot(workspace.id, days);

  return (
    <TruthView
      workspaceName={workspace.name}
      currency={workspace.currency}
      snapshot={snapshot}
      locale={(user.preferredLocale as "ar" | "en") ?? "ar"}
      periodSlot={
        <PeriodBar
          locale={(user.preferredLocale as "ar" | "en") ?? "ar"}
          preset={period.preset}
          range={period.range}
          compare={period.compare}
        />
      }
    />
  );
}
