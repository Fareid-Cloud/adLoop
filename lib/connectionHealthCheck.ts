// lib/connectionHealthCheck.ts
//
// البديل الواقعي لحد ما BISU (ميتا) يتقيّم بعمق - بدل ما العميل يتفاجئ
// بتوقف الخدمة فجأة لما توكن جوجل/ميتا ينتهي، بنعرفه (وإحنا كمان) قبل
// الانتهاء بأيام كفاية يعيد الربط بهدوء.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";

export async function checkExpiringConnections(daysBeforeWarning: number = 7) {
  const warningThreshold = new Date();
  warningThreshold.setDate(warningThreshold.getDate() + daysBeforeWarning);

  const expiringSoon = await prisma.connectedPlatform.findMany({
    where: {
      expiresAt: { not: null, lte: warningThreshold, gt: new Date() },
    },
  });

  for (const connection of expiringSoon) {
    const workspace = await prisma.workspace.findFirst({ where: { userId: connection.userId } });
    if (!workspace) continue;

    const daysLeft = Math.ceil(
      (connection.expiresAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const platformLabel = connection.platform === "META_ADS" ? "ميتا" : connection.platform === "GOOGLE_ADS" ? "جوجل" : connection.platform;

    await pushToActionFeed({
      workspaceId: workspace.id,
      type: "ALERT",
      severity: daysLeft <= 2 ? "URGENT" : "HIGH",
      title: `ربط ${platformLabel} هينتهي خلال ${daysLeft} يوم`,
      description: "لازم تعيد الموافقة من الإعدادات قبل ما يوقف تدفق البيانات.",
    });
  }
}
