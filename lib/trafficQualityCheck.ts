// lib/trafficQualityCheck.ts
//
// "الفجوة بتحصل إزاي، والشركات المتخصصة بتحلها إزاي، واحنا نقدر نعمل إيه؟"
//
// آلية المشكلة (بحث مؤكد): بوتات/مزارع كليك/منافسين بيدوسوا على الإعلان
// من أجهزة/IPs حقيقية (مش بوتات بدائية سهلة الكشف)، فمنصة زي تيك توك
// (فحص كشفها أضعف من جوجل/ميتا) بتسجّلهم كـ"كليك حقيقي" عادي. العلامة
// الحقيقية: نفس المصدر بيكرر كليكات كتير، وصفر تحويل حقيقي أبداً.
//
// إزاي الشركات المتخصصة (Lunio، ClickGuard، Fraudlogix) بتحلها: 3 طبقات
// - سمعة IP/شبكة (data center، VPN، تكرار) - أبسط طبقة
// - بصمة جهاز (متصفح، دقة شاشة، خطوط، Canvas/WebGL) - محتاجة سكريبت
//   تتبع متخصص شغال وقت الزيارة نفسها
// - تحليل سلوكي بالـML (حركة الماوس، عمق التمرير، وقت البقاء) - محتاجة
//   نموذج مُدرَّب على ملايين الكليكات المصنّفة
//
// الصدق الكامل عن حدودنا: إحنا نقدر نبني الطبقة الأولى بس (تكرار IP)
// بالبيانات الموجودة فعلاً - مفيش بصمة جهاز عندنا، ومفيش نموذج ML مدرّب.
// ده مش حل شامل زي أدوات متخصصة، لكنه إشارة حقيقية أفضل من صفر.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";

const MIN_CLICKS_FROM_SAME_IP = 4;
const LOOKBACK_DAYS = 14;
const COOLDOWN_DAYS = 7;

// طبقة تانية - نفس مبدأ IP بالظبط، بس بالـUser-Agent (كان موجود في
// الـschema من زمان بتعليق "طبقة كشف تانية"، معملش يتبعت فعلياً لحد
// دلوقتي - وصّلناه). إشارتين:
// 1) توقيع بوت معروف صراحة (regex بسيط، ثقة عالية جداً لو طابق)
// 2) نفس الـUser-Agent بالحرف بيتكرر عبر IPs مختلفة كتير من غير أي
//    تحويل - نمط سكريبت آلي بيلف على IPs (proxy rotation)، مش بشر
//    حقيقيين (بشر حقيقيين عندهم تنوع أجهزة/متصفحات طبيعي)
const BOT_UA_PATTERN = /bot|crawl|spider|headless|puppeteer|selenium|phantom|curl|python-requests|scrapy|wget/i;
const MIN_IPS_FOR_SHARED_UA_PATTERN = 3;

function isKnownBotSignature(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_UA_PATTERN.test(userAgent);
}

