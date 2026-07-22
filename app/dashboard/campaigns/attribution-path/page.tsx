// app/dashboard/campaigns/attribution-path/page.tsx
//
// "العميل شاف إعلان على إنستجرام وبعدين اشترى من جوجل - مين ياخد الفضل؟"
// - مفيش API واحدة بتجاوب على السؤال ده (جوجل وميتا مبيشاركوش بيانات
// عميل مع بعض)، لكن عندنا بيانات حقيقية جمعناها احنا: CtaClickEvent
// بتسجل كل كليك من أي منصة لنفس الجلسة، SessionConversion بتسجل التحويل
// الفعلي. الصفحة دي بتوضح "أنهي منصات لمست نفس الجلسة قبل ما تتحول" -
// صورة واقعية مبنية على تتبعنا احنا، مش افتراض.
//
// ملاحظة أمانة مهمة: ده بيغطي بس التفاعلات اللي مرّت عبر أداة التتبع
// بتاعتنا (كليكات واتساب/اتصال/فورم) - مش بيشمل مشاهدة إعلان من غير
// كليك (زي مشاهدة ريلز بدون تفاعل)، لأن ده مش بيترصد أصلاً عند حد.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE_ADS: "جوجل",
  META_ADS: "ميتا",
  TIKTOK_ADS: "تيك توك",
  SNAPCHAT_ADS: "سناب شات",
};

export default async function AttributionPathPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لا توجد مساحة عمل بعد" description="ارجع إلى لمحة لإنشاء أول مساحة عمل." />;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const conversions = await prisma.sessionConversion.findMany({
    where: { workspaceId: workspace.id, convertedAt: { gte: thirtyDaysAgo } },
    take: 500,
  });

  if (conversions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-[26px] font-semibold text-text-primary">مسار العميل عبر المنصات</h1>
        <EmptyState title="لا توجد تحويلات بعد" description="تُبنى الصورة تلقائياً كل ما تحويلات حقيقية تحصل." />
      </div>
    );
  }

  const sessionIds = conversions.map((c: any) => c.sessionId);
  const allClicks = await prisma.ctaClickEvent.findMany({
    where: { workspaceId: workspace.id, sessionId: { in: sessionIds } },
    select: { sessionId: true, clickPlatform: true, clickedAt: true },
  });

  const clicksBySession = new Map<string, Set<string>>();
  for (const click of allClicks) {
    const platform = click.clickPlatform ?? "GOOGLE_ADS";
    const set = clicksBySession.get(click.sessionId) ?? new Set();
    set.add(platform);
    clicksBySession.set(click.sessionId, set);
  }

  let singleTouch = 0;
  let multiTouch = 0;
  const pathCounts = new Map<string, number>();

  for (const sessionId of sessionIds) {
    const platforms = Array.from(clicksBySession.get(sessionId) ?? []).sort();
    if (platforms.length <= 1) {
      singleTouch++;
    } else {
      multiTouch++;
      const pathKey = platforms.join(" ← ");
      pathCounts.set(pathKey, (pathCounts.get(pathKey) ?? 0) + 1);
    }
  }

  const topPaths = Array.from(pathCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const multiTouchPct = conversions.length > 0 ? Math.round((multiTouch / conversions.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">مسار العميل عبر المنصات</h1>
      <p className="mb-6 text-xs text-text-faint">
        مبني على تتبعنا الفعلي للكليكات، مش تخمين - جوجل وميتا ما بيشاركوش بيانات عميل مع بعض،
        فالصورة دي محدودة بالتفاعلات اللي مرّت عبر أداة التتبع الخاصة بنا فقط.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface p-4 text-center">
          <div className="font-mono text-2xl text-text-primary">{100 - multiTouchPct}%</div>
          <div className="text-xs text-text-faint">منصة واحدة قبل التحويل</div>
        </div>
        <div className="rounded-2xl bg-surface p-4 text-center">
          <div className="font-mono text-2xl text-verified">{multiTouchPct}%</div>
          <div className="text-xs text-text-faint">أكتر من منصة قبل التحويل</div>
        </div>
      </div>

      {topPaths.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-semibold text-text-primary">أكتر المسارات المتعددة تكراراً</div>
          <div className="flex flex-col gap-2">
            {topPaths.map(([path, count]) => (
              <div key={path} className="flex items-center justify-between rounded-2xl bg-surface p-4">
                <span className="text-sm text-text-primary">
                  {path.split(" ← ").map((p) => PLATFORM_LABELS[p] ?? p).join(" ← ")}
                </span>
                <span className="font-mono text-sm text-verified">{count} تحويل</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
