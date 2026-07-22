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
      message: "أقل تكلفة من غير سقف - لا يوجد هدف مضبوط يُفحص أصلاً، ميتا بتحسّن بحرية كاملة.",
    };
  }

  if (input.bidAmount === null || input.verifiedCpa === null || verifiedSampleSize < MIN_VERIFIED_SAMPLE) {
    return {
      ...base, hasTarget: input.bidAmount !== null, divergencePct: null, status: "NOT_APPLICABLE",
      message: "لا توجد عينة تحويلات حقيقية كافية للمقارنة بعد.",
    };
  }

  const divergencePct = Math.round(((input.verifiedCpa - input.bidAmount) / input.bidAmount) * 100);
  const isDivergent = Math.abs(divergencePct) > DIVERGENCE_THRESHOLD_PCT;

  if (input.bidStrategyType === "COST_CAP") {
    return {
      ...base, hasTarget: true, divergencePct,
      status: isDivergent ? "DIVERGENT" : "ALIGNED",
      message: isDivergent
        ? `Cost Cap المضبوط (${input.bidAmount}) بعيد عن تكلفة العميل الحقيقية الفعلية (${input.verifiedCpa}) بنسبة ${Math.abs(divergencePct)}% - ميتا بتحسّن نحو متوسط مش واقعي.`
        : `Cost Cap قريب من الواقع الفعلي (فرق ${Math.abs(divergencePct)}% بس) - منطقي.`,
    };
  }

  if (input.bidStrategyType === "LOWEST_COST_WITH_BID_CAP") {
    // هنا الفرق المفاهيمي المهم - سقف منخفض جداً معناه تقييد وصول، مش
    // بالضرورة "الرقم غلط" - الرسالة بتوضح الفرق ده صراحة
    return {
      ...base, hasTarget: true, divergencePct,
      status: isDivergent ? "DIVERGENT" : "ALIGNED",
      message: isDivergent
        ? divergencePct > 0
          ? `Bid Cap (${input.bidAmount}) أقل بكتير من تكلفة العميل الحقيقية (${input.verifiedCpa}) - ده على الأرجح بيقيّد وصولك ويقلل الظهور في مزايدات كتير، مش "هدف غلط" زي Cost Cap.`
          : `Bid Cap (${input.bidAmount}) أعلى بكتير من تكلفة العميل الحقيقية - سقف واسع أكتر من اللازم، مفيش استفادة حقيقية منه.`
        : `Bid Cap قريب من الواقع الفعلي - منطقي.`,
    };
  }

  // LOWEST_COST_WITH_MIN_ROAS أو نوع مش معروف - نطبّق نفس منطق Cost Cap
  // كتقريب معقول، مع توضيح إننا مش متأكدين 100% من التفسير
  return {
    ...base, hasTarget: true, divergencePct,
    status: isDivergent ? "DIVERGENT" : "ALIGNED",
    message: isDivergent
      ? `الهدف المضبوط (${input.bidAmount}) بعيد عن الواقع الفعلي (${input.verifiedCpa}) بنسبة ${Math.abs(divergencePct)}%.`
      : "الهدف المضبوط قريب من الواقع الفعلي.",
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
        type: "ALERT",
        severity: "MEDIUM",
        title: `${result.adSetName ?? result.adSetId}: هدف المزايدة بعيد عن الواقع`,
        description: result.message,
      });
    }
  }
}
