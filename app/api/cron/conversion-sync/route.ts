// app/api/cron/conversion-sync/route.ts
//
// كرون يغلق الحلقة يومياً على ثلاث مهامّ مترابطة:
//   ١) رفع التحويلات المتحقّق منها إلى المنصات (CAPI) - تتعلّم الخوارزمية
//      على عملاء حقيقيين لا على نقرات
//   ٢) تقييم قرارات الإعلانات التي اكتملت نافذتها (٤ أيام) - القرار لا
//      يكتمل بالتنفيذ بل بقياس أثره
//   ٣) اكتشاف قرارات Scale/Kill الجديدة ودفعها لقائمة القرارات
//
// كل مساحة عمل تُعالَج على حدة داخل try/catch: فشل حساب واحد لا يجوز أن
// يمنع بقية الحسابات - وهو خطأ شائع في مهامّ الكرون الجماعية.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const workspaces = await prisma.workspace.findMany({ select: { id: true, name: true } });

  const results: Array<{
    workspaceId: string;
    synced?: number;
    syncFailed?: number;
    evaluated?: number;
    error?: string;
  }> = [];

  const { syncPendingConversions } = await import("@/lib/conversionSync");
  const { evaluateDueAdDecisions } = await import("@/lib/adDecisions");
  const { checkScaleKillDecisionsForWorkspace } = await import("@/lib/scaleKillAlerts");

  for (const workspace of workspaces) {
    const entry: (typeof results)[number] = { workspaceId: workspace.id };
    try {
      const sync = await syncPendingConversions(workspace.id);
      entry.synced = sync.sent;
      entry.syncFailed = sync.failed;
    } catch (err) {
      entry.error = `رفع التحويلات: ${msg(err)}`;
    }

    try {
      const evaluation = await evaluateDueAdDecisions(workspace.id);
      entry.evaluated = evaluation.evaluated;
    } catch (err) {
      entry.error = `${entry.error ? entry.error + " | " : ""}تقييم القرارات: ${msg(err)}`;
    }

    try {
      await checkScaleKillDecisionsForWorkspace(workspace.id);
    } catch (err) {
      entry.error = `${entry.error ? entry.error + " | " : ""}اكتشاف القرارات: ${msg(err)}`;
    }

    results.push(entry);
  }

  return NextResponse.json({ ok: true, workspaces: results.length, results });
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 200) : "خطأ غير معروف";
}
