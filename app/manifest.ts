// app/manifest.ts
//
// بيان تطبيق الويب — يجعل AdLoop قابلاً للتثبيت على الشاشة الرئيسية
// ويعمل كتطبيق مستقلّ بلا شريط متصفّح.
//
// **لماذا هنا لا في `public/manifest.json`:** اتّفاقية الملفّ في Next.js
// تُجمَّع **عند جذر `app/` فقط**، وتربط الوسم `<link rel="manifest">`
// تلقائياً بالتخطيط الجذري. الملفّ الساكن يحتاج ربطاً يدوياً يُنسى.
//
// هذا هو نفسه أساس تغليف APK لاحقاً (عبر TWA): الغلاف الأصلي يقرأ هذا
// البيان، فما يُضبط هنا يسري على النسخة المتجرية بلا عمل مكرَّر.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AdLoop — طبقة التحقّق لإعلاناتك",
    short_name: "AdLoop",
    description:
      "قارن ما تقوله منصّات الإعلانات بما حدث فعلاً: تحويلات متحقَّقة من محادثات حقيقية، لا أرقاماً مُعلَنة.",

    // `standalone` لا `fullscreen`: إخفاء شريط الحالة يخفي معه الساعة
    // ومؤشّر البطارية — وهذه أداة عمل تُفتح لدقائق، لا لعبة.
    display: "standalone",
    start_url: "/dashboard",
    scope: "/",
    id: "/",

    // مطابقة لخلفية الوضع الفاتح: لون مخالف يُنتج ومضة عند الإقلاع.
    background_color: "#F7F8FA",
    theme_color: "#4C8DFF",

    // الاتّجاه يتبع لغة المستخدم داخل التطبيق. القيمة هنا للحالة الأولى
    // قبل تسجيل الدخول فقط.
    dir: "rtl",
    lang: "ar",

    orientation: "portrait-primary",
    categories: ["business", "productivity", "finance"],

    icons: [
      // `any` للعرض كما هي (المتصفّح، قائمة التطبيقات)
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // `maskable` بهامش آمن: أندرويد يقصّ الأيقونة في أشكال مختلفة حسب
      // المشغّل، فبدون هذه النسخة يُقصّ الحرف نفسه.
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],

    // اختصارات الضغط المطوَّل على الأيقونة — الوجهات الثلاث التي يفتحها
    // المستخدم يومياً، فيصلها بنقرة واحدة بدل ثلاث.
    shortcuts: [
      {
        name: "القرارات المعلّقة",
        short_name: "القرارات",
        url: "/dashboard/actions",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "مركز الحقيقة",
        short_name: "الحقيقة",
        url: "/dashboard/truth",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "التشخيص",
        short_name: "التشخيص",
        url: "/dashboard/diagnostics",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
