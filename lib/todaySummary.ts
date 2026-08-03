// lib/todaySummary.ts
//
// **خلاصة اليوم: الطبقة الأولى في تسلسل الصفحة الرئيسية.**
//
// المشكلة التي تحلّها: كل بطاقة في الصفحة كانت بنفس الوزن البصري، فتلفّ
// العين بحثاً عن نقطة البداية ولا تجدها. الصفحة الآن تجيب عن ثلاثة أسئلة
// بالترتيب، وهذه الدالة تُنتج إجاباتها:
//
//   ١) هل الأداء اليوم جيّد أم سيّئ؟   → `verdict`
//   ٢) ما أكبر مشكلة أو فرصة الآن؟     → `lines`
//   ٣) ما الإجراء الذي أتّخذه؟          → `action`
//
// **صفر ذكاء اصطناعي.** قواعد ثابتة على أرقام موجودة أصلاً: لا تكلفة، ولا
// انتظار، ولا جملة مختلفة عند كل تحميل لنفس البيانات - وهو شرط أن يثق
// المستخدم بما يقرأ. الاسم «خلاصة» لا «رأي الذكاء الاصطناعي» عن قصد.

import { t, type Locale, platformLabel } from "@/lib/i18n/dictionary";

export type SummaryTone = "good" | "warn" | "bad";

export interface SummaryLine {
  tone: SummaryTone;
  text: string;
}

export interface TodaySummary {
  verdict: { tone: SummaryTone; headline: string; sub: string };
  lines: SummaryLine[];
  action: { text: string; href: string } | null;
}

export interface SummaryInput {
  locale: Locale;
  /** تكلفة العميل المتحقَّق في الفترة الحالية والسابقة */
  cpaNow: number;
  cpaPrev: number;
  trackingAccuracy: number;
  inflationPct: number;
  totalVerified: number;
  totalCost: number;
  currency: string;
  platforms: Array<{
    platform: string;
    verified: number;
    cost: number;
    cpa: number | null;
  }>;
  /** أعلى قرار معلّق - مصدر «الإجراء» حين يوجد */
  topPending: { id: string; title: string; severity: string } | null;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : 0);

export function buildTodaySummary(input: SummaryInput): TodaySummary {
  const { locale, currency } = input;
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `summary.${k}`, v);

  const lines: SummaryLine[] = [];

  // ---------- تكلفة العميل: المؤشّر الذي يدفع أو يوفّر مالاً مباشرةً ----------
  const cpaDelta = pct(input.cpaNow, input.cpaPrev);
  if (input.cpaPrev > 0 && input.cpaNow > 0 && Math.abs(cpaDelta) >= 3) {
    lines.push({
      tone: cpaDelta < 0 ? "good" : "bad",
      text: tr(cpaDelta < 0 ? "cpaDown" : "cpaUp", { pct: Math.abs(cpaDelta) }),
    });
  }

  // ---------- أقوى منصّة وأضعفها بتكلفة العميل الحقيقية ----------
  const withCpa = input.platforms.filter((p) => p.cpa !== null && p.verified > 0) as Array<
    SummaryInput["platforms"][number] & { cpa: number }
  >;
  if (withCpa.length >= 1) {
    const best = [...withCpa].sort((a, b) => a.cpa - b.cpa)[0];
    const share = input.totalVerified > 0 ? Math.round((best.verified / input.totalVerified) * 100) : 0;
    if (share > 0) {
      lines.push({
        tone: "good",
        text: tr("bestPlatform", { platform: platformLabel(locale, best.platform), pct: share }),
      });
    }
  }

  // إهدار صريح: صرف حقيقي بصفر تحقّق - أوضح إشارة في المنتج كلّه
  const wasted = input.platforms.filter((p) => p.cost > 0 && p.verified === 0);
  for (const w of wasted.slice(0, 1)) {
    lines.push({
      tone: "bad",
      text: tr("zeroVerified", {
        platform: platformLabel(locale, w.platform),
        cost: Math.round(w.cost).toLocaleString("en-US"),
        currency,
      }),
    });
  }

  // ---------- دقّة التتبّع: أساس ثقة كل رقم أعلاه ----------
  if (input.trackingAccuracy > 0) {
    lines.push({
      tone: input.trackingAccuracy >= 70 ? "good" : input.trackingAccuracy >= 40 ? "warn" : "bad",
      text: tr("trackingLine", { pct: input.trackingAccuracy }),
    });
  }

  // ---------- الحكم: سؤال «هل اليوم جيّد أم سيّئ؟» ----------
  const bad = lines.filter((l) => l.tone === "bad").length;
  const good = lines.filter((l) => l.tone === "good").length;
  const tone: SummaryTone = bad > good ? "bad" : bad > 0 ? "warn" : "good";

  const verdict = {
    tone,
    headline: tr(tone === "good" ? "verdictGood" : tone === "warn" ? "verdictMixed" : "verdictBad"),
    sub:
      input.inflationPct > 0
        ? tr("verdictSub", { pct: input.inflationPct })
        : tr("verdictSubNoGap"),
  };

  // ---------- الإجراء: قرار معلّق حقيقي، وإلا فلا شيء ----------
  //
  // اقتراح إجراء بلا سند في البيانات أسوأ من غيابه: المستخدم ينفّذه مرّة،
  // لا يرى أثراً، فيتوقّف عن قراءة البطاقة كلّها.
  const action = input.topPending
    ? { text: input.topPending.title, href: "/dashboard/actions" }
    : null;

  return { verdict, lines: lines.slice(0, 4), action };
}
