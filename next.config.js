/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");

const nextConfig = {
  reactStrictMode: true,
  // نستورد مكتبة الأيقونات كاملةً في القائمة الجانبية (لضمان وجود أي أيقونة
  // دون خريطة يدوية تنكسر). هذا الإعداد يجعل Next يحوّل ذلك تلقائياً إلى
  // استيرادات مفردة عند البناء، فلا تدخل المكتبة كلها في الحزمة النهائية.
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // 🔴 **البناء كان يسقط بنفاد الذاكرة في طور «تجميع بيانات الصفحات».**
    //
    // `experimental.cpus` افتراضها (عدد الأنوية − ١) = أحد عشر عاملاً على
    // جهاز باثني عشر نواة، و`NODE_OPTIONS` في `scripts/build-next.mjs`
    // ترفع سقف كومة V8 إلى ٦ جيجابايت - **وترثها العوامل كلها**. فيظنّ كلّ
    // عاملٍ أنّ له ستّة جيجابايت، ولا يضغط جامعُ المهملات إلّا عند حدٍّ لا
    // تبلغه الذاكرة الحقيقية أصلاً. النتيجة `JavaScript heap out of memory`.
    //
    // العدد يُقاس على ذاكرة الجهاز لا على أنويته: نحجز أربعة جيجابايت
    // للنظام وعملية البناء الأمّ، ونعطي كلّ عاملٍ جيجابايت ونصفاً. ولا
    // يتجاوز الناتجُ (الأنوية − ١) فيبقى السلوك كما هو على أجهزة واسعة
    // الذاكرة، وينخفض وحده حيث تضيق - وهو ما يحمي النشر أيضاً.
    // ولمن يبني على جهازٍ مشغول: `BUILD_CPUS=2 npm run build` تتجاوز القياس.
    cpus: (() => {
      const forced = Number(process.env.BUILD_CPUS);
      if (Number.isFinite(forced) && forced >= 1) return Math.floor(forced);
      const os = require("node:os");
      // **الذاكرة المتاحة لا الكلّية:** جهازٌ بستّة عشر جيجابايت مشغولٌ منها
      // اثنا عشر يسقط البناءُ عليه وإن بدت سعتُه كبيرة - وهو ما حدث فعلاً
      // (سبعة عوامل سقطت، واثنان نجحا). والمتاح هو ما يتنافس عليه العوامل.
      const freeGb = Math.max(0, os.freemem() / 1024 ** 3 - 1);
      const byMemory = Math.floor(freeGb / 1.5);
      const byCores = Math.max(1, os.cpus().length - 1);
      return Math.max(2, Math.min(byCores, byMemory));
    })(),
  },
  // Turbopack هو المُجمِّع الافتراضيّ من Next.js 16. والإعداد الفارغ مقصود:
  // وجودُ إعداد `webpack` بلا إعداد `turbopack` **يُفشِل البناء** في ١٦
  // (تحذيرٌ من أنّ تخصيصاً قد لا يكون مهاجَراً). ولا نحتاج تخصيصاً هنا:
  // الإعداد الوحيد الذي كان في `webpack` هو تعطيلُ كاش القرص محلياً حين
  // تضيق المساحة (`DISABLE_WEBPACK_CACHE`)، وTurbopack لا يكتب ذلك الكاش
  // الضخم أصلاً - فالحاجة إليه سقطت مع سببها.
  turbopack: {},
  // رؤوس أمان أساسية - حماية سريعة ومجانية ضد هجمات شائعة (Clickjacking،
  // تخمين نوع الملف، تسريب معلومات المتصفح) - مش بديل عن أمان الكود نفسه،
  // لكنها طبقة دفاع إضافية بسيطة ومطلوبة في أي منتج احترافي
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // يمنع تضمين الموقع جوه iframe في موقع تاني (Clickjacking)
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // إصلاح E من الاختبار العدائي: Vercel بتفرض HTTPS تلقائياً، بس
          // الهيدر ده بيقول للمتصفح "متحاولش HTTP خالص حتى لو المستخدم
          // كتب الرابط يدوي" - يمنع محاولات إنزال المستوى (Downgrade)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            // مسموح بس بمصادر بنستخدمها فعلياً - Turnstile (الكابتشا) وSentry
            // (مراقبة الأخطاء). أي سكريبت من مصدر تاني (زي لو حد حقن كود
            // خبيث عن طريق ثغرة تانية) هيتمنع من التنفيذ من الأساس
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "frame-src https://challenges.cloudflare.com",
              "connect-src 'self' https://*.sentry.io https://challenges.cloudflare.com",
              "font-src 'self' data:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

// إصلاح باگ حقيقي: البناء كان بيفشل بـ SIGKILL/Out-of-Memory على فيرسل.
// السبب المؤكد (بحث + حالة مشابهة موثّقة من مشروع Cal.com مفتوح المصدر):
// Sentry بتلف كل صفحة وAPI route وقت البناء (48 صفحة + 71 route = حمل
// كبير)، وده استهلاك ذاكرة معروف حتى لو Sentry نفسه مش مفعّل فعلياً
// (مفيش SENTRY_ORG/token حقيقي متظبط لسه). الحل: نتخطى اللف كله لو
// Sentry مش متظبط فعلياً (بندفع تكلفة ذاكرة كاملة مقابل صفر فايدة)،
// ولو اتظبط بعدين، نقلل حمله بإيقاف الأجزاء الأغلى (auto-instrument
// لكل route/middleware) اللي مش لازمة إلا لو فعلاً بنستخدم tracing.
const sentryOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: false,
  sourcemaps: { disable: true }, // كانت مفعّلة افتراضياً بدون توكن حقيقي - استهلاك ذاكرة مجاني بلا فايدة
  // الصيغة الصحيحة الحالية (autoInstrumentServerFunctions/Middleware
  // وdisableLogger على المستوى الأعلى قديمة، اتأكد ده باختبار حقيقي
  // للملف بنسخة Sentry المُثبَّتة فعلاً - v10.65.0)
  webpack: {
    autoInstrumentServerFunctions: false,
    autoInstrumentMiddleware: false,
    treeshake: { removeDebugLogging: true },
  },
};

module.exports = process.env.SENTRY_ORG
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;
