// app/api/auth/mfa/setup/route.ts
//
// بيولّد سر جديد وكود QR - MFA لسه مش مفعّل لحد ما المستخدم يأكد أول
// كود صحيح عن طريق verify-setup (يمنع تفعيل خاطئ يقفل المستخدم بره حسابه).

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { generateMfaSecret, generateMfaQrCode } from "@/lib/mfa";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const secret = generateMfaSecret();
  const qrCodeDataUrl = await generateMfaQrCode(user.email, secret);

  // بنرجّع السر الخام مؤقتاً للمتصفح بس (مش بنخزنه في قاعدة البيانات
  // إلا بعد التأكيد في verify-setup) - المستخدم بيبعته تاني وقت التأكيد
  return NextResponse.json({ secret, qrCodeDataUrl });
}
