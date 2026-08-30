// app/api/workspaces/[id]/campaign-links/route.ts

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { backfillHistoricalData } from "@/lib/syncGoogleAds";
import { computeSmartDefaults } from "@/lib/dashboardDefaults";
import { checkAdAccountLimit } from "@/lib/entitlements";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({
    where: { id: id, ...workspaceAccess(user.id) },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const links = await prisma.campaignLink.findMany({ where: { workspaceId: id } });
  return NextResponse.json({ links });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // لازم نتأكد إن الـ Workspace ده فعلاً ملك المستخدم قبل أي تعديل - نفس
  // مبدأ التحقق من الملكية اللي حددناه في الـ ADR §7
  const workspace = await prisma.workspace.findFirst({
    where: { id: id, ...workspaceAccess(user.id) },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { campaigns } = await req.json();
  // campaigns: Array<{ platform, externalAccountId, externalCampaignId, campaignName }>

  if (!Array.isArray(campaigns)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // 🔴 حدّ الحسابات الإعلانية يُفحص **هنا** لا في مسار OAuth: الموافقة على
  // OAuth قد تكون تجديداً لصلاحيةٍ منتهية ولا تُنشئ عبئاً بذاتها، بينما ربطُ
  // حملةٍ من حسابٍ جديد يبدأ مزامنةً يومية له من الغد.
  //
  // ويُفحص لكلّ منصّة على حدة لأنّ الحدّ نفسه لكلّ منصّة: ثلاثة حسابات جوجل
  // وثلاثة ميتا، لا ثلاثة موزّعة عليهما.
  const byPlatform = new Map<string, string[]>();
  for (const c of campaigns as Array<{ platform?: string; externalAccountId?: string }>) {
    if (!c?.platform || !c?.externalAccountId) continue;
    const list = byPlatform.get(c.platform) ?? [];
    list.push(c.externalAccountId);
    byPlatform.set(c.platform, list);
  }
  // 🔴 **المعرّف الخارجي يُثبَت أنّه ضمن ما تصله منح المستخدم قبل كتابته.**
  // كان يُكتب من جسم الطلب كما هو، ثمّ تعتمد عليه ويب هوكس المتاجر وليدز
  // ميتا كمفتاح ملكيةٍ وحيد: يزرع مهاجمٌ معرّفَ تاجرٍ آخر في مساحته، فيُوجَّه
  // إليه إيرادُ الضحية وتُدمَّر ليداتها. المصدر الوحيد المقبول هو
  // `ConnectedAccount` - ما رأته المنصّة فعلاً ضمن منحة هذا المستخدم.
  const grantedAccounts = await prisma.connectedAccount.findMany({
    where: { connection: { userId: user.id } },
    select: { platform: true, externalAccountId: true },
  });
  const grantedByPlatform = new Map<string, Set<string>>();
  for (const a of grantedAccounts) {
    const set = grantedByPlatform.get(a.platform) ?? new Set<string>();
    set.add(a.externalAccountId);
    grantedByPlatform.set(a.platform, set);
  }
  for (const [platform, accountIds] of byPlatform) {
    const granted = grantedByPlatform.get(platform);
    // قائمةٌ فارغةٌ لهذه المنصّة تعني أنّنا لم نكتشف حساباتها بعد (ربطٌ
    // قديمٌ سابقٌ لهذا الجدول)، لا أنّ المستخدم لا يملك شيئاً - فلا نرفض
    // بها ونمنع عميلاً شرعياً من الحفظ. والمهاجم لا يستفيد: فتحُ نافذة
    // اختيار الحملات (المسار الوحيد الذي يصل إلى هنا) يملأ القائمة أوّلاً،
    // فيصير الرفض سارياً عليه. تشديدُها إلى رفضٍ مطلق يحتاج تعبئةً رجعيّة
    // للجدول أوّلاً - قرارٌ منفصل موثَّق في التقرير.
    if (!granted || granted.size === 0) continue;
    for (const accountId of accountIds) {
      if (!granted.has(accountId)) {
        return NextResponse.json(
          { error: "account_not_granted", platform, externalAccountId: accountId },
          { status: 403 }
        );
      }
    }
  }

  for (const [platform, accountIds] of byPlatform) {
    const check = await checkAdAccountLimit(user.id, platform, accountIds, id);
    if (!check.allowed) {
      // الرفض يحمل معه ما يلزم لبناء رسالةٍ تقول ما الناقص وما الخطوة
      // التالية - لا «تجاوزت الحدّ» مجرّدة تترك المستخدم بلا مخرج.
      return NextResponse.json(
        {
          error: "plan_limit",
          scope: "adAccounts",
          platform,
          limit: check.limit,
          current: check.current,
          suggestedPlan: check.suggestedPlan,
        },
        { status: 402 }
      );
    }
  }

  // هل ده أول ربط فعلي للـ Workspace ده؟ (مفيش بيانات مجمّعة قبل كده) -
  // لو أيوه، هنسحب آخر 90 يوم في الخلفية بعد الرد، عشان الحساب ميبدأش
  // من صفر لو أصلاً فيه كامبينز شغالة من زمان
  const hasExistingData = await prisma.metricSnapshot.findFirst({
    where: { workspaceId: id },
    select: { id: true },
  });
  const isFirstLink = !hasExistingData;

  // بنمسح الاختيار القديم ونكتب الجديد - أبسط وأوضح من محاولة نحسب الفرق
  // (diff) بين القديم والجديد، ومقبول هنا لأن العدد صغير (كامبينز مش آلاف الصفوف)
  const activePlatforms = [...new Set(campaigns.map((c: any) => c.platform))] as string[];
  const visibleMetrics = computeSmartDefaults(workspace.industryVertical, activePlatforms);

  await prisma.$transaction([
    prisma.campaignLink.deleteMany({ where: { workspaceId: id } }),
    prisma.campaignLink.createMany({
      data: campaigns.map((c: any) => ({
        workspaceId: id,
        platform: c.platform,
        externalAccountId: c.externalAccountId,
        externalCampaignId: c.externalCampaignId,
        campaignName: c.campaignName,
        // القناة التي تبيع لها الحملة - أساس العائد لكلّ قناة. غيابها
        // يعني إنفاقاً «غير منسوب» يُعرض على حدة ولا يُقسَّم.
        connectionId: typeof c.connectionId === "string" && c.connectionId ? c.connectionId : null,
      })),
    }),
    // إصلاح TODO حقيقي: كانت visibleMetrics بتتحسب مرة واحدة بس وقت
    // إنشاء الـWorkspace (بمنصات فاضية، قبل أي ربط حقيقي)، ومعملهاش
    // إعادة حساب بعد كده - يعني الاختيار "الذكي" فضل عالق على تخمين
    // أولي للأبد حتى بعد ربط منصات حقيقية
    prisma.workspace.update({
      where: { id: id },
      data: { visibleMetrics },
    }),
  ]);

  if (isFirstLink && campaigns.some((c: any) => c.platform === "GOOGLE_ADS")) {
    // after() بتضمن إن السيرفر يفضل شغال لحد ما الاسترجاع يخلص، من غير
    // ما نأخّر الرد اللي المستخدم مستني يشوفه فوراً (Next.js 15.1+)
    after(async () => {
      try {
        await backfillHistoricalData(id);
      } catch (err) {
        console.error(`فشل استرجاع البيانات القديمة للـ Workspace ${id}:`, err);
      }
    });
  }

  return NextResponse.json({
    success: true,
    count: campaigns.length,
    backfillTriggered: isFirstLink,
  });
}
