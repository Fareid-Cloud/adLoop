// lib/trackingErrorText.ts
//
// نصُّ سبب تعذّر فحص الصفحة، بلغة القارئ.
//
// **ملفٌّ مستقلٌّ بلا أيّ استيرادٍ خادميّ عمداً:** يُنادى من مكوّن متصفّح
// (`TrackingCoverageClient`) ومن الخادم معاً، و`lib/trackingCoverage.ts`
// يجرّ `safeFetch` و`pageAudit` - واستيراده في كلاينت كومبوننت يكسر البناء.

import { t } from "./i18n/dictionary";

/**
 * 🔴 **رمزٌ يُترجَم، لا نصُّ خطأٍ خام.**
 *
 * كان سببُ الفشل يُخزَّن ويُعرَض كما ورد من طبقة الشبكة
 * (`getaddrinfo ENOTFOUND`، أخطاء شهادات TLS) أو بعربيةٍ مثبَّتة - فيقرأ
 * المشترك تفصيلاً تشغيلياً لا يدلّه على فعل، وقد يصله بلغةٍ لا يقرؤها.
 *
 * والرمز المجهول - صفٌّ خُزِّن قبل هذا التحويل بنصٍّ حرّ - يُعاد `null`
 * فلا يُعرَض خاماً؛ وهو الغرض من التحويل أصلاً.
 */
export function trackingErrorText(code: string | null, locale: "ar" | "en"): string | null {
  if (!code) return null;
  if (code === "timeout") return t(locale, "trackErr.timeout");
  if (code === "unreachable") return t(locale, "trackErr.unreachable");
  const http = code.match(/^http:(\d{3})$/);
  if (http) return t(locale, "trackErr.http", { status: http[1] });
  return null;
}
