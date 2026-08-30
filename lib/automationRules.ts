// lib/automationRules.ts
//
// بيقيّم القواعد اللي المستخدم عرّفها، ضد بيانات "الحقيقة" بس (Verified/True) -
// مش بيانات المنصة الخام، عشان نفضل مختلفين عن Optmyzr/Revealbot/إلخ.
//
// أمان: requireApproval = true بشكل افتراضي لأي قاعدة بتاخد إجراء مالي
// (إيقاف كامبين، تغيير ميزانية) - القاعدة بتقترح، والمستخدم بيوافق، إلا لو
// هو بنفسه اختار "تنفيذ تلقائي" بشكل صريح.

import { t, Locale } from "@/lib/i18n/dictionary";
import { prisma } from "@/lib/prisma";
import { metricRollupRows } from "@/lib/metricRollup";
import { pushToActionFeed, ruleResultToActionFeedItem } from "@/lib/actionFeed";
import { computeCampaignCplChanges, detectMarketWideMove } from "@/lib/marketContext";

// RuleDefinition وRULE_TEMPLATES بقوا في ملف منفصل آمن للعميل
// (automationRuleDefinitions.ts) - إصلاح باگ بناء حقيقي كان بيحصل لما
// AutomationClient.tsx بيستوردهم من هنا مباشرة ويجرّ معاهم كل الاستعلامات
// السيرفرية في الملف ده. إعادة التصدير هنا عشان الكود القديم يفضل شغال.
import type { RuleDefinition } from "@/lib/automationRuleDefinitions";
export type { RuleDefinition } from "@/lib/automationRuleDefinitions";
export { RULE_TEMPLATES } from "@/lib/automationRuleDefinitions";

export interface DailyMetricValue {
  date: string; // YYYY-MM-DD
  /** 🔴 `null` = **لا نقطةَ قياسٍ لهذا اليوم**، لا «صفر».
   *
   *  كان المقام الناقص يُرجَع `0`، والصفرُ يحقّق **أيّ** شرط `LESS_THAN` -
   *  فيومٌ بلا تحويلات كان يُقرأ «أداءٌ كارثيّ» ويُغذّي عدّاد الأيّام
   *  المتتالية، ويكتم في الوقت نفسه تنبيهات `GREATER_THAN` في اليوم الذي
   *  لا بيانات فيه بالضبط. الغيابُ يكسر العدّ، ولا يطابق. */
  value: number | null;
}

export interface RuleEvaluationResult {
  triggered: boolean;
  currentValue: number | null;
  consecutiveDaysMatched: number;
  suggestedAction: string;
  blockedByCooldown: boolean; // اتحقق الشرط لكن اتمنع التنفيذ بسبب فترة التهدئة
  clampedActionValue?: number; // القيمة الفعلية بعد تطبيق سقف القفزة الواحدة (لو الأصلية أكبر)
}

