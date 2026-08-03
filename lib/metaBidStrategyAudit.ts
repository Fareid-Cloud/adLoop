// lib/metaBidStrategyAudit.ts
//
// نفس مبدأ فحص "منطقية استراتيجية المزايدة" اللي بنيناه لجوجل (بند 16)،
// لكن بمراعاة فرق مفاهيمي حقيقي عند ميتا (اتأكدت منه بالبحث):
//
// - COST_CAP: "متوسط" مستهدف عبر المجموعة كلها - مقارنة مباشرة بتكلفة
//   العميل الحقيقية منطقية 100%، زي Target CPA في جوجل بالظبط
// - LOWEST_COST_WITH_BID_CAP: سقف لكل مزايدة فردية على حدة، مش متوسط -
//   مقارنته المباشرة بتكلفة العميل الحقيقية تقريب مقبول، لكن المعنى
//   مختلف (سقف منخفض جداً بيقيّد الوصول، مش بالضرورة "الهدف غلط")
// - LOWEST_COST_WITHOUT_CAP: مفيهوش هدف خالص - الفحص ده مش منطبق عليها أصلاً

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";
import { t } from "@/lib/i18n/dictionary";

export interface MetaBidStrategyInput {
  adSetId: string;
  adSetName: string | null;
  bidStrategyType: string | null;
  bidAmount: number | null;
  verifiedCpa: number | null;
}

export interface MetaBidStrategySanityResult {
  adSetId: string;
  adSetName: string | null;
  hasTarget: boolean;
  divergencePct: number | null;
  status: "ALIGNED" | "DIVERGENT" | "NOT_APPLICABLE";
  message: string;
  /** مفتاح الرسالة ومتغيّراتها - النصّ أعلاه احتياطيّ عربي فقط. */
  messageKey: string;
  messageVars?: Record<string, string | number>;
}

const DIVERGENCE_THRESHOLD_PCT = 20;
const MIN_VERIFIED_SAMPLE = 5;

export function auditMetaBidStrategy(
  input: MetaBidStrategyInput,
  verifiedSampleSize: number
): MetaBidStrategySanityResult {
  const base = { adSetId: input.adSetId, adSetName: input.adSetName };

  if (input.bidStrategyType === "LOWEST_COST_WITHOUT_CAP") {
    return {
      ...base, hasTarget: false, divergencePct: null, status: "NOT_APPLICABLE",
      message: t("ar", "alerts.metaNoCap"),
      messageKey: "alerts.metaNoCap",
    };
  }

  if (input.bidAmount === null || input.verifiedCpa === null || verifiedSampleSize < MIN_VERIFIED_SAMPLE) {
    return {
      ...base, hasTarget: input.bidAmount !== null, divergencePct: null, status: "NOT_APPLICABLE",
      message: t("ar", "alerts.bidNoSample"),
      messageKey: "alerts.bidNoSample",
    };
  }

  const divergencePct = Math.round(((input.verifiedCpa - input.bidAmount) / input.bidAmount) * 100);
  const isDivergent = Math.abs(divergencePct) > DIVERGENCE_THRESHOLD_PCT;
  const bidVars = {
    target: input.bidAmount,
    actual: input.verifiedCpa,
    pct: Math.abs(divergencePct),
  };

  if (input.bidStrategyType === "COST_CAP") {
    return {
      ...base, hasTarget: true, divergencePct,
      status: isDivergent ? "DIVERGENT" : "ALIGNED",
      messageKey: isDivergent ? "alerts.metaCostCapDivergent" : "alerts.metaCostCapAligned",
      messageVars: bidVars,
      message: t("ar", isDivergent ? "alerts.metaCostCapDivergent" : "alerts.metaCostCapAligned", bidVars),
    };
  }

  if (input.bidStrategyType === "LOWEST_COST_WITH_BID_CAP") {
    // هنا الفرق المفاهيمي المهم - سقف منخفض جداً معناه تقييد وصول، مش
    // بالضرورة "الرقم غلط" - الرسالة بتوضح الفرق ده صراحة
    return {
      ...base, hasTarget: true, divergencePct,
      status: isDivergent ? "DIVERGENT" : "ALIGNED",
      messageKey: !isDivergent
        ? "alerts.metaBidCapAligned"
        : divergencePct > 0
        ? "alerts.metaBidCapLow"
        : "alerts.metaBidCapHigh",
      messageVars: bidVars,
      message: t(
        "ar",
        !isDivergent
          ? "alerts.metaBidCapAligned"
          : divergencePct > 0
          ? "alerts.metaBidCapLow"
          : "alerts.metaBidCapHigh",
        bidVars
      ),
    };
  }

  // LOWEST_COST_WITH_MIN_ROAS أو نوع مش معروف - نطبّق نفس منطق Cost Cap
  // كتقريب معقول، مع توضيح إننا مش متأكدين 100% من التفسير
  return {
    ...base, hasTarget: true, divergencePct,
    status: isDivergent ? "DIVERGENT" : "ALIGNED",
    messageKey: isDivergent ? "alerts.metaGenericDivergent" : "alerts.metaGenericAligned",
    messageVars: bidVars,
    message: t("ar", isDivergent ? "alerts.metaGenericDivergent" : "alerts.metaGenericAligned", bidVars),
  };
}

// إصلاح فجوة من قائمة ميتا (بند 60): كان الفحص متاح بس لو المستخدم فتح
// صفحة التشخيص بنفسه - دلوقتي بيتشغّل تلقائياً مع المزامنة اليومية
// ويدفع تنبيه استباقي حقيقي، مش ينتظر زيارة يدوية
export async function checkMetaBidStrategyAlertsForWorkspace(workspaceId: string) {
  const adSets = await prisma.metaAdSetSnapshot.findMany({
    where: { workspaceId, bidStrategyType: { not: null } },
  });

  for (const adSet of adSets) {
    const result = auditMetaBidStrategy(
      {
        adSetId: adSet.adSetId,
        adSetName: adSet.adSetName,
        bidStrategyType: adSet.bidStrategyType,
        bidAmount: adSet.bidAmount,
        verifiedCpa: adSet.conversions > 0 ? adSet.cost / adSet.conversions : null,
      },
      adSet.conversions
    );

    if (result.status === "DIVERGENT") {
      await pushToActionFeed({
        workspaceId,
        source: "BID_STRATEGY",
        type: "ALERT",
        severity: "MEDIUM",
        title: t("ar", "alerts.metaBidAlertTitle", { adSet: result.adSetName ?? result.adSetId }),
        titleKey: "alerts.metaBidAlertTitle",
        titleVars: { adSet: result.adSetName ?? result.adSetId },
        description: result.message,
        descKey: result.messageKey,
        descVars: result.messageVars,
      });
    }
  }
}
