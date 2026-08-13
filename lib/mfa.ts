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


// ==================== أكواد الاسترجاع ====================
//
// 🔴 **من فقد هاتفه كان يُقفَل خارج حسابه إلى الأبد.** التحقّق بخطوتين
// مبنيٌّ وشغّال، ولا مسارَ في المنتج يعيد من فقد جهازه - يعرف بريده وكلمة
// مروره ولا يملك الكود. وهذه ليست حالةً نادرة: الهواتف تُفقَد وتُستبدَل.
//
// **وأضعفُ بابٍ هو ما يحدّد أمان الحساب لا أقواه** - فالاسترجاع يُبنى
// بالحذر نفسه: مجزّأٌ في التخزين، ولمرّةٍ واحدة، ومحدودُ المحاولات.

import bcrypt from "bcryptjs";

/** عشرة أكواد: تكفي سنواتٍ من الاستبدال، ولا تُثقل ورقةً تُحفَظ. */
const BACKUP_CODE_COUNT = 10;

/** حروفٌ بلا `0/O` و`1/I/l`: الكود يُنسَخ يدوياً من ورقة، والخلطُ بينها
 *  يُنتج فشلاً يظنّه المستخدم عطلاً في المنتج. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** كودٌ من عشرة محارف في مجموعتين - أسهل في القراءة والنسخ من كتلةٍ واحدة.
 *  `crypto` لا `Math.random`: الثانية متوقَّعةٌ ولا تصلح لسرّ. */
function generateOne(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

/** يولّد الأكواد ويعيد **النصّ الصريح والمجزّأ معاً**: الصريح يُعرَض مرّةً
 *  واحدةً للمستخدم ثمّ يُنسى، والمجزّأ وحده يُخزَّن. */
export async function generateBackupCodes(): Promise<{ plain: string[]; hashes: string[] }> {
  const plain = Array.from({ length: BACKUP_CODE_COUNT }, generateOne);
  // كلفةُ ١٠ أقلّ من كلمات المرور (١٢): الكود عشوائيٌّ بالكامل من ٣١ محرفاً
  // فمقاومتُه للتخمين من طوله لا من بطء التجزئة، وعشرةُ تجزئاتٍ دفعةً
  // واحدة بكلفة ١٢ تُبطئ الطلب بلا مقابل.
  const hashes = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));
  return { plain, hashes };
}

/** يطابق كوداً مُدخَلاً بأحد المخزَّنة غير المستعملة، ويعيد معرّفه ليُحرَق.
 *  `null` إن لم يطابق شيئاً. */
export async function matchBackupCode(
  input: string,
  stored: Array<{ id: string; codeHash: string }>,
): Promise<string | null> {
  // التطبيع قبل المطابقة: المستخدم ينسخ من ورقة، فقد يكتبها صغيرةً أو
  // يُسقط الشرطة. وهذا لا يُضعف السرّ - الأبجدية كبيرةٌ أصلاً.
  const normalized = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length !== 10) return null;
  const formatted = `${normalized.slice(0, 5)}-${normalized.slice(5)}`;

  for (const row of stored) {
    if (await bcrypt.compare(formatted, row.codeHash)) return row.id;
  }
  return null;
}


// ==================== الأجهزة الموثوقة ====================

/** ثلاثون يوماً: طويلةٌ بما يكفي لتنتهي المضايقة، قصيرةٌ بما يكفي لتنتهي
 *  الثقة بجهازٍ بِيع أو فُقد دون أن يتذكّر صاحبه إلغاءه. */
export const TRUSTED_DEVICE_DAYS = 30;

export const TRUSTED_DEVICE_COOKIE = "adloop_td";

/** رمزٌ عشوائيٌّ للجهاز: يُخزَّن مجزّأً عندنا ونصّاً في كوكي المتصفّح. */
export function generateDeviceToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** تجزئةٌ سريعة (SHA-256) لا bcrypt: الرمز ٢٥٦ بت عشوائيّةً بالكامل، فلا
 *  يُخمَّن بالقوة الغاشمة مهما بلغت سرعة التجزئة - وbcrypt هنا كلفةٌ على
 *  كلّ تسجيل دخولٍ بلا مقابل. (bcrypt ضروريٌّ لكلمات المرور لأنّها
 *  قصيرةٌ ويختارها بشر.) */
export async function hashDeviceToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** وصفٌ مختصرٌ للجهاز من ترويسة المتصفّح - **للعرض وحده**، كي يعرف
 *  المستخدم أيَّ جهازٍ يُلغي. لا يُستعمل في التحقّق: الترويسة يكتبها
 *  العميل فلا يُوثَق بها. */
export function describeDevice(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const browser =
    /Edg\//.test(userAgent) ? "Edge"
    : /OPR\//.test(userAgent) ? "Opera"
    : /Chrome\//.test(userAgent) ? "Chrome"
    : /Safari\//.test(userAgent) ? "Safari"
    : /Firefox\//.test(userAgent) ? "Firefox"
    : null;
  const os =
    /Windows/.test(userAgent) ? "Windows"
    : /Android/.test(userAgent) ? "Android"
    : /iPhone|iPad/.test(userAgent) ? "iOS"
    : /Mac OS X/.test(userAgent) ? "macOS"
    : /Linux/.test(userAgent) ? "Linux"
    : null;
  if (!browser && !os) return null;
  return [browser, os].filter(Boolean).join(" · ");
}
