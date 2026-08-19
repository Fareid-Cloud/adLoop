// app/api/workspaces/[id]/sync/route.ts
//
// مزامنة فورية بطلب المستخدم. لم يكن هناك أي وسيلة لتشغيل المزامنة يدوياً:
// خطوة "استقبل أول بيانات" كانت تُحيل إلى الإعدادات حيث لا يوجد زر مزامنة
// أصلاً، فيبقى المستخدم ينتظر دورة الكرون اليومية دون أن يعرف ذلك.
//
// نزامن المنصات المرتبطة فقط، وكل منصة على حدة: فشل واحدة لا يمنع الأخرى.

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getUsageState } from "@/lib/usageCaps";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";
import { resyncWorkspace } from "@/lib/resyncWorkspace";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const workspace = await prisma.workspace.findFirst({ where: { id, ...workspaceAccess(user.id) } });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const links = await prisma.campaignLink.findMany({
    where: { workspaceId: id },
    select: { platform: true },
    distinct: ["platform"],
  });

  if (links.length === 0) {
    return NextResponse.json(
      { error: t(locale, "apiErr.noCampaignsLinked") },
      { status: 400 }
    );
  }

  // 🛑 السقف يسري على الزرّ اليدويّ كما يسري على الكرون. بدون هذا يصير
  // «الزرّ» بابَ التفافٍ يُبطل الحدّ كلّه: من بلغ سقفه يضغط مزامنة فتعمل.
  //
  // الرسالة تقول ما توقّف والرقم الذي أوقفه وما الذي يعيده، وترافقها وجهةٌ
  // جاهزة - القاعدة الحاكمة: نقطةٌ تمنع المستخدم تحمل معها الحلّ.
  const usage = await getUsageState(user.id);
  if (usage.blocked) {
    const locale = (user.preferredLocale as "ar" | "en") ?? "ar";
    return NextResponse.json(
      {
        error: t(
          locale,
          usage.reason === "spend" ? "alerts.usageBlockedSpendBody" : "alerts.usageBlockedConvBody",
          {
            spend: usage.spendUsd.toLocaleString("en-US"),
            spendLimit: usage.spendLimitUsd.toLocaleString("en-US"),
            conv: usage.verifiedConversions.toLocaleString("en-US"),
            convLimit: usage.verifiedLimit.toLocaleString("en-US"),
          }
        ),
        limit: "usage",
        upgradeUrl: "/dashboard/billing",
      },
      { status: 402 }
    );
  }

  // التنفيذ في `lib/resyncWorkspace.ts` - نفس الدالة اللي بتستخدمها أدوات
  // الإصلاح في لوحة المالك، فتسجيل `SyncRun` واحد في الحالتين.
  const { results, succeeded, snapshotCount } = await resyncWorkspace(id, "MANUAL");

  return NextResponse.json({
    ok: succeeded > 0,
    results,
    snapshotCount,
    // رسالة واحدة واضحة بدل ترك الواجهة تخمّن ما حدث
    summaryAr:
      succeeded === 0
        ? "تعذّرت المزامنة من كل المنصات المرتبطة."
        : snapshotCount === 0
        ? "تمت المزامنة، لكن المنصة لم تُرجع أي بيانات بعد. الحملات الجديدة قد تحتاج يوماً حتى تتوفّر أرقامها."
        : `تمت المزامنة بنجاح من ${succeeded} ${succeeded === 1 ? "منصة" : "منصات"}.`,
  });
}

