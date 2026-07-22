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
import { pushToActionFeed, ruleResultToActionFeedItem } from "@/lib/actionFeed";
import { computeCampaignCplChanges, detectMarketWideMove } from "@/lib/marketContext";

export interface RuleDefinition {
  id: string;
  metric:
    | "CPL_VERIFIED"
    | "INFLATION_RATE"
    | "TRUE_ROAS"
    | "UNATTRIBUTED_RATE"
    | "RESPONSE_TIME_MINUTES"
    | "RTO_RATE";
  operator: "GREATER_THAN" | "LESS_THAN";
  threshold: number;
  consecutiveDays: number;
  // كل قاعدة تختار مستوى ثقتها بشكل مستقل - محادثات مؤكدة بس، أو مؤكدة
  // + نصيبها من التوزيع الاحتمالي (لو الـ Workspace مفعّل عنده أصلاً)
  attributionBasis: "VERIFIED_ONLY" | "INCLUDE_MODELED";
  action: "PAUSE_CAMPAIGN" | "REDUCE_BUDGET_PCT" | "INCREASE_BUDGET_PCT" | "SEND_ALERT_ONLY";
  actionValue?: number;
  requireApproval: boolean;
  // ضمانات مالية - بنفس فلسفة الـ Rate Limiting بالظبط
  maxSingleJumpPct?: number; // أقصى نسبة تغيير ميزانية في الإجراء الواحد
  cooldownDays?: number;     // أقل مدة بين إجراءين على نفس الكامبين
}

export interface DailyMetricValue {
  date: string; // YYYY-MM-DD
  value: number;
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
  locale: Locale = "ar"
): RuleEvaluationResult {
  const sorted = [...recentValues].sort((a, b) => b.date.localeCompare(a.date));

  let consecutiveDaysMatched = 0;
  for (const day of sorted) {
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

function describeAction(rule: RuleDefinition, locale: Locale = "ar"): string {
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

// قوالب جاهزة (Templates) - عشان المستخدم يقدر يبدأ بضغطة واحدة بدل ما
// يبني كل قاعدة من الصفر. كلها مبنية على مقاييس الحقيقة فقط.
//
// ملاحظة تصحيح من المراجعة الشاملة: القوالب دي كانت معرّفة هنا بشكل، ومكررة
// تاني بشكل مختلف شوية (بحقل name إضافي) جوه AutomationClient.tsx - تناقض
// حقيقي كان ممكن يخليهم يختلفوا عن بعض بمرور الوقت. دلوقتي RULE_TEMPLATES
// هي المصدر الوحيد، وبتحتوي name عشان تصلح لإنشاء AutomationRule فعلي مباشرة.
export const RULE_TEMPLATES: Array<Omit<RuleDefinition, "id"> & { name: string }> = [
  {
    name: "تنبيه ارتفاع تكلفة العميل",
    metric: "CPL_VERIFIED",
    operator: "GREATER_THAN",
    threshold: 30, // المستخدم بيعدلها حسب السوق بتاعه
    consecutiveDays: 3,
    attributionBasis: "VERIFIED_ONLY",
    action: "SEND_ALERT_ONLY",
    requireApproval: true,
  },
  {
    name: "تقليل الميزانية عند تضخم المنصة",
    metric: "INFLATION_RATE",
    operator: "GREATER_THAN",
    threshold: 50,
    consecutiveDays: 2,
    attributionBasis: "VERIFIED_ONLY",
    action: "REDUCE_BUDGET_PCT",
    actionValue: 20,
    requireApproval: true,
    maxSingleJumpPct: 20,
    cooldownDays: 3,
  },
  {
    name: "إيقاف عند عائد سلبي",
    metric: "TRUE_ROAS",
    operator: "LESS_THAN",
    threshold: 1,
    consecutiveDays: 3,
    attributionBasis: "VERIFIED_ONLY",
    action: "PAUSE_CAMPAIGN",
    requireApproval: true, // إجراء بهذه الخطورة يستحق موافقة دائماً، حتى لو المستخدم فعّل التنفيذ التلقائي لقواعد تانية
  },
  {
    name: "توسّع عند أداء قوي مستقر",
    // قاعدة توسّع - مش كل القواعد لازم تكون "إيقاف"، الأداء القوي الحقيقي
    // يستاهل زيادة ميزانية بنفس منطق الثقة، مش بس خفضها وقت المشاكل
    metric: "TRUE_ROAS",
    operator: "GREATER_THAN",
    threshold: 3,
    consecutiveDays: 5, // فترة أطول من قاعدة الإيقاف - عشان نتأكد إنه اتجاه مستقر مش يوم حظ
    attributionBasis: "VERIFIED_ONLY",
    action: "INCREASE_BUDGET_PCT",
    actionValue: 15,
    requireApproval: true,
    maxSingleJumpPct: 15,
    cooldownDays: 5, // فترة تهدئة أطول من التقليل - عشان نشوف أثر الزيادة قبل أي زيادة تانية
  },
];

// ==================== المُنسّق اليومي - الحلقة المفقودة التانية ====================
// نفس الاكتشاف بالظبط بتاع dailyTasks.ts: القواعد كانت بتتعمل من الواجهة،
// لكن محدش كان بيقيّمها ضد بيانات حقيقية ولا بيدفع النتيجة لـ Action Feed.

export async function runAutomationForWorkspace(workspaceId: string, locale: Locale = "ar") {
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
        type: "ALERT",
        severity: "MEDIUM",
        title: `${rule.name}: الشرط تحقق، لكن السبب الأرجح ضغط سوق عام مش مشكلة في الحملة`,
        description: marketWide.explanation,
      });
      continue; // منكملش لباقي منطق الدفع العادي للقاعدة دي
    }

    const feedItem = ruleResultToActionFeedItem(workspaceId, rule.name, result, rule.requireApproval, locale);

    if (feedItem) {
      await pushToActionFeed(feedItem);
      if (result.triggered && !result.blockedByCooldown) {
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: { lastExecutedAt: new Date() },
        });
      }
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
    const snapshots = await prisma.metricSnapshot.findMany({
      where: { workspaceId, date: { gte: since } },
      select: { date: true, cost: true, verifiedConversions: true, rawConversions: true },
    });

    const byDate = new Map<string, { cost: number; verified: number; raw: number }>();
    for (const s of snapshots) {
      const key = s.date.toISOString().slice(0, 10);
      const existing = byDate.get(key) ?? { cost: 0, verified: 0, raw: 0 };
      existing.cost += s.cost;
      existing.verified += s.verifiedConversions;
      existing.raw += s.rawConversions;
      byDate.set(key, existing);
    }

    return Array.from(byDate.entries()).map(([date, d]) => {
      let value = 0;
      if (metric === "CPL_VERIFIED") value = d.verified > 0 ? d.cost / d.verified : 0;
      else if (metric === "TRUE_ROAS") value = d.cost > 0 ? d.verified / d.cost : 0; // تقريب مبسّط - العائد الحقيقي الكامل محتاج بيانات إيكومرس إضافية
      else if (metric === "INFLATION_RATE") value = d.raw > 0 ? ((d.raw - d.verified) / d.raw) * 100 : 0;
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
