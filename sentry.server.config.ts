// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // 100% في التطوير عشان نشوف كل حاجة، 10% في الإنتاج عشان نفضل جوه
  // الحد المجاني (5000 خطأ شهرياً) حتى لو الاستخدام زاد
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // مفيش DSN؟ الـ SDK بيتعطل تلقائي من غير ما يكسر أي حاجة - مفيد وقت
  // التطوير المحلي قبل ما تعمل حساب Sentry
});
