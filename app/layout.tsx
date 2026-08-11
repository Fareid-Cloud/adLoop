// app/layout.tsx
//
// 🔴 كان ده الملف الناقص اللي بيمنع البناء بالكامل - Next.js App Router
// بيتطلب root layout بـ<html>/<body> إجبارياً. اكتُشف بمراجعة شاملة عن
// طريق تشغيل `next build` فعلي (مش tsc بس). كل الجلسة دي كانت شغالة
// على فحص type-level نضيف، بس التطبيق مكانش هيتبني فعلياً.
//
// أيضاً بيحل فجوة مكتشفة: صفحات برّه الداشبورد ماكانتش بتحمّل خط
// Almarai خالص - next/font كان مستورد جوه dashboard/layout.tsx بس.

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { getSessionUserFromCookies } from "@/lib/auth";
import { PwaSetup } from "@/app/components/PwaSetup";
import "./dashboard/theme.css";

// 🔴 **خطّان لا خطٌّ واحد - والسبب أنّ لكلّ كتابة ما صُمّم لها.**
//
// كان `IBM_Plex_Sans_Arabic` يخدم العربية واللاتينية معاً. عربيّته ممتازة،
// أمّا لاتينيّته فهي IBM Plex Sans: قامةٌ صغيرة (x-height منخفض) وأشكال
// حروفٍ ذات طابع، صُمّمت للنصّ المطبوع لا لواجهةٍ حجم نصّها ١٢-١٣ بكسل.
// وعند هذا الحجم تفقد الحروف حدّتها فتُقرأ «مبكسلة» - وهو وصف المالك.
//
// **Inter** مصمَّم لهذا الحجم بالذات: قامةٌ عالية، فتحاتٌ واسعة، وتلميحٌ
// (hinting) مضبوط على شبكة البكسل. وهو خطّ واجهات SaaS القياسيّ لهذا السبب
// لا لموضة.
//
// **الترتيب هو الآلية:** Inter أوّلاً وليس فيه حرفٌ عربيّ واحد، فالمتصفّح
// يسقط تلقائياً إلى Plex العربيّ عند أوّل حرفٍ عربيّ. لا فرعَ في الكود ولا
// `dir` يُفحَص: الخطّ يتبع الحرف نفسه.
const latin = Inter({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AdLoop",
  description:
    "قارن ما تقوله منصّات الإعلانات بما حدث فعلاً: تحويلات متحقَّقة من محادثات حقيقية، لا أرقاماً مُعلَنة.",

  // ── التثبيت على الشاشة الرئيسية ──────────────────────────────────
  // آبل تتجاهل `manifest.json` كلّياً وتقرأ هذه الوسوم وحدها. بدونها
  // يُثبَّت الموقع على iPhone كاختصار متصفّح بشريط عنوان ظاهر - لا
  // كتطبيق. أندرويد يقرأ البيان، فالطرفان يحتاجان الاثنين معاً.
  appleWebApp: {
    capable: true,
    title: "AdLoop",
    // `default` لا `black-translucent`: الأخيرة تمدّ المحتوى تحت شريط
    // الحالة فيختفي أوّل صفّ من الواجهة خلف الساعة والبطارية.
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // منع التحويل التلقائي للأرقام إلى روابط اتّصال على iOS: كان يلوّن
  // كلّ رقم في اللوحة بالأزرق ويجعله قابلاً للنقر بلا معنى.
  formatDetection: { telephone: false },
  // Next.js تصدر الاسم القياسي الحديث `mobile-web-app-capable` وحده.
  // إصدارات iOS الأقدم تقرأ الاسم القديم فقط، ومن دونه يُثبَّت الموقع
  // عندها كاختصار متصفّح بشريط عنوان ظاهر لا كتطبيق. إضافته لا تكلّف
  // شيئاً وتغطّي الإصدارين.
  other: { "apple-mobile-web-app-capable": "yes" },
};

/**
 * `viewport` منفصلة عن `metadata` في Next.js 15.
 *
 * `viewportFit: "cover"` مع حشوة المنطقة الآمنة: بدونها يختفي المحتوى
 * خلف نتوء الشاشة وشريط الإيماءات في هواتف iPhone الحديثة.
 */
export const viewport: Viewport = {
  themeColor: "#4C8DFF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // التكبير مسموح عمداً: منعه يمنع ضعاف البصر من قراءة الأرقام الصغيرة،
  // وهي أداة مليئة بالأرقام.
  maximumScale: 5,
};

/**
 * تفضيلات المستخدم تُطبَّق على `<html>` نفسه.
 *
 * **ما كان معطّلاً:** هذه القيم الأربع كانت مثبّتة هنا (`ar`/`rtl`/`light`/
 * `blue`)، والداشبورد يعيد ضبط اثنتين منها على `<div>` داخليّ. النتيجة أنّ
 * اللغة والاتجاه **لا يتغيّران أبداً** مهما بدّل المستخدم — لأنّ `dir` و
 * `lang` لا معنى لهما إلّا على الجذر، وأيّ صفحة خارج الداشبورد (الدخول،
 * الإعداد، التقرير المشترك) كانت تبقى على الأزرق الفاتح دوماً.
 *
 * موضعها الصحيح هنا: عنصر واحد يحكم الوثيقة كلّها، فيسري التفضيل على كلّ
 * صفحة بلا استثناء.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  // فشل القراءة لا يجوز أن يُسقط كلّ صفحة في التطبيق - الزائر غير المسجَّل
  // حالة عادية لا خطأ، فنقع على الافتراضي بهدوء.
  const user = await getSessionUserFromCookies().catch(() => null);
  const locale = user?.preferredLocale === "en" ? "en" : "ar";

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-mode={user?.themeMode ?? "light"}
      data-accent={user?.themeColor ?? "blue"}
    >
      <body className={`${latin.variable} ${arabic.variable} font-display antialiased`}>
        {children}
        {/* في الجذر لا داخل الداشبورد: تسجيل الـSW شرط التثبيت، ويجب أن
            يحدث حتى لمن يفتح صفحة الدخول أوّل مرّة. */}
        <PwaSetup locale={locale} />
      </body>
    </html>
  );
}