export function evaluateRule(
  rule: RuleDefinition,
  recentValues: DailyMetricValue[], // آخر N يوم للمقياس ده، من الأحدث للأقدم
  lastExecutedAt: Date | null = null,
  locale: Locale
): RuleEvaluationResult {
  const sorted = [...recentValues].sort((a, b) => b.date.localeCompare(a.date));

  let consecutiveDaysMatched = 0;
  for (const day of sorted) {
    // يومٌ بلا قياس لا يطابق ولا يُتخطّى: يكسر التتابع. وإلّا صار الغيابُ
    // دليلاً - وهو أخطر ما يُبنى عليه إيقافُ حملة.
    if (day.value === null) break;

    const matches =
      rule.operator === "GREATER_THAN"
        ? day.value > rule.threshold
        : day.value < rule.threshold;

    if (matches) {
      consecutiveDaysMatched++;
    } else {
      break; // لازم تكون متتالية - أول يوم مبيحققش الشرط بيوقف العد
    }

    if (consecutiveDaysMatched >= rule.consecutiveDays) break;
  }

  const conditionMet = consecutiveDaysMatched >= rule.consecutiveDays;
  const currentValue = sorted[0]?.value ?? null;

  // فحص فترة التهدئة - حتى لو الشرط اتحقق، ممنوع تنفيذ إجراء جديد على
  // نفس الكامبين قبل ما تعدي المدة المحددة من آخر إجراء
  const cooldownDays = rule.cooldownDays ?? 3;
  const blockedByCooldown =
    conditionMet &&
    lastExecutedAt !== null &&
    (Date.now() - lastExecutedAt.getTime()) / 86400000 < cooldownDays;

  const triggered = conditionMet && !blockedByCooldown;

  // تطبيق سقف القفزة الواحدة - القيمة المقترحة متعديش الحد الأقصى المسموح
  // بغض النظر عن رقم actionValue الأصلي في تعريف القاعدة
  const maxJump = rule.maxSingleJumpPct ?? 20;
  const clampedActionValue =
    rule.actionValue !== undefined ? Math.min(rule.actionValue, maxJump) : undefined;

  return {
    triggered,
    currentValue,
    consecutiveDaysMatched,
    suggestedAction: describeAction({ ...rule, actionValue: clampedActionValue }, locale),
    blockedByCooldown,
    clampedActionValue,
  };
}

function describeAction(rule: RuleDefinition, locale: Locale): string {
  switch (rule.action) {
    case "PAUSE_CAMPAIGN":
      return t(locale, "automation.pauseCampaign");
    case "REDUCE_BUDGET_PCT":
      return t(locale, "automation.reduceBudget", { pct: rule.actionValue ?? 0 });
    case "INCREASE_BUDGET_PCT":
      return t(locale, "automation.increaseBudget", { pct: rule.actionValue ?? 0 });
    case "SEND_ALERT_ONLY":
      return t(locale, "automation.alertOnly");
  }
}

// قوالب جاهزة (RULE_TEMPLATES) بقت في lib/automationRuleDefinitions.ts
// (معاد تصديرها فوق) - عشان تفضل آمنة للاستيراد من كود العميل مباشرة.

// ==================== المُنسّق اليومي - الحلقة المفقودة التانية ====================
// نفس الاكتشاف بالظبط بتاع dailyTasks.ts: القواعد كانت بتتعمل من الواجهة،
// لكن محدش كان بيقيّمها ضد بيانات حقيقية ولا بيدفع النتيجة لـ Action Feed.

