// app/api/workspaces/route.ts
//
// أساس ناقص كان لازم يتبني قبل أي حاجة تانية: من غير الـ route ده، مفيش
// أي طريقة يتعمل بيها Workspace خالص - يعني المستخدم بعد التسجيل كان
// هيوصل لصفحة داشبورد مفيش وراها أي بيانات ممكن تتبنى عليها.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { computeSmartDefaults } from "@/lib/dashboardDefaults";
import { checkWorkspaceLimit, getEntitlements } from "@/lib/entitlements";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

// الحدود من `lib/entitlements` حصراً. كان هنا جدول ثالث مستقلّ فيه باقة
// `growth` لا وجود لها - ثلاثة جداول للحدود يعني أن اثنين منها يكذبان.

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspaces = await prisma.workspace.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const ent = await getEntitlements(user.id);
  const limit = ent.limits.workspaces;
  return NextResponse.json({
    workspaces,
    limit,
    canAddMore: limit === -1 || workspaces.length < limit,
    plan: user.subscriptionPlan ?? "free",
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const { name, industryVertical } = await req.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: t(locale, "apiErr.nameRequired") }, { status: 400 });
  }

  const check = await checkWorkspaceLimit(user.id);
  const existingCount = check.current;
  const limit = check.limit;
  if (!check.allowed) {
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
