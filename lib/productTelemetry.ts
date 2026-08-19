// lib/productTelemetry.ts
//
// قياسان خفيفان يجاوبوا على سؤالين مافيش إجابة ليهم قبل كده:
//   • **"كام حساب نشط النهاردة/الأسبوع ده؟"** - `lastActiveAt` طابع زمنيّ
//     واحد بيتكتب فوق نفسه، فبيقول "آخر مرّة" وبس. صفّ يوميّ بيحوّل
//     السؤال لعدّة بسيطة.
//   • **"أنهي ميزة بتتستخدم فعلاً؟"** - الميزات المدفوعة بالـAI عندها
//     عدّادات، وباقي المنتج مافيهوش أي قياس.
//
// **الاتنين مابيفشّلوش العملية اللي جايين منها أبداً.** ده قياس، والعملية
// اللي المستخدم عملها هي المهمّة - خسارة صفّ تحليلات أهون ألف مرّة من
// طلب بيقع عشان سطر تسجيل.

import { prisma } from "@/lib/prisma";
import type { InstrumentedFeatureKey } from "@/lib/admin/product";

/**
 * تسجيل يوم نشاط.
 *
 * `upsert` على `[userId, date]` معناها إنّها بتتنده كام مرّة في اليوم بلا
 * فرق - فمافيش داعي لأي throttle حواليها، بخلاف `lastActiveAt`.
 */
export async function markActiveToday(userId: string): Promise<void> {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  try {
    await prisma.userActivityDay.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date },
      update: {},
    });
  } catch {
    // صامت عن قصد: الدالة بتتنده من الـlayout اللي بيلفّ كل صفحة، وأي
    // خطأ بيرتفع منه بيسقّط التطبيق كله بشاشة خطأ عامة.
  }
}

/**
 * تسجيل استخدام ميزة.
 *
 * المفتاح **من قائمة مغلقة** (`INSTRUMENTED_FEATURES`) مش نصّ حرّ: نصّ حرّ
 * معناه إنّ خطأ إملائي في موضع واحد بيخلق ميزة وهمية في التقرير وبيفضي
 * الميزة الحقيقية، وهي الحالة اللي بتفضل شهور من غير ما حد ياخد باله.
 */
export function logFeatureUse(
  userId: string,
  key: InstrumentedFeatureKey,
  workspaceId?: string | null
): void {
  // بلا `await` عن قصد: القياس مالوش الحقّ يبطّئ ردّ الطلب.
  void prisma.featureEvent
    .create({ data: { userId, key, workspaceId: workspaceId ?? null } })
    .catch(() => {});
}
