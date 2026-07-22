// app/api/attribution/unattributed/route.ts
//
// لما رسالة واتساب توصل من غير كود Ref واضح - هنا محرك التوزيع
// الاحتمالي (lib/attributionEngine.ts) بيشتغل فعلياً. بنجيب المرشحين
// (كليكات مفتوحة آخر 48 ساعة)، ونحسب baseline من التحويلات المؤكدة،
// وننده attributeConversation() - نفس التصميم الأصلي بالحرف.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalServiceAuth } from "@/lib/internalServiceAuth";
import { attributeConversation, computeBaseline } from "@/lib/attributionEngine";

const CANDIDATE_WINDOW_HOURS = 48;
const BASELINE_SAMPLE_DAYS = 30;

export async function POST(req: NextRequest) {
  if (!verifyInternalServiceAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { workspaceId, conversationId, receivedAt, phoneNumber } = body;

  if (!workspaceId || !conversationId || !receivedAt) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  const existing = await prisma.attributionResult.findUnique({ where: { conversationId } });
  if (existing) return NextResponse.json({ ok: true, alreadyProcessed: true });

  const receivedAtDate = new Date(receivedAt);
  const windowStart = new Date(receivedAtDate.getTime() - CANDIDATE_WINDOW_HOURS * 60 * 60 * 1000);

  const candidates = await prisma.unmatchedClick.findMany({
    where: {
      workspaceId,
      matched: false,
      clickedAt: { gte: windowStart, lte: receivedAtDate },
    },
  });

  const baselineSampleStart = new Date(receivedAtDate);
  baselineSampleStart.setDate(baselineSampleStart.getDate() - BASELINE_SAMPLE_DAYS);

  const verifiedResults = await prisma.attributionResult.findMany({
    where: { workspaceId, attributionType: "VERIFIED", receivedAt: { gte: baselineSampleStart } },
  });

  const baseline = computeBaseline(
    verifiedResults.map((r: any) => {
      const dist = r.probabilityDistribution as Record<string, number>;
      const platform = Object.keys(dist)[0];
      return { platform, receivedAt: r.receivedAt };
    })
  );

  const output = attributeConversation(
    {
      id: conversationId,
      receivedAt: receivedAtDate,
      phoneNumber: phoneNumber ?? null,
    },
    candidates.map((c: any) => ({
      id: c.id,
      platform: c.platform,
      clickedAt: c.clickedAt,
      phoneHint: c.phoneHint,
    })),
    baseline
  );

  await prisma.attributionResult.create({
    data: {
      workspaceId,
      conversationId,
      receivedAt: receivedAtDate,
      attributionType: "MODELED",
      probabilityDistribution: output.distribution,
      primarySignal: output.primarySignal,
    },
  });

  return NextResponse.json({ ok: true, distribution: output.distribution, primarySignal: output.primarySignal });
}
