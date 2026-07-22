// lib/automationRuleDefinitions.ts
//
// 🔴 إصلاح باگ بناء حقيقي: كان AutomationClient.tsx (كود بيشتغل في
// المتصفح) بيستورد RULE_TEMPLATES من automationRules.ts مباشرة - لكن
// نفس الملف ده فيه استعلامات Prisma واستدعاءات actionFeed.ts اللي
// بتجرّ معاها مكتبة google-ads-api (بتستخدم gRPC، محتاجة fs/tls/net
// من Node.js - مش موجودين في المتصفح خالص). النتيجة: فشل بناء كامل.
//
// الحل: فصل البيانات الثابتة الآمنة للعميل (النوع + القوالب) في ملف
// مستقل تماماً، صفر استيراد من أي حاجة سيرفر-فقط. automationRules.ts
// بيعيد تصديرهم من هنا عشان الكود السيرفري القديم يفضل شغال من غير تعديل.

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
  attributionBasis: "VERIFIED_ONLY" | "INCLUDE_MODELED";
  action: "PAUSE_CAMPAIGN" | "REDUCE_BUDGET_PCT" | "INCREASE_BUDGET_PCT" | "SEND_ALERT_ONLY";
  actionValue?: number;
  requireApproval: boolean;
  maxSingleJumpPct?: number;
  cooldownDays?: number;
}

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
