// app/api/workspaces/route.ts
//
// أساس ناقص كان لازم يتبني قبل أي حاجة تانية: من غير الـ route ده، مفيش
// أي طريقة يتعمل بيها Workspace خالص - يعني المستخدم بعد التسجيل كان
// هيوصل لصفحة داشبورد مفيش وراها أي بيانات ممكن تتبنى عليها.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { computeSmartDefaults } from "@/lib/dashboardDefaults";

/** حدّ مساحات العمل لكل باقة - يُفحص على الخادم لا في الواجهة وحدها،
 *  وإلا أمكن تجاوزه بطلب مباشر. */
const PLAN_LIMITS: Record<string, number> = {
  free: 1, starter: 2, growth: 5, pro: 15, agency: 50,
};
function limitFor(plan: string | null | undefined): number {
  return PLAN_LIMITS[(plan ?? "free").toLowerCase()] ?? PLAN_LIMITS.free;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspaces = await prisma.workspace.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const limit = limitFor(user.subscriptionPlan);
  return NextResponse.json({
    workspaces,
    limit,
    canAddMore: workspaces.length < limit,
    plan: user.subscriptionPlan ?? "free",
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name, industryVertical } = await req.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
  }

  const existingCount = await prisma.workspace.count({ where: { userId: user.id } });
  const limit = limitFor(user.subscriptionPlan);
  if (existingCount >= limit) {
    return NextResponse.json(
      {
        error: `باقتك الحالية تسمح بـ${limit === 1 ? "مساحة عمل واحدة" : `${limit} مساحات عمل`}. رقِّ باقتك لإضافة المزيد.`,
        limitReached: true,
        limit,
      },
      { status: 403 }
    );
  }

  // activePlatforms فاضية وقت الإنشاء (لسه معملش ربط حسابات) - بيتحسب
  // افتراضي معقول من المجال بس، وهيتحدث تلقائي أول ما يربط منصة فعلية
  // (TODO: نعيد حساب computeSmartDefaults لما أول CampaignLink يتضاف)
  const visibleMetrics = computeSmartDefaults(industryVertical ?? null, []);

  const workspace = await prisma.workspace.create({
    data: {
      userId: user.id,
      name: name.trim(),
      industryVertical: industryVertical ?? null,
      visibleMetrics,
    },
  });

  return NextResponse.json({ workspace }, { status: 201 });
}
