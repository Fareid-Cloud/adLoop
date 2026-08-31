// app/api/diagnostics/scan/route.ts
//
// فحص فوري بطلب من المستخدم: يعيد فحص صفحات الهبوط فعلياً (نداء شبكة
// حقيقي لكل صفحة) ثم يعيد تشغيل التشخيص. لم يكن هناك أي زر فحص من قبل -
// كان المستخدم ينتظر المزامنة اليومية دون أن يعرف متى تحدث.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { checkTrackingPresence } from "@/lib/trackingCoverage";
import { runDiagnostics } from "@/lib/diagnosticsEngine";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const pages = await prisma.monitoredPage.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, url: true },
    // حد أعلى يمنع طلباً واحداً من إشغال الخادم بعشرات النداءات الخارجية
    take: 20,
  });

  // بالتوازي - نداءات شبكة مستقلة، والانتظار المتسلسل يجعل الفحص بطيئاً بلا داعٍ
  await Promise.all(
    pages.map(async (p) => {
      try {
        const result = await checkTrackingPresence(p.url);
        await prisma.monitoredPage.update({
          where: { id: p.id },
          data: {
            trackingDetected: result.detected,
            detectedSystems: result.systems.map((s) => s.id),
            adloopDetected: result.adloopDetected,
            auditResult: result.audit as any,
            lastCheckedAt: new Date(),
            lastError: result.error,
          },
        });
      } catch {
        // صفحة واحدة فاشلة لا تُسقط الفحص كله
      }
    })
  );

  const report = await runDiagnostics(workspace.id, (user.preferredLocale as "ar"|"en") ?? "en");

  return NextResponse.json({
    ok: true,
    pagesScanned: pages.length,
    healthScore: report.healthScore,
    counts: report.counts,
  });
}
