// lib/executingActions.ts
//
// **ما الذي يكتب فعلاً في حساب إعلانات العميل؟ قائمةٌ واحدة يشير إليها
// التوثيقُ والكودُ معاً.**
//
// 🔴 كان التوثيق (`CLAUDE.md`) يقول إنّ «زرّ موافق ينفّذ نداءً حقيقياً على
// تدرّج المزايدة بس»، وهو **غلطٌ في الاتجاهين**: المنفَّذ فعلاً أوسع من
// ذلك بكثير (إيقافُ إعلان، إيقافُ حملة كاملة، تغييرُ ميزانية، تطبيقُ سعر)،
// **وسطحٌ كاملٌ لا يذكره التوثيق أصلاً** هو `/api/creatives/decision`
// (توسيعٌ وإيقاف). وخطورةُ ذلك ليست في السطر المكتوب: النموذجُ التشغيليّ
// الذي بُني عليه كلُّ قرارِ أمانٍ آخر كان مبنيّاً على اعتقادٍ خاطئ، فبقي
// مساران يحرّكان الميزانية **بلا رقيب**.
//
// فالقائمة هنا لا في نصٍّ يُنسى تحديثه. وأيُّ `case` جديد في
// `applyActionFeedItem` يُضاف إليها في اللحظة نفسها.

/**
 * أنواع الإجراءات التي **تُصدِر نداءً حقيقياً إلى منصّة الإعلان** عند
 * الموافقة - مأخوذةٌ حرفياً من `switch` في `lib/actionFeed.ts`.
 */
export const EXECUTING_ACTION_TYPES = [
  "SET_BID_STRATEGY_GOOGLE",
  "SET_BID_STRATEGY_META",
  "SET_BID_STRATEGY_TIKTOK",
  "PAUSE_AD_GOOGLE",
  "PAUSE_AD_META",
  "PAUSE_AD_TIKTOK",
  "PAUSE_CAMPAIGN",
  "CHANGE_CAMPAIGN_BUDGET",
  "APPLY_PRODUCT_PRICE",
] as const;

export type ExecutingActionType = (typeof EXECUTING_ACTION_TYPES)[number];

/** هل هذا الإجراء يكتب على المنصّة فعلاً (لا يُسجَّل `APPLIED` وحسب)؟ */
export function isExecutingAction(actionType: string | null | undefined): boolean {
  return !!actionType && (EXECUTING_ACTION_TYPES as readonly string[]).includes(actionType);
}

/**
 * أسطحُ الكتابة خارج فيد القرارات - تُذكَر هنا كي لا تبقى خارج أيّ جرد:
 *
 * - **`POST /api/creatives/decision`** → `applyAdDecision` في
 *   `lib/adDecisions.ts`: `SCALE` يرفع ميزانية المجموعة/الحملة الأمّ،
 *   و`PAUSE` يوقف الإعلان الفرديّ. (`HOLD` لا يكتب على المنصّة.)
 * - **`lib/stockGuard.ts`** → إيقافُ حملةٍ كاملة حين ينفد المخزون.
 * - **`lib/automationRules.ts`** → تغييرُ ميزانية الحملة من قاعدة أتمتة.
 *
 * الاستشاريّ فعلاً (يسجّل `APPLIED` بلا نداءٍ خارجيّ): اقتراحاتُ شكل
 * المحتوى، وبنودُ التوسيع التي يدفعها `scaleKillAlerts`.
 */
export const WRITE_SURFACES_OUTSIDE_ACTION_FEED = [
  "POST /api/creatives/decision (SCALE | PAUSE)",
  "lib/stockGuard.ts (PAUSE_CAMPAIGN عند نفاد المخزون)",
  "lib/automationRules.ts (CHANGE_CAMPAIGN_BUDGET)",
] as const;
