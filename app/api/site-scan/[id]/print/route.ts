// app/api/site-scan/[id]/print/route.ts
//
// بيرجّع صفحة HTML كاملة جاهزة للطباعة - بيستخدم generateAuditReportHtml.ts
// اللي كان مبني من زمان بس معندوش أي نقطة استخدام فعلية لحد الآن.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateAuditReportHtml } from "@/lib/generateAuditReportHtml";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const scan = await prisma.siteScanResult.findFirst({
    where: { id: id, workspace: { userId: user.id } },
    include: { workspace: true },
  });

  if (!scan || scan.status !== "COMPLETED" || !scan.fullReport) {
    return NextResponse.json({ error: "الفحص غير مكتمل أو غير موجود" }, { status: 404 });
  }

  const report = scan.fullReport as any;

  const fullAuditReport = {
    url: report.primary.url,
    overallScore: scan.overallScore ?? 0,
    technicalSEO: report.primary.technicalSEO,
    domainTrust: report.primary.domainTrust,
    visual: report.primary.visual,
  };

  const html = generateAuditReportHtml(fullAuditReport, report.synthesis, scan.workspace.name, "ar");

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
