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

// فحصٌ رقميّ للنطاقات لا بالـregex وحده: `172.16/12` و`100.64/10` وأمثالُها
// لا تُلتقَط بنمطٍ نصّيّ بسيط، والعنوان المُعاد من الحلّ قد يأتي مُعيَّناً
// IPv4 داخل IPv6 (`::ffff:127.0.0.1`) فلا يطابق أيّ نمط IPv4.
function isPrivateIp(ip: string): boolean {
  let addr = ip.trim();
  // IPv4 مُعيَّن داخل IPv6 → يُعامَل كعنوان IPv4 الأصليّ
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) addr = mapped[1];

  const version = net.isIP(addr);
  if (version === 4) {
    const o = addr.split(".").map(Number);
    if (o.length !== 4 || o.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // مشوَّه → رفض
    const [a, b, c] = o;
    if (a === 127 || a === 10 || a === 0) return true;              // loopback / خاص A / "this"
    if (a === 172 && b >= 16 && b <= 31) return true;               // خاص B
    if (a === 192 && b === 168) return true;                        // خاص C
    if (a === 169 && b === 254) return true;                        // link-local + Cloud Metadata
    if (a === 100 && b >= 64 && b <= 127) return true;              // CGNAT 100.64/10
    if (a === 192 && b === 0 && c === 0) return true;               // 192.0.0.0/24
    if (a === 198 && (b === 18 || b === 19)) return true;           // 198.18.0.0/15 (benchmarking)
    return false;
  }
  if (version === 6) {
    const low = addr.toLowerCase();
    if (low === "::1") return true;                                 // loopback
    if (/^f[cd][0-9a-f]{2}:/.test(low)) return true;                // ULA fc00::/7
    if (/^fe80:/.test(low)) return true;                            // link-local
    return false;
  }
  return true; // ليس IP صالحاً بعد الحلّ → رفض
}

async function assertPublicHost(hostname: string): Promise<void> {
  // `URL.hostname` يبقي أقواس IPv6 (`[::1]`)، و`net.isIP("[::1]")` يرجع 0
  // فيُعامَل كاسم نطاق ويفلت. نُزيلها قبل الفحص.
  const host = hostname.replace(/^\[|\]$/g, "");

  // IP مباشر: يُفحَص فوراً بلا DNS.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("الرابط بيشاور على شبكة داخلية - مرفوض");
    return;
  }

  // `dns.lookup` يستعمل نفس مُحلِّل نظام التشغيل (`getaddrinfo`) الذي
  // سيستعمله `fetch`، فيغطّي A و AAAA معاً والأشكال الرقمية/الثمانية
  // (`2130706433`, `0177.0.0.1`) التي كان `dns.resolve` (A فقط) يفوّتها.
  // 🔴 والفشل هنا **رفضٌ لا سماح**: الشكل القديم كان `.catch(() => [])`،
  // فأيّ اسمٍ يعجز الحلّ عنه يمرّ - فتحُ الباب على مصراعيه.
  let addresses: Array<{ address: string }>;
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("تعذّر حلّ اسم المضيف - مرفوض");
  }
  if (addresses.length === 0) throw new Error("لا عنوان للمضيف - مرفوض");
  for (const { address } of addresses) {
    if (isPrivateIp(address)) throw new Error("الرابط بيشاور على شبكة داخلية - مرفوض");
  }
  // قيدٌ متبقٍّ موثَّق: `fetch` يعيد الحلّ باستقلالٍ، فنافذةُ TOCTOU
  // (rebinding بـTTL صفر بين الفحص والجلب) تضيق باستعمال نفس المُحلِّل
  // لكنّها لا تُغلَق تماماً دون dispatcher مخصَّص يثبّت العنوان المتحقَّق.
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
