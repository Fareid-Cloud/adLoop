// app/dashboard/campaigns/competitor-ads/page.tsx
//
// السؤال: "ماذا يعرض منافسيّ الآن؟"
//
// السحب الآلي غير ممكن: واجهة مكتبة إعلانات ميتا تُرجع الإعلانات التجارية
// لدول الاتحاد الأوروبي وبريطانيا فقط (قيد قانون الخدمات الرقمية)، وما
// عداها إعلانات سياسية وحدها - تأكّدنا من ذلك قبل البناء لا بعده.
//
// فالرصد يدوي، لكن ما يُشتقّ فوقه ليس كذلك: مدّة بقاء كل إعلان إشارة لا
// تعرضها المكتبة، وهي أصدق ما يكشف الإعلان الرابح لدى المنافس.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getCompetitorBoard } from "@/lib/competitorBoard";
import { CompetitorBoardClient } from "./CompetitorBoardClient";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export const dynamic = "force-dynamic";

export default async function CompetitorAdsPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const board = await getCompetitorBoard(workspace.id);

  return <CompetitorBoardClient workspaceId={workspace.id} board={board} locale={locale} />;
}
