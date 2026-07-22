// lib/mfa.ts
//
// التحقق بخطوتين (Time-based One-Time Password) - نفس الآلية المستخدمة
// في Google Authenticator وأي تطبيق مصادقة قياسي. اختياري، المستخدم
// يفعّله بنفسه من الإعدادات (مش إجباري - قرار موثّق في SECURITY.md).

import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { encryptToken, decryptToken } from "@/lib/encryption";

const ISSUER = "AdLoop";

export function generateMfaSecret(): string {
  return generateSecret();
}

export async function generateMfaQrCode(email: string, secret: string): Promise<string> {
  const otpauthUrl = generateURI({ issuer: ISSUER, label: email, secret });
  return QRCode.toDataURL(otpauthUrl);
}

export async function verifyMfaCode(secret: string, code: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code });
    return result.valid;
  } catch {
    return false;
  }
}

// السر بيتخزن مشفّر في قاعدة البيانات - نفس مستوى حماية توكنات OAuth،
// لأن أي حد يوصله السر ده يقدر يولّد أكواد صحيحة ويتجاوز MFA بالكامل
export function encryptMfaSecret(secret: string): string {
  return encryptToken(secret);
}

export function decryptMfaSecret(encrypted: string): string {
  return decryptToken(encrypted);
}
