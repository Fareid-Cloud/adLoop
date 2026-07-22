// lib/trackingCoverage.ts
//
// بيجاوب سؤال حقيقي محدش كان بيقدر يجاوبه: "التتبع فعلاً موجود على
// الصفحة دي ولا نسيت أضيفه؟" - بنجيب HTML الصفحة فعلياً ونفتش عن بصمة
// كود التتبع (docs/cta-tracking-snippet.html) جواه، مش نفترض إنه موجود.

export interface TrackingCheckResult {
  detected: boolean;
  error: string | null;
}

// نفس البصمة الموجودة في كود التتبع الحقيقي (docs/cta-tracking-snippet.html)
// - لو اتغيّر الكود هناك، لازم يتغيّر هنا كمان عشان الفحص يفضل دقيق
const TRACKING_SIGNATURES = ["trackCtaClick", "adloop_session_id"];

export async function checkTrackingPresence(url: string): Promise<TrackingCheckResult> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AdLoopTrackingMonitor/1.0" },
    });

    if (!res.ok) {
      return { detected: false, error: `الصفحة أعادت استجابة ${res.status}` };
    }

    const html = await res.text();
    const detected = TRACKING_SIGNATURES.some((sig) => html.includes(sig));

    return { detected, error: null };
  } catch (err) {
    return {
      detected: false,
      error: err instanceof Error ? err.message : "تعذّر الوصول للصفحة",
    };
  }
}
