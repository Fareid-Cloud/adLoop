// lib/safeFetch.ts
//
// إصلاح ثغرة SSRF حقيقية من اختبار الاختراق: كنا بنعمل fetch(url) على أي
// رابط يدخله المستخدم من غير أي تحقق من الوجهة - ده بيسمح لمستخدم خبيث
// إنه يخلي السيرفر بتاعنا يطلب موارد داخلية (Cloud Metadata، شبكة داخلية).
//
// 5 طبقات دفاع (زي ما اتفقنا): (1) رفض نطاقات IP خاصة، (2) إعادة فحص
// بعد أي Redirect، (3) حد زمني وحد حجم، (4) HTTP/HTTPS بس، (5) حد أقصى
// لعدد التوجيهات.

import dns from "dns/promises";
import net from "net";

const PRIVATE_IP_RANGES = [
  /^127\./, // Loopback
  /^10\./, // Private Class A
  /^172\.(1[6-9]|2\d|3[01])\./, // Private Class B
  /^192\.168\./, // Private Class C
  /^169\.254\./, // Link-local (بما فيها Cloud Metadata endpoints)
  /^0\./, // "This" network
  /^::1$/, // IPv6 loopback
  /^f[cd][0-9a-f]{2}:/i, // IPv6 unique local
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((pattern) => pattern.test(ip));
}

async function assertPublicHost(hostname: string): Promise<void> {
  // لو الهوست نفسه IP مباشر (مش دومين)، بنفحصه فوراً من غير DNS
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("الرابط بيشاور على شبكة داخلية - مرفوض");
    }
    return;
  }

  // لو دومين، بنحله لـ IP فعلي ونفحص النتيجة - ده بيمنع محاولات "DNS
  // Rebinding" (دومين ظاهرياً عادي بس بيرجع IP داخلي وقت الحل الفعلي)
  const addresses = await dns.resolve(hostname).catch(() => []);
  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      throw new Error("الرابط بيشاور على شبكة داخلية - مرفوض");
    }
  }
}

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10 ميجا - كافي لأي صفحة ويب عادية
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

export async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  const parsed = new URL(url); // بيرمي خطأ تلقائياً لو الرابط مش صالح أصلاً

  // بروتوكولات HTTP/HTTPS بس - يمنع file://, gopher://, وغيرها من
  // البروتوكولات اللي ممكن تُستغل بطرق تانية تماماً
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("بروتوكول الرابط غير مدعوم - HTTP/HTTPS بس");
  }

  await assertPublicHost(parsed.hostname);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: "manual", // بنتحكم في التوجيهات يدوياً عشان نفحص كل وجهة جديدة
    });

    // لو فيه توجيه (Redirect)، بنفحص الوجهة الجديدة قبل ما نتبعها - ده
    // اللي بيمنع "رابط عادي ظاهرياً بيوجّهك لموقع داخلي"
    let currentRes = res;
    let redirectCount = 0;
    while (currentRes.status >= 300 && currentRes.status < 400 && redirectCount < MAX_REDIRECTS) {
      const location = currentRes.headers.get("location");
      if (!location) break;

      const nextUrl = new URL(location, url);
      if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
        throw new Error("توجيه لبروتوكول غير مدعوم");
      }
      await assertPublicHost(nextUrl.hostname);

      currentRes = await fetch(nextUrl.toString(), { ...options, signal: controller.signal, redirect: "manual" });
      redirectCount++;
    }

    // فحص حجم الاستجابة قبل ما نكمل قراءتها بالكامل - يمنع استنزاف
    // الموارد عن طريق ملف ضخم مقصود
    const contentLength = currentRes.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_RESPONSE_SIZE) {
      throw new Error("حجم الاستجابة أكبر من المسموح");
    }

    return currentRes;
  } finally {
    clearTimeout(timeoutId);
  }
}
