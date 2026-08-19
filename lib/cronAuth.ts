// lib/cronAuth.ts
//
// **حارس واحد لكل مهامّ الكرون - وبيفشل مقفول.**
//
// 🔴 النمط اللي كان متكرّر في ستّة مسارات فيه ثغرتان حقيقيتان، والاتنين
// بيظهروا في نفس اللحظة: لمّا `CRON_SECRET` ما يكونش مضبوطاً.
//
//   ١) خمسة مسارات كانت بتقارن كده:
//        authHeader !== `Bearer ${process.env.CRON_SECRET}`
//      لو المتغيّر غير مضبوط، القالب بيطلع النصّ "Bearer undefined"
//      حرفياً - فأي طلب بالهيدر ده بالظبط بيعدّي الحارس. سرّ ناقص كان
//      بيتحوّل لسرٍّ معروف، مش لبابٍ مقفول.
//
//   ٢) `marketing-emails` كان أسوأ: `if (secret && ...)` - يعني لو السرّ
//      ناقص، الشرط كلّه بيتخطّى والمسار مفتوح بالكامل. والتعليق اللي فوقه
//      كان بيحذّر من نفس اللي بيحصل: "بدونه يستطيع أيّ أحد إطلاق حملة
//      بريدية على كلّ المشتركين بطلب واحد".
//
// القاعدة هنا معكوسة: **غياب السرّ يقفل الباب، مش يفتحه.** إعدادٌ ناقص
// يوقف مهمّةً مجدولة - وده عطلٌ ظاهر يتصلّح في دقيقة. أمّا فتح المسار
// فعطلٌ صامت محدش بيلاحظه غير المهاجم.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/** مقارنةٌ ثابتة الزمن - المقارنة النصّية العادية بتسرّب طول البادئة المطابقة */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // `timingSafeEqual` بترمي لو الطولان مختلفان، والفحص ده نفسه بيسرّب
  // الطول - وهو تسريبٌ مقبول: طول السرّ مش السرّ.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * بترجّع `null` لو الطلب مصرّح له، أو ردّ الرفض الجاهز لو لأ.
 *
 * الاستخدام في أول أي مسار كرون:
 * ```ts
 * const denied = denyUnlessCron(req);
 * if (denied) return denied;
 * ```
 */
export function denyUnlessCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  // فشلٌ مقفول: من غير سرٍّ مضبوط مافيش مهمّة بتجري. الرسالة بتفرّق عن
  // الرفض العادي عشان صاحب النظام يعرف إنّ ده إعدادٌ ناقص مش مهاجم -
  // ومحدش تاني بيشوف الردّ ده أصلاً غير اللي بينده المسار.
  if (!secret) {
    console.error(
      "[cron] CRON_SECRET غير مضبوط - المهمّة مرفوضة. " +
        "المهامّ المجدولة كلّها متوقّفة لحد ما يتضبط."
    );
    return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !safeEqual(authHeader, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}
