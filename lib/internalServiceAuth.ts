// lib/internalServiceAuth.ts
//
// مصادقة بسيطة بين خدمتنا احنا (wa-conversion-tracker) وadloop-saas -
// مش webhook طرف تالت زي ميتا/سلة، فمفيش داعي لتوقيع HMAC معقد. سر
// مشترك واحد كافي، لأن الطرفين تحت سيطرتنا احنا بالكامل.

import { NextRequest } from "next/server";

export function verifyInternalServiceAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.INTERNAL_SERVICE_SECRET;

  if (!expected) {
    console.error("INTERNAL_SERVICE_SECRET غير مضبوط - رافضين كل الطلبات لحد ما يتظبط");
    return false;
  }

  return authHeader === `Bearer ${expected}`;
}
