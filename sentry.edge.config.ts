// sentry.edge.config.ts
import * as Sentry from "@sentry/nextjs";
import { scrubEvent, SCRUB_PII } from "@/lib/sentryScrub";

Sentry.init({
  // 🔴 لا نُرسل PII افتراضياً، و`beforeSend` شبكةُ أمانٍ فوقه — التفصيل في lib/sentryScrub.ts
  sendDefaultPii: SCRUB_PII,
  beforeSend: scrubEvent,
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
