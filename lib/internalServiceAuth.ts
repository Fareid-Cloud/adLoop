// lib/internalServiceAuth.ts
//
// مصادقة بسيطة بين خدمتنا احنا (wa-conversion-tracker) وadloop-saas -
// مش webhook طرف تالت زي ميتا/سلة، فمفيش داعي لتوقيع HMAC معقد. سر
// مشترك واحد كافي، لأن الطرفين تحت سيطرتنا احنا بالكامل.

import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

// 🔴 **مقارنةٌ ثابتة الزمن، لا `===`.** المقارنةُ النصّية العادية ترجع
// عند أوّل محرفٍ مختلف، فزمنُها يسرّب طولَ البادئة المطابقة - ومنه يُبنى
// السرُّ محرفاً محرفاً. والسرُّ ده يحرس **كتابةَ الرقم المتحقَّق في أيّ
// مساحة عمل**، فهو من أثمن ثلاثة أصولٍ في النظام. وحارسُ الكرون في نفس
// المشروع (`lib/cronAuth.ts`) يستعمل نفسَ النمط ويشرح نفسَ السبب - وكان
// هذا الملفّ وحده يقارن بـ`===`، وهو فرقٌ لا مبرّر له بين سرّين متساويي
// الحسّاسية. (فرقُ الطول يُسرَّب هنا وهو تسريبٌ مقبول: طولُ السرّ لا السرّ.)
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyInternalServiceAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.INTERNAL_SERVICE_SECRET;

  if (!expected) {
    console.error("INTERNAL_SERVICE_SECRET غير مضبوط - رافضين كل الطلبات لحد ما يتظبط");
    return false;
  }

  if (!authHeader) return false;
  return safeEqual(authHeader, `Bearer ${expected}`);
}
