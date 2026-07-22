// lib/appUrl.ts
//
// مصدر واحد لرابط الموقع الأساسي. لو APP_URL مش متظبط (نسيان شائع عند
// أول نشر)، بنرجع تلقائياً لرابط Vercel الإنتاجي بدل ما تطلع روابط
// "undefined/..." في إيميلات التحقق واستعادة كلمة المرور و redirect_uri.
export function getAppUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  // الدومين الإنتاجي الثابت (نفس الرابط دايماً - المناسب لروابط الإيميل)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  // رابط النشر الحالي (احتياطي)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
