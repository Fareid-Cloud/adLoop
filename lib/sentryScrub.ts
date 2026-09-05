// lib/sentryScrub.ts
//
// **ما لا يخرج إلى Sentry.** أي حدثٍ يُرسَل إلى مزوّدٍ خارجيّ يحمل معه ما
// كان في الطلب لحظةَ الخطأ - وهذا منتجٌ يمرّ فيه هواتفُ عملاءِ العملاء
// وأكوادُ التحقّق وتوكناتُ الجلسات. الافتراض في نسخ Sentry الحديثة يرسل
// عنوانَ IP والكوكيز وترويسات الطلب ما لم يُمنَع صراحةً.
//
// 🔴 **والمنعُ صريحٌ من طبقتين، لأنّ إحداهما وحدها تكذب:**
//   ١) `sendDefaultPii: false` - يوقف الالتقاطَ التلقائيّ لـIP والكوكيز.
//   ٢) `beforeSend` - شبكةُ أمانٍ لما يتسرّب رغم ذلك: يمسح ترويسةَ
//      `authorization` والكوكيز، ويطمس البريدَ من نصّ الرسالة.
//
// طبقةٌ واحدة تكفي في الحالة العادية، لكنّ الإعداداتِ تتغيّر ونسخَ SDK
// تتغيّر - وتسريبُ PII إلى طرفٍ ثالثٍ لا يُلاحَظ حتى يُطلَب سجلٌّ في نزاع.

import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/** يُطبَّق على كل تهيئات Sentry (خادم، إيدج، عميل) من مكانٍ واحد. */
export const SCRUB_PII = false as const;

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function scrubEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  // الطلب: تُمسح الترويساتُ الحسّاسة والكوكيز كلُّها، ويُترك المسارُ
  // والطريقةُ - وهما ما يلزم للتشخيص بلا هويّة.
  if (event.request) {
    if (event.request.headers) {
      for (const k of Object.keys(event.request.headers)) {
        const low = k.toLowerCase();
        if (low === "authorization" || low === "cookie" || low === "x-csrf-token") {
          event.request.headers[k] = "[scrubbed]";
        }
      }
    }
    delete event.request.cookies;
    // عنوانُ IP: يُلتقط تلقائياً حين `sendDefaultPii` مضبوط، ونمسحه هنا
    // احتياطاً لو انقلب الإعداد.
    if (event.user) delete event.user.ip_address;
  }

  // البريدُ من نصّ الرسالة: رسائلُ الأخطاء أحياناً تُقحم عنواناً
  // («لم يُعثر على user@…»)، فيُطمَس أينما ظهر.
  if (event.message) event.message = event.message.replace(EMAIL_RE, "[email]");

  return event;
}
