// instrumentation.ts
//
// بيتشغل مرة واحدة بس، لحظة ما السيرفر يبدأ (قبل ما يستقبل أي طلب).
// هنا بنسجل إعدادات Sentry حسب البيئة (Node أو Edge)، وبنتأكد إن كل
// المتغيرات السرية الأساسية موجودة - عشان لو حاجة ناقصة نعرف فوراً
// وقت التشغيل، مش لما مستخدم حقيقي يقع في خطأ غامض.

export async function register() {
  const { validateEnvOrThrow } = await import("./lib/envCheck");
  validateEnvOrThrow();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
