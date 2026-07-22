// lib/loginOAuthState.ts
//
// نفس مبدأ oauthState.ts (حماية CSRF بتوقيع JWT قصير العمر)، لكن من
// غير userId - في تسجيل الدخول بجوجل/فيسبوك، المستخدم أصلاً مش مسجّل
// دخول لسه، فمفيش userId نربط بيه الحالة.

import jwt from "jsonwebtoken";
import crypto from "crypto";

export function createLoginOAuthState(): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  return jwt.sign({ nonce, purpose: "login" }, process.env.JWT_SECRET!, { expiresIn: "10m" });
}

export function verifyLoginOAuthState(state: string): boolean {
  try {
    const payload = jwt.verify(state, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as {
      nonce: string;
      purpose: string;
    };
    return payload.purpose === "login";
  } catch {
    return false;
  }
}
