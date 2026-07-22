// lib/oauthState.ts
//
// حماية من CSRF في تدفقات الـ OAuth - بدل ما نخزن "state" في قاعدة بيانات
// أو جلسة سيرفر مؤقتة، بنوقّعه كـ JWT قصير العمر يحمل userId + رمز عشوائي.
// المنصة (جوجل/ميتا) بترجعه لنا زي ما هو في الـ callback، ونتحقق من التوقيع
// والصلاحية قبل ما نكمل - بيثبت إن الطلب راجع من نفس المستخدم اللي بدأ
// العملية، مش حد تاني بيحاول يخترق الـ redirect.

import jwt from "jsonwebtoken";
import crypto from "crypto";

export function createOAuthState(userId: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  return jwt.sign({ userId, nonce }, process.env.JWT_SECRET!, { expiresIn: "10m" });
}

export function verifyOAuthState(state: string): { userId: string } | null {
  try {
    const payload = jwt.verify(state, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as {
      userId: string;
      nonce: string;
    };
    return { userId: payload.userId };
  } catch {
    return null; // منتهي الصلاحية، أو موقّع غلط، أو اتلاعب بيه
  }
}
