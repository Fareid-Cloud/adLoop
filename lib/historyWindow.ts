// lib/historyWindow.ts
//
// حدّ عمق التاريخ (`historyMonths`) - آخر حدٍّ كان معروضاً في جدول الباقات
// بلا تطبيق.
//
// **لماذا ملفّ منفصل عن `dateRange.ts`:** ذاك يُستورَد في مكوّنات المتصفّح
// (منتقي الفترة)، وأيّ استيراد لـPrisma فيه يجرّ الخادم كاملاً إلى حزمة
// العميل. هذا الملفّ للخادم وحده.
//
// **ولماذا لا يأخذ `userId`:** ستّ عشرة صفحة تحسب حدود التاريخ **قبل** أن
// تجلب المستخدم، فتمرير المعرّف كان يعني إعادة ترتيب ستّ عشرة دالّة -
// تغييرٌ واسع لغرضٍ ضيّق، وكلّ ملفّ فيه فرصة خطأ. القراءة من الجلسة هنا
// تجعل التغيير في موضع النداء **سطراً واحداً** لا إعادة ترتيب.
//
// و`cache` من React تجعل نداءات الصفحة الواحدة استعلاماً واحداً: الصفحة
// قد تحسب الحدود مرّتين (للفترة الحالية وفترة المقارنة)، فبدونها استعلامان.

import { cache } from "react";
import { getSessionUserFromCookies } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { toDateBounds, type DateRange } from "@/lib/dateRange";

/**
 * أقدم تاريخ تسمح به باقة المستخدم - `null` حين لا حدّ.
 *
 * `-1` تعني بلا حدّ في كتالوج الباقات، وتمرّ هنا كـ`null` لا كتاريخ في
 * الماضي السحيق - فرقٌ يظهر في الرسالة التي تُعرض للمستخدم.
 */
export const historyFloor = cache(async (): Promise<Date | null> => {
  try {
    const user = await getSessionUserFromCookies();
    if (!user) return null;
    const months = (await getEntitlements(user.id)).limits.historyMonths;
    if (!months || months < 0) return null;

    const floor = new Date();
    floor.setMonth(floor.getMonth() - months);
    floor.setHours(0, 0, 0, 0);
    return floor;
  } catch (err) {
    // تعذّرت القراءة = لا نحجب بيانات. حدٌّ يُطبَّق بالخطأ يُخفي عن العميل
    // أرقاماً يملكها، وهو ضررٌ أكبر من عرض شهرٍ زائد.
    console.error("[historyWindow] تعذّرت قراءة حدّ التاريخ:", err);
    return null;
  }
});

/**
 * حدود التاريخ بعد قصّها عند حدّ الباقة.
 *
 * تحلّ محلّ `toDateBounds` في كلّ صفحة تقرأ بيانات تاريخية. الحدّ يُطبَّق
 * على **الاستعلام** لا على المنتقي وحده: منتقٍ مقيَّد يمنع الاختيار، لكنّ
 * رابطاً محفوظاً بتاريخ أقدم يمرّ من حوله - وهذه هي الحلقة التي يجب أن
 * تُغلق.
 */
export async function toDateBoundsForUser(range: DateRange): Promise<{ gte: Date; lte: Date }> {
  const bounds = toDateBounds(range);
  const floor = await historyFloor();
  if (floor && bounds.gte < floor) return { ...bounds, gte: floor };
  return bounds;
}

/**
 * المدى نفسه مقصوصاً - لمن يحتاج `DateRange` لا حدود Prisma.
 *
 * `runReport` تأخذ مدى وتحوّله بنفسها، ولا يجوز أن تستورد هذا الملفّ:
 * ملفّها يُستورَد من مكوّن متصفّح للأنواع والثوابت، فاستيراد `next/headers`
 * عبره يجرّ الخادم إلى حزمة العميل ويكسر البناء. فالقصّ يقع عند مستدعيها.
 */
export async function clampRangeForUser(range: DateRange): Promise<DateRange> {
  const floor = await historyFloor();
  if (!floor) return range;
  const iso = floor.toISOString().slice(0, 10);
  return range.from < iso ? { ...range, from: iso } : range;
}
