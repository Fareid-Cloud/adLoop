// app/dashboard/campaigns/lead-forms/page.tsx
//
// "جودة عملاء فورم المنصات الداخلي مقارنة بفورم موقعي؟" - عدد الليدز
// من كل مصدر (جوجل/ميتا/تيك توك الداخلي، فورم موقعك)، جنب بعض.
// ميتا محتاجة تفعيل صلاحيات (activation-checklist.md قسم 4هـ).

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { countGenuineLeads } from "@/lib/messengerLeadQuality";

export default async function LeadFormsPage() {
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

  const [byPlatform, websiteFormCount, messengerConversations] = await Promise.all([
    prisma.leadFormSubmission.groupBy({
      by: ["platform"],
      where: { workspaceId: workspace.id, submittedAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
    prisma.ctaClickEvent.count({
      where: { workspaceId: workspace.id, ctaType: "FORM", clickedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.messengerConversation.findMany({
      where: { workspaceId: workspace.id, firstMessageAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  // إصلاح فجوة حقيقية: countGenuineLeads كانت مبنية ومعزولة تماماً -
  // أول استخدام حقيقي ليها هنا، بتعطي ملخص واضح "كام تواصل حقيقي مقابل
  // ضغطة بالخطأ" بدل ما تفضل الأرقام دي مدفونة في قاعدة البيانات بس
  const messengerBreakdown = messengerConversations.length > 0
    ? countGenuineLeads(
        messengerConversations.map((c: any) => ({
          conversationId: c.id,
          hasAutomatedGreeting: true,
          humanRepliesCount: Math.max(0, c.messageCount - 1),
          minutesSinceLastActivity: (Date.now() - c.lastMessageAt.getTime()) / 60000,
        })),
        workspace.messengerInactivityThresholdMinutes
      )
    : null;

  const googleCount = byPlatform.find((p: any) => p.platform === "GOOGLE_ADS")?._count ?? 0;
  const metaCount = byPlatform.find((p: any) => p.platform === "META_ADS")?._count ?? 0;
  const tiktokCount = byPlatform.find((p: any) => p.platform === "TIKTOK_ADS")?._count ?? 0;
  const hasAnyData = googleCount > 0 || metaCount > 0 || tiktokCount > 0 || websiteFormCount > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">فورم المنصات الداخلي مقابل فورم موقعك</h1>
      <p className="mb-6 text-xs text-text-faint">
        عدد الليدز من كل مصدر آخر 30 يوم. ملاحظة: "الجودة" الفعلية (هل تحوّلوا لعملاء حقيقيين)
        محتاجة ربط يدوي بنتائج فريق المبيعات - العدد هنا بس، مش نسبة التحويل النهائية.
      </p>

      {!hasAnyData ? (
        <EmptyState
          title="لا توجد بيانات بعد"
          description="فورم ميتا الداخلي محتاج تفعيل صلاحيات إضافية (راجع دليل التفعيل)."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-surface p-5 text-center">
            <div className="font-mono text-3xl text-text-primary">{googleCount}</div>
            <div className="mt-1 text-xs text-text-faint">فورم جوجل الداخلي</div>
          </div>
          <div className="rounded-2xl bg-surface p-5 text-center">
            <div className="font-mono text-3xl text-text-primary">{metaCount}</div>
            <div className="mt-1 text-xs text-text-faint">فورم ميتا الداخلي</div>
          </div>
          <div className="rounded-2xl bg-surface p-5 text-center">
            <div className="font-mono text-3xl text-text-primary">{tiktokCount}</div>
            <div className="mt-1 text-xs text-text-faint">فورم تيك توك الداخلي</div>
          </div>
          <div className="rounded-2xl bg-surface p-5 text-center">
            <div className="font-mono text-3xl text-text-primary">{websiteFormCount}</div>
            <div className="mt-1 text-xs text-text-faint">فورم موقعك</div>
          </div>
        </div>
      )}

      {messengerBreakdown && (
        <>
          <div className="mb-2 mt-8 text-[13px] text-text-muted">جودة محادثات ماسنجر (آخر 30 يوم)</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-verified/[0.06] p-4 text-center">
              <div className="font-mono text-2xl text-verified">{messengerBreakdown.genuineCount}</div>
              <div className="mt-1 text-xs text-text-faint">تواصل حقيقي</div>
            </div>
            <div className="rounded-2xl bg-critical/[0.06] p-4 text-center">
              <div className="font-mono text-2xl text-critical">{messengerBreakdown.likelyAccidentalCount}</div>
              <div className="mt-1 text-xs text-text-faint">ضغطة بالخطأ (الأرجح)</div>
            </div>
            <div className="rounded-2xl bg-surface p-4 text-center">
              <div className="font-mono text-2xl text-text-muted">{messengerBreakdown.pendingCount}</div>
              <div className="mt-1 text-xs text-text-faint">ما زالت تحتاج وقتاً للتقييم</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
