// lib/attributionSummary.ts
//
// بيجمع نتايج محرك الإسناد (VERIFIED + MODELED) لكل منصة، لفترة زمنية
// معينة. ده الجسر بين AttributionResult (سجل لكل محادثة على حدة)
// و"كام تحويل حقيقي جه من كل منصة" اللي المستخدم عايز يشوفه في الداشبورد.

import { prisma } from "@/lib/prisma";

export interface AttributionSummary {
  byPlatform: Record<string, number>;
  verifiedCount: number;
  modeledCount: number;
}

export async function getAttributionSummaryForWorkspace(
  workspaceId: string,
  from: Date,
  to: Date
): Promise<AttributionSummary> {
  const results = await prisma.attributionResult.findMany({
    where: { workspaceId, receivedAt: { gte: from, lte: to } },
  });

  const byPlatform: Record<string, number> = {};
  let verifiedCount = 0;
  let modeledCount = 0;

  for (const result of results) {
    const dist = result.probabilityDistribution as Record<string, number>;
    for (const [platform, weight] of Object.entries(dist)) {
      byPlatform[platform] = (byPlatform[platform] ?? 0) + weight;
    }
    if (result.attributionType === "VERIFIED") verifiedCount++;
    else modeledCount++;
  }

  return { byPlatform, verifiedCount, modeledCount };
}
