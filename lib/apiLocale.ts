// lib/apiLocale.ts
//
// لغة رسالة الخطأ في مسار الواجهة البرمجية.
//
// **العلّة:** ثمانٍ وستّون رسالة خطأ كانت مكتوبةً بالعربية في مسارات API،
// و`NextResponse.json({ error })` تصل إلى الواجهة كما هي - فيراها مستخدم
// الواجهة الإنجليزية عربيّةً وسط شاشةٍ إنجليزية بالكامل. وهي أخطاء تظهر
// في أسوأ لحظة: حين يتعثّر شيء.
//
// وفحص تسريب العربية لم يكن يمسكها لأنّه يقرأ JSX، ورسالةٌ تُبنى في كائن
// JavaScript ليست JSX. أُضيف له فحصٌ ثانٍ لهذه الحالة تحديداً.
//
// **مصدر اللغة يختلف باختلاف الموضع:**
//   • مسارٌ خلف تسجيل الدخول: تفضيل المستخدم المحفوظ، وهو الأصدق.
//   • مسارٌ قبله (تسجيل الدخول، إعادة تعيين كلمة المرور، تأكيد البريد):
//     لا مستخدم بعد، فتُقرأ `Accept-Language` من المتصفّح. أضعف من
//     التفضيل المحفوظ، وأصدق بكثير من افتراض العربية للجميع.

import type { NextRequest } from "next/server";
import { detectLocale, type Locale } from "@/lib/i18n/dictionary";

/** لغة مستخدمٍ معروف - `preferredLocale` قد يحمل قيمةً قديمة، فيُضبط بالنوع */
export function localeOf(user: { preferredLocale?: string | null } | null | undefined): Locale {
  return user?.preferredLocale === "en" ? "en" : "ar";
}

/** لغة طلبٍ بلا جلسة - من ترويسة المتصفّح وحدها */
export function localeOfRequest(req: NextRequest): Locale {
  return detectLocale(req.headers.get("accept-language"));
}
