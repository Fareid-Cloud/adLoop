// lib/attributionPathAlert.ts
//
// بند 6 من الخطة - "لو نسبة لمسة واحدة ارتفعت فجأة". الخطة حذّرت إن ده
// محتاج فترة مراقبة أطول من باقي التنبيهات - قرار مقصود هنا: مقارنة
// أسبوعين كاملين (مش يوم بيوم) عشان نتجنب ضجيج التقلبات اليومية
// الطبيعية في عدد الجلسات متعددة اللمسات.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";

const SPIKE_THRESHOLD_POINTS = 20;
const COOLDOWN_DAYS = 14;
const MIN_CONVERSIONS_FOR_CONFIDENCE = 10;

async function getSingleTouchPct(workspaceId: string, from: Date, to: Date): Promise<number | null> {
  const conversions = await prisma.sessionConversion.findMany({
    where: { workspaceId, convertedAt: { gte: from, lte: to } },
    select: { sessionId: true },
  });
  if (conversions.length < MIN_CONVERSIONS_FOR_CONFIDENCE) return null;

  const sessionIds = conversions.map((c: any) => c.sessionId);
  const clicks = await prisma.ctaClickEvent.findMany({
    where: { workspaceId, sessionId: { in: sessionIds } },
    select: { sessionId: true, clickPlatform: true },
  });

  const platformsBySession = new Map<string, Set<string>>();
  for (const click of clicks) {
    const set = platformsBySession.get(click.sessionId) ?? new Set();
    set.add(click.clickPlatform ?? "GOOGLE_ADS");
    platformsBySession.set(click.sessionId, set);
  }

  const singleTouchCount = sessionIds.filter(
    (id: string) => (platformsBySession.get(id)?.size ?? 0) <= 1
  ).length;

  return Math.round((singleTouchCount / conversions.length) * 100);
}

export async function checkAttributionPathAlertForWorkspace(workspaceId: string) {
  const now = new Date();
  const thisPeriodStart = new Date(now);
  thisPeriodStart.setDate(thisPeriodStart.getDate() - 14);
  const lastPeriodStart = new Date(now);
  lastPeriodStart.setDate(lastPeriodStart.getDate() - 28);

  const [thisPct, lastPct] = await Promise.all([
    getSingleTouchPct(workspaceId, thisPeriodStart, now),
    getSingleTouchPct(workspaceId, lastPeriodStart, thisPeriodStart),
  ]);

  if (thisPct === null || lastPct === null) return;

  const diffPoints = thisPct - lastPct;
  if (diffPoints < SPIKE_THRESHOLD_POINTS) return;

  const cooldownStart = new Date();
  cooldownStart.setDate(cooldownStart.getDate() - COOLDOWN_DAYS);
  const recentSimilar = await prisma.actionFeedItem.findFirst({
    where: { workspaceId, title: { contains: "نسبة اللمسة الواحدة ارتفعت" }, createdAt: { gte: cooldownStart } },
  });
  if (recentSimilar) return;

  await pushToActionFeed({
    workspaceId,
    type: "ALERT",
    severity: "LOW",
    title: "نسبة اللمسة الواحدة ارتفعت بشكل ملحوظ",
    description: `${thisPct}% من التحويلات آخر أسبوعين لمست منصة واحدة بس قبل التحويل، مقابل ${lastPct}% في الفترة اللي فاتت - ممكن يعني منصة معينة بقت معزولة عن الباقي، أو تتبع منصة تانية توقف.`,
    linkUrl: "/dashboard/campaigns/attribution-path",
  });
}
