// lib/subscriptionEvents.ts
//
// **سجلّ ما حصل للاشتراك، مش حالته دلوقتي.**
//
// 🔴 `User.subscriptionStatus` بيقول الوضع الحالي وبس - مبيقولش إمتى
// اتغيّر ولا من أنهي باقة لأنهي ولا مين غيّره. من غير الجدول ده، معدّل
// الإلغاء و"النموّ مقابل الانكماش" والترقية/التخفيض كلها بتتحسب بالتخمين
// من تواريخ متفرّقة - وبنتيجة بتتغيّر كل ما منطق التخمين يتعدّل.
//
// نقطة كتابة واحدة عشان أي مسار جديد بيغيّر اشتراك (ويب هوك دفع، تمديد
// إداري، هدية، إلغاء) يعدّي من هنا - مسار بيغيّر الاشتراك من غير حدث
// معناه فجوة في التقرير مش هتظهر غير بعد شهور.

import { prisma } from "@/lib/prisma";
import type { SubscriptionEventType } from "@prisma/client";

export interface SubscriptionEventInput {
  userId: string;
  type: SubscriptionEventType;
  fromPlan?: string | null;
  toPlan?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  /** null = النظام (ويب هوك). قيمة = فعل إداريّ بيد شخص.
   *  التفرقة دي هي الفرق بين "إيراد" و"هدية" في أي تقرير إيراد. */
  actorAdminId?: string | null;
  note?: string | null;
}

/**
 * الكتابة **لا تُفشل العملية الأصلية أبداً.**
 *
 * الحدث سجلّ تحليليّ، والعملية اللي جايّة منها (تفعيل اشتراك مدفوع مثلاً)
 * هي الحاجة اللي العميل دفع فيها. لو الإدراج وقع لأي سبب، خسارة صفّ في
 * تقرير أهون بكتير من دفعة اتحصّلت والاشتراك مااتفعّلش.
 */
export async function logSubscriptionEvent(input: SubscriptionEventInput): Promise<void> {
  try {
    await prisma.subscriptionEvent.create({
      data: {
        userId: input.userId,
        type: input.type,
        fromPlan: input.fromPlan ?? null,
        toPlan: input.toPlan ?? null,
        amountCents: input.amountCents ?? null,
        currency: input.currency ?? null,
        actorAdminId: input.actorAdminId ?? null,
        note: input.note ?? null,
      },
    });
  } catch (err) {
    console.error("[subscriptionEvents] فشل تسجيل حدث اشتراك", err);
  }
}
