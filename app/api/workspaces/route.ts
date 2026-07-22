// app/api/workspaces/route.ts
//
// أساس ناقص كان لازم يتبني قبل أي حاجة تانية: من غير الـ route ده، مفيش
// أي طريقة يتعمل بيها Workspace خالص - يعني المستخدم بعد التسجيل كان
// هيوصل لصفحة داشبورد مفيش وراها أي بيانات ممكن تتبنى عليها.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { computeSmartDefaults } from "@/lib/dashboardDefaults";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspaces = await prisma.workspace.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ workspaces });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name, industryVertical } = await req.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
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
