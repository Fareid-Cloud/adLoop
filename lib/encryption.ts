// lib/encryption.ts
//
// إصلاح أمني حرج: توكنات جوجل/ميتا (وصول مباشر لحسابات إعلانات العملاء
// الحقيقية) كانت متخزنة بدون تشفير خالص. لو قاعدة البيانات اتسربت لأي
// سبب، أي حد يقدر ياخد وصول كامل من غير ما يحتاج باسوورد حتى.
//
// AES-256-GCM: تشفير متماثل قوي، ومفتاحه في متغير بيئة منفصل تماماً عن
// قاعدة البيانات - حتى لو قاعدة البيانات اتسربت، التوكنات تفضل غير
// قابلة للقراءة من غيره.

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY غير مضبوط - لازم تولّد مفتاح قبل تشغيل أي كود بيتعامل مع توكنات OAuth"
    );
  }
  // المفتاح لازم يكون 32 بايت بالظبط لـ AES-256 - بنحوّل النص المُخزّن
  // (hex) لـ Buffer بالحجم الصح
  return Buffer.from(key, "hex");
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // IV عشوائي لكل عملية تشفير - أساسي لأمان GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // بنخزن IV + authTag + النص المشفّر مع بعض (مفصولين بـ ":")، عشان
  // نقدر نفك التشفير لاحقاً - كل جزء لازم يكون متاح وقت فك التشفير
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(encryptedData: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encryptedHex] = encryptedData.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("صيغة التوكن المشفّر غير صحيحة");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
