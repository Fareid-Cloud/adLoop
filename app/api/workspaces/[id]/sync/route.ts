// app/api/workspaces/[id]/sync/route.ts
//
// مزامنة فورية بطلب المستخدم. لم يكن هناك أي وسيلة لتشغيل المزامنة يدوياً:
// خطوة "استقبل أول بيانات" كانت تُحيل إلى الإعدادات حيث لا يوجد زر مزامنة
// أصلاً، فيبقى المستخدم ينتظر دورة الكرون اليومية دون أن يعرف ذلك.
//
// نزامن المنصات المرتبطة فقط، وكل منصة على حدة: فشل واحدة لا يمنع الأخرى.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const maxDuration = 60;

interface SyncOutcome {
  platform: string;
  ok: boolean;
  error?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({ where: { id, userId: user.id } });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const links = await prisma.campaignLink.findMany({
    where: { workspaceId: id },
    select: { platform: true },
    distinct: ["platform"],
  });

  if (links.length === 0) {
    return NextResponse.json(
      { error: "لا توجد حملات مرتبطة بعد. اختر حملاتك أولاً ثم شغّل المزامنة." },
      { status: 400 }
    );
  }

  const results: SyncOutcome[] = [];
  const linked = new Set(links.map((l) => l.platform));

  if (linked.has("GOOGLE_ADS")) {
    try {
      const { syncGoogleAdsForWorkspace } = await import("@/lib/syncGoogleAds");
      await syncGoogleAdsForWorkspace(id);
      results.push({ platform: "GOOGLE_ADS", ok: true });
    } catch (err) {
      results.push({ platform: "GOOGLE_ADS", ok: false, error: msg(err) });
    }
  }

  if (linked.has("META_ADS")) {
    try {
      const { syncMetaAdsForWorkspace } = await import("@/lib/syncMetaAds");
      await syncMetaAdsForWorkspace(id);
      results.push({ platform: "META_ADS", ok: true });
    } catch (err) {
      results.push({ platform: "META_ADS", ok: false, error: msg(err) });
    }
  }

  if (linked.has("TIKTOK_ADS")) {
    try {
      const { syncTikTokAdsForWorkspace } = await import("@/lib/syncTikTokAds");
      await syncTikTokAdsForWorkspace(id);
      results.push({ platform: "TIKTOK_ADS", ok: true });
    } catch (err) {
      results.push({ platform: "TIKTOK_ADS", ok: false, error: msg(err) });
    }
  }

  const snapshotCount = await prisma.metricSnapshot.count({ where: { workspaceId: id } });
  const succeeded = results.filter((r) => r.ok).length;

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

function msg(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 200);
  return "خطأ غير معروف";
}
