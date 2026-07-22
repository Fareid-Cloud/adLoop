// lib/envCheck.ts
//
// بيتأكد إن المتغيرات السرية الأساسية موجودة وقت تشغيل السيرفر، مش وقت
// أول مستخدم يحاول يسجل دخول. بدون الملف ده، لو حد نسي يضبط JWT_SECRET
// مثلاً، أول خطأ هيظهره هيبقى غامض جوه محاولة تسجيل دخول مستخدم حقيقي.

const REQUIRED_ENV_VARS = ["DATABASE_URL", "JWT_SECRET"] as const;

// متغيرات مطلوبة بس لو الميزة المرتبطة بيها مستخدمة فعلاً - بنحذّر بس
// مننعش التشغيل، لأن مش كل Workspace هيستخدم كل تكامل من أول يوم
const OPTIONAL_BUT_RECOMMENDED_ENV_VARS = [
  "ANTHROPIC_API_KEY",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "SALLA_WEBHOOK_SECRET",
] as const;

export function validateEnvOrThrow() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `متغيرات بيئة أساسية ناقصة: ${missing.join(", ")}. ` +
        `راجع ملف .env.local وتأكد إنها كلها متضبطة قبل تشغيل السيرفر.`
    );
  }

  const missingRecommended = OPTIONAL_BUT_RECOMMENDED_ENV_VARS.filter(
    (key) => !process.env[key]
  );
  if (missingRecommended.length > 0) {
    console.warn(
      `تنبيه: المتغيرات دي مش متضبطة، وبعض الميزات مش هتشتغل: ${missingRecommended.join(", ")}`
    );
  }
}
