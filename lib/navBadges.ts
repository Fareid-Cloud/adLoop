// lib/navBadges.ts
//
// **عدّادات الأقسام في القائمة الجانبية.**
//
// المشكلة التي تحلّها: لا شيء في القائمة يقول أن شيئاً ينتظرك. المستخدم
// يفتح «القرارات» فيجد أربعة بنود لم يكن يعرف بوجودها، أو لا يفتحها أصلاً
// لأنه لا يملك سبباً للظنّ بأن فيها جديداً. الرقم على القسم هو السبب.
//
// **يُعدّ ما ينتظر فعلاً لا كل ما في القسم.** عدّاد يعرض «٢٤» بينما كلّها
// بنود قديمة مقروءة يفقد معناه بعد يومين ويصير ضجيجاً بصرياً دائماً.

import { prisma } from "@/lib/prisma";

export type NavBadges = Record<string, number>;

/**
 * مفاتيح العدّادات هي مسارات الأقسام نفسها - فلا حاجة لجدول ربط بينها
 * وبين عناصر القائمة، ولا لخطر انحرافهما عن بعضهما.
 */
export async function getNavBadges(workspaceId: string | null): Promise<NavBadges> {
  if (!workspaceId) return {};

  try {
    const [pendingActions, measuredExperiments, unreadAlerts] = await Promise.all([
      // قرارات تنتظر موافقتك أو رفضك - لا المنفَّذة ولا المرفوضة
      prisma.actionFeedItem.count({
        where: { workspaceId, status: "PENDING", type: { in: ["SUGGESTION", "ALERT"] } },
      }),
      // تجربة أُغلقت نافذة قياسها ولم تُقرأ نتيجتها بعد
      prisma.experimentLog.count({
        where: { workspaceId, status: "MEASURED" },
      }),
      // تنبيهات حسابية غير مقروءة (نفس مصدر الجرس)
      prisma.actionFeedItem.count({
        where: { workspaceId, type: "ACCOUNT", read: false },
      }),
    ]);

    const badges: NavBadges = {};
    if (pendingActions > 0) badges["/dashboard/actions"] = pendingActions;
    if (measuredExperiments > 0) badges["/dashboard/experiments"] = measuredExperiments;
    if (unreadAlerts > 0) badges["/dashboard/diagnostics"] = unreadAlerts;
    return badges;
  } catch (err) {
    // العدّادات إضافة إلى القائمة لا شرط لعملها - فشلها يُخفيها ولا يُسقطها
    console.error("[navBadges] تعذّر حساب عدّادات الأقسام:", err);
    return {};
  }
}
