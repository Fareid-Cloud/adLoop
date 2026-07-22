// lib/dataConsistencyAudit.ts
//
// السؤال هنا مختلف تماماً عن "الحقيقة مقابل الظاهر" (اللي هو جوهر المنتج
// كله). ده سؤال داخلي: "البيانات المخزّنة عندنا فعلاً بتطابق اللي جوجل
// نفسها بتقوله للفترة دي، ولا فيه مشكلة في خط أنابيب البيانات بتاعنا؟" -
// ضمان جودة (QA) على نظامنا احنا، مش مقارنة إعلانية. لو الرقمين اختلفوا
// (بره هامش معقول)، المشكلة عندنا في المزامنة، مش في "التضخيم".

import { GoogleAdsApi } from "google-ads-api";
import { prisma } from "@/lib/prisma";
import type { ConnectedPlatform } from "@prisma/client";
import { decryptToken } from "@/lib/encryption";

export interface ConsistencyAuditResult {
  matches: boolean;
  storedClicks: number;
  liveClicks: number;
  discrepancyPct: number;
  checkedAt: Date;
}

// هامش تسامح 2% - فروق صغيرة جداً ممكن تحصل بسبب توقيت المزامنة نفسه
// (لو الفحص حصل في نص اليوم مثلاً) - مش لازم كل فرق بسيط يعتبر "مشكلة"
const TOLERANCE_PCT = 2;

export async function auditDataConsistency(
  workspaceId: string,
  dateRange: { from: string; to: string }
): Promise<ConsistencyAuditResult> {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });

  const storedAgg = await prisma.metricSnapshot.aggregate({
    where: {
      workspaceId,
      platform: "GOOGLE_ADS",
      date: { gte: new Date(dateRange.from), lte: new Date(dateRange.to) },
    },
    _sum: { clicks: true },
  });
  const storedClicks = storedAgg._sum.clicks ?? 0;

  if (links.length === 0) {
    return { matches: true, storedClicks: 0, liveClicks: 0, discrepancyPct: 0, checkedAt: new Date() };
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) {
    return { matches: true, storedClicks, liveClicks: 0, discrepancyPct: 0, checkedAt: new Date() };
  }

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const byAccount = new Map<string, string[]>();
  for (const link of links) {
    const arr = byAccount.get(link.externalAccountId) ?? [];
    arr.push(link.externalCampaignId);
    byAccount.set(link.externalAccountId, arr);
  }

  let liveClicks = 0;
  for (const [accountId, campaignIds] of byAccount.entries()) {
    const customer = client.Customer({
      customer_id: accountId,
      login_customer_id: connection.managerAccountId!,
      refresh_token: decryptToken(connection.refreshToken!),
    });

    // بنطلب المجموع مباشرة من جوجل حية (مش من نسخة مخزّنة عندنا) - ده
    // بالظبط الفرق عن أي استعلام تاني في النظام، هنا الهدف تحديداً نتأكد
    // إن نسختنا المخزّنة متطابقة مع المصدر الحي وقت الفحص
    const rows = await customer.query(`
      SELECT metrics.clicks
      FROM campaign
      WHERE segments.date BETWEEN '${dateRange.from}' AND '${dateRange.to}'
        AND campaign.id IN (${campaignIds.join(",")})
    `);

    for (const row of rows) {
      liveClicks += Number(row.metrics?.clicks ?? 0);
    }
  }

  const discrepancyPct =
    liveClicks > 0 ? Math.round((Math.abs(storedClicks - liveClicks) / liveClicks) * 1000) / 10 : 0;

  return {
    matches: discrepancyPct <= TOLERANCE_PCT,
    storedClicks,
    liveClicks,
    discrepancyPct,
    checkedAt: new Date(),
  };
}
