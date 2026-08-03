// app/dashboard/campaigns/pmax/page.tsx
//
// "حملة Performance Max بتصرف فلوسي فين بالظبط؟" - كانت صندوق أسود
// تماماً، من v23 (يناير 2026) بقينا نعرف القناة الفعلية.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

const CHANNEL_LABELS: Record<string, string> = {
  SEARCH: "pmSearch",
  SEARCH_PARTNERS: "pmSearchPartners",
  GMAIL: "Gmail",
  YOUTUBE: "pmYoutube",
  DISPLAY: "pmDisplay",
  DISCOVER: "Discover",
  MAPS: "pmMaps",
  MIXED: "pmMixed",
};

export default async function PmaxPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const rows = await prisma.pmaxChannelSnapshot.groupBy({
    by: ["channel"],
    where: { workspaceId: workspace.id },
    _sum: { impressions: true, clicks: true, cost: true, conversions: true },
  });

  const results = rows
    .map((r: any) => {
      const cost = r._sum.cost ?? 0;
      const conv = r._sum.conversions ?? 0;
      return {
        channel: r.channel,
        cost,
        clicks: r._sum.clicks ?? 0,
        conversions: conv,
        cpa: conv > 0 ? Math.round((cost / conv) * 100) / 100 : null,
      };
    })
    .sort((a: any, b: any) => b.cost - a.cost);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">قنوات Performance Max</h1>
      <p className="mb-6 text-xs text-text-faint">
        الصندوق الأسود بقى شفافاً - إنفاقك موزّع فعلياً على أي قناة. البيانات متاحة فقط اعتباراً من يونيو 2025.
      </p>

      {results.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات قنوات بعد"
          description="إما لا توجد حملات Performance Max نشطة، أو لم تُسحب البيانات بعد."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((r: any) => (
            <div key={r.channel} className="flex items-center justify-between rounded-2xl bg-surface p-4">
              <span className="text-sm font-medium text-text-primary">
                {/* المفتاح يمرّ على `t()` - كان يُطبع خاماً (pmSearch) */}
                {CHANNEL_LABELS[r.channel]
                  ? t(locale, `campPages.${CHANNEL_LABELS[r.channel]}`)
                  : r.channel}
              </span>
              <div className="flex items-center gap-4 text-xs text-text-faint">
                <span>{r.clicks.toLocaleString()} كليكة</span>
                <span>{r.cost.toLocaleString()} تكلفة</span>
                <span className="font-mono text-verified">{r.cpa ?? "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