export async function checkTrafficQualityForWorkspace(workspaceId: string) {
  const lookbackStart = new Date();
  lookbackStart.setDate(lookbackStart.getDate() - LOOKBACK_DAYS);

  const clicks = await prisma.unmatchedClick.findMany({
    where: { workspaceId, clickedAt: { gte: lookbackStart }, ipAddress: { not: null } },
    select: { ipAddress: true, userAgent: true, platform: true, matched: true },
  });
  if (clicks.length === 0) return;

  // === الطبقة الأولى: تكرار IP ===
  const byIpPlatform = new Map<string, { count: number; matchedCount: number; platform: string }>();
  for (const click of clicks) {
    const key = `${click.ipAddress}::${click.platform}`;
    const entry = byIpPlatform.get(key) ?? { count: 0, matchedCount: 0, platform: click.platform };
    entry.count++;
    if (click.matched) entry.matchedCount++;
    byIpPlatform.set(key, entry);
  }
  const suspiciousIpGroups = Array.from(byIpPlatform.entries())
    .filter(([, v]) => v.count >= MIN_CLICKS_FROM_SAME_IP && v.matchedCount === 0)
    .sort((a, b) => b[1].count - a[1].count);

  // === الطبقة التانية: توقيع بوت معروف ===
  const botSignatureCount = clicks.filter((c: any) => isKnownBotSignature(c.userAgent) && !c.matched).length;

  // === الطبقة التانية: نفس الـUser-Agent عبر IPs مختلفة كتير، صفر تحويل ===
  const byUserAgent = new Map<string, { ips: Set<string>; matchedCount: number }>();
  for (const click of clicks) {
    if (!click.userAgent) continue;
    const entry = byUserAgent.get(click.userAgent) ?? { ips: new Set<string>(), matchedCount: 0 };
    if (click.ipAddress) entry.ips.add(click.ipAddress);
    if (click.matched) entry.matchedCount++;
    byUserAgent.set(click.userAgent, entry);
  }
  const scriptedPatternCount = Array.from(byUserAgent.values())
    .filter((v) => v.ips.size >= MIN_IPS_FOR_SHARED_UA_PATTERN && v.matchedCount === 0).length;

  // === توسيع التغطية: نفس فحص توقيع البوت، لكن على جدول تاني منفصل ===
  // CtaClickEvent هو تتبع الموقع الرئيسي كله (أي CTA، مش بس اللي رايح
  // واتساب) - نطاق أوسع من UnmatchedClick. معندوش IP، بس عنده User-Agent
  // بنفس القيمة الكشفية.
  const ctaClicks = await prisma.ctaClickEvent.findMany({
    where: { workspaceId, clickedAt: { gte: lookbackStart } },
    select: { userAgent: true },
  });
  const websiteBotSignatureCount = ctaClicks.filter((c: any) => isKnownBotSignature(c.userAgent)).length;

  const totalSuspiciousClicks = suspiciousIpGroups.reduce((sum, [, v]) => sum + v.count, 0);
  const hasAnySignal = suspiciousIpGroups.length > 0 || botSignatureCount > 0 || scriptedPatternCount > 0 || websiteBotSignatureCount > 0;
  if (!hasAnySignal) return;

  const cooldownStart = new Date();
  cooldownStart.setDate(cooldownStart.getDate() - COOLDOWN_DAYS);
  const recentSimilar = await prisma.actionFeedItem.findFirst({
    where: { workspaceId, title: { contains: "مصادر كليك مشبوهة" }, createdAt: { gte: cooldownStart } },
  });
  if (recentSimilar) return;

  const platformsInvolved = [...new Set(suspiciousIpGroups.map(([, v]) => v.platform))];
  const tiktokNote = platformsInvolved.includes("TIKTOK_ADS")
    ? " تيك توك من ضمنها - متوقّع أكتر إحصائياً حسب البحث، لكن يستاهل مراجعة برضو."
    : "";

  const signalParts: string[] = [];
  if (suspiciousIpGroups.length > 0) signalParts.push(`${suspiciousIpGroups.length} مصدر IP متكرر (${totalSuspiciousClicks} كليك)`);
  if (botSignatureCount > 0) signalParts.push(`${botSignatureCount} كليك إعلاني بتوقيع بوت معروف صراحة`);
  if (scriptedPatternCount > 0) signalParts.push(`${scriptedPatternCount} نمط جهاز واحد بيلف على IPs مختلفة`);
  if (websiteBotSignatureCount > 0) signalParts.push(`${websiteBotSignatureCount} زيارة موقع بتوقيع بوت معروف`);

  await pushToActionFeed({
    workspaceId,
    type: "ALERT",
    severity: "MEDIUM",
    title: `إشارات ترافيك مشبوه (${signalParts.length} نوع إشارة)`,
    description: `${signalParts.join(" + ")}.${tiktokNote} ده مش إثبات احتيال قاطع، لكنه نمط يستاهل تراجعه - خصوصاً لو تكرر أو زاد.`,
    linkUrl: "/dashboard/reports",
  });
}