export async function runAutomationForWorkspace(workspaceId: string, locale: Locale) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || !workspace.enableAutomationRules) return;

  const rules = await prisma.automationRule.findMany({
    where: { workspaceId, enabled: true },
  });

  // بيتحسب مرة واحدة لكل الـ Workspace، مش لكل قاعدة لوحدها - نفس القيمة
  // بتخدم كل القواعد اللي محتاجة تتأكد من السياق قبل ما تقترح إجراء قاسي
  const cplChanges = await computeCampaignCplChanges(workspaceId);
  const marketWide = detectMarketWideMove(cplChanges);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const rule of rules) {
    const dailyValues = await getDailyMetricValues(workspaceId, rule.metric, thirtyDaysAgo);
    if (dailyValues.length === 0) continue;

    const definition: RuleDefinition = {
      id: rule.id,
      metric: rule.metric as RuleDefinition["metric"],
      operator: rule.operator as RuleDefinition["operator"],
      threshold: rule.threshold,
      consecutiveDays: rule.consecutiveDays,
      attributionBasis: rule.attributionBasis as RuleDefinition["attributionBasis"],
      action: rule.action as RuleDefinition["action"],
      actionValue: rule.actionValue ?? undefined,
      requireApproval: rule.requireApproval,
      maxSingleJumpPct: rule.maxSingleJumpPct ?? undefined,
      cooldownDays: rule.cooldownDays,
    };

    const result = evaluateRule(definition, dailyValues, rule.lastExecutedAt, locale);

    // حماية حقيقية: لو القرار قاسي (إيقاف/تقليل ميزانية) وفيه ضغط سوق عام
    // مؤكد إحصائياً، منقترحش الإجراء القاسي - بنبعت تنبيه معلوماتي بس
    // يشرح السياق، عشان مستخدم ميوقفش حملة كويسة بسبب ظرف خارجي عابر
    const isDrasticAction = definition.action === "PAUSE_CAMPAIGN" || definition.action === "REDUCE_BUDGET_PCT";
    if (result.triggered && isDrasticAction && marketWide.isMarketWide) {
      await pushToActionFeed({
        workspaceId,
        source: "AUTOMATION",
        type: "ALERT",
        severity: "MEDIUM",
        title: t("ar", "alerts.ruleMarketWideTitle", { rule: rule.name }),
        titleKey: "alerts.ruleMarketWideTitle",
        titleVars: { rule: rule.name },
        description: marketWide.explanation,
        descKey: "alerts.mktWideExplanation",
        descVars: { pct: marketWide.affectedCampaignsPct },
      });
      continue; // منكملش لباقي منطق الدفع العادي للقاعدة دي
    }

    // نحدّد الحملات المستهدفة فعلياً: نطاق القاعدة (كل الحملات أو حملات
    // محددة) + منصة القاعدة إن وُجدت. هذان الحقلان كانا موجودين في قاعدة
    // البيانات لكن المحرّك كان يتجاهلهما تماماً.
    const targetLinks = await prisma.campaignLink.findMany({
      where: {
        workspaceId,
        ...(rule.platform ? { platform: rule.platform } : {}),
        ...(rule.appliesTo === "SPECIFIC_CAMPAIGNS" && rule.specificCampaignIds.length > 0
          ? { externalCampaignId: { in: rule.specificCampaignIds } }
          : {}),
      },
      select: { externalCampaignId: true, campaignName: true, platform: true },
    });

    const needsTarget = rule.action === "PAUSE_CAMPAIGN"
      || rule.action === "REDUCE_BUDGET_PCT"
      || rule.action === "INCREASE_BUDGET_PCT";

    // إجراء تنفيذي بلا حملة مطابقة = لا شيء يُنفَّذ عليه
    if (needsTarget && targetLinks.length === 0) continue;

    const targets = needsTarget
      ? targetLinks.map((l: any) => ({
          platform: l.platform,
          campaignId: l.externalCampaignId,
          campaignName: l.campaignName,
          action: rule.action,
          // 🔴 القيمة **المقيّدة** بسقف القفزة الواحدة، لا الخام. كان
          // العنوان يعرض "زيادة 20%" (مقيّدة) بينما الحمولة تحمل
          // `rule.actionValue` الخام (300 مثلاً) - فتتربّع الميزانية والواجهة
          // تقول 20%. السقف كان يُطبَّق على نصّ العرض وحده.
          changePct: result.clampedActionValue ?? undefined,
        }))
      : [undefined];

    for (const target of targets) {
      const feedItem = ruleResultToActionFeedItem(
        workspaceId, rule.name, result, rule.requireApproval, locale, target
      );
      if (feedItem) await pushToActionFeed(feedItem);
    }

    if (result.triggered && !result.blockedByCooldown) {
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { lastExecutedAt: new Date() },
      });
    }
  }
}

// بيجيب سلسلة زمنية يومية لمقياس معين - مصدر البيانات الحقيقي اللي
// evaluateRule محتاجه. بعض المقاييس (RTO_RATE، UNATTRIBUTED_RATE) لسه
// معندهاش مصدر بيانات مزامن فعلياً - بترجع مصفوفة فاضية بدل بيانات وهمية
async function getDailyMetricValues(
  workspaceId: string,
  metric: string,
  since: Date
): Promise<DailyMetricValue[]> {
  if (metric === "CPL_VERIFIED" || metric === "TRUE_ROAS" || metric === "INFLATION_RATE") {
    // مسوّىً بمكان الظهور ومقصورٌ على منصّات الإعلان: صرفُ ميتا المعدود
    // مرّتين يقلب كلَّ عتبةٍ هنا، وهذه قواعدُ **تُوقف حملات**.
    const rows = await metricRollupRows({ workspaceId, date: { gte: since } });

    const byDate = new Map<string, { cost: number; verified: number; raw: number; revenue: number }>();
    for (const s of rows) {
      const key = s.date.toISOString().slice(0, 10);
      const existing = byDate.get(key) ?? { cost: 0, verified: 0, raw: 0, revenue: 0 };
      existing.cost += s.cost;
      existing.verified += s.verifiedConversions;
      existing.raw += s.rawConversions;
      existing.revenue += s.revenue;
      byDate.set(key, existing);
    }

    return Array.from(byDate.entries()).map(([date, d]) => {
      let value: number | null = null;
      if (metric === "CPL_VERIFIED") {
        // بلا تحويلٍ متحقَّق لا تكلفةَ عميلٍ - لا صفر
        value = d.verified > 0 ? d.cost / d.verified : null;
      } else if (metric === "TRUE_ROAS") {
        // 🔴 **كان `verified / cost` - عددٌ مقسومٌ على مال.**
        //
        // حملةٌ بخمسمئة ريال وعشرةِ تحويلاتٍ متحقَّقة تُعطي `0.02`، والقالب
        // الجاهز «أوقف عند عائدٍ سالب» هو `TRUE_ROAS < 1` لثلاثة أيّام -
        // **فيتحقّق في كلّ حسابٍ عنده ثلاثةُ أيّام بيانات، على كلّ حملةٍ
        // بما فيها أفضلُها**، وكلٌّ منها على بُعد دوسةِ تأكيدٍ من الإيقاف.
        //
        // العائد نسبةُ مالٍ إلى مال: `revenue` هو ما تنسبه المنصّة لإعلانها
        // (نفس بسط ROAS في مركز الحقيقة و`bidStrategyAudit`). وبلا إيرادٍ
        // مقيسٍ لا عائد - `null` لا صفر، وإلّا صار «لم نقِس» دليلَ خسارة.
        value = d.cost > 0 && d.revenue > 0 ? d.revenue / d.cost : null;
      } else if (metric === "INFLATION_RATE") {
        value = d.raw > 0 ? ((d.raw - d.verified) / d.raw) * 100 : null;
      }
      return { date, value };
    });
  }

  // RESPONSE_TIME_MINUTES, UNATTRIBUTED_RATE, RTO_RATE - معندناش مصدر
  // بيانات يومي مزامن ليهم لسه (محتاجين تكامل واتساب مباشر أو بيانات
  // إيكومرس أعمق) - القاعدة هتفضل مسجّلة بس مش هتتفعّل لحد ما نبنيه
  return [];
}
// حماية أخيرة: حتى لو كل قرار فردي كان معقول ومعتمد وقت اتخاذه، وحتى لو
// عدة قواعد مختلفة قررت زيادة نفس الكامبين بمرور الوقت، مجموع كل
// التغييرات في الشهر الواحد (بغض النظر عن اتجاهها) مينفعش يعدي السقف
// اللي المستخدم حدده بنفسه في إعدادات الـ Workspace.

export interface MonthlyBudgetChangeRecord {
  executedAt: Date;
  changePct: number; // موجب = زيادة، سالب = تقليل
}

export function checkMonthlyChangeCeiling(
  changesThisMonth: MonthlyBudgetChangeRecord[],
  ceilingPct: number,
  proposedChangePct: number
): { allowed: boolean; totalChangeIfApplied: number; ceilingPct: number } {
  const totalSoFar = changesThisMonth.reduce(
    (sum, c) => sum + Math.abs(c.changePct),
    0
  );
  const totalChangeIfApplied = totalSoFar + Math.abs(proposedChangePct);

  return {
    allowed: totalChangeIfApplied <= ceilingPct,
    totalChangeIfApplied,
    ceilingPct,
  };
}
