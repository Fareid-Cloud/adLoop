// app/dashboard/ecommerce/ai-insights/page.tsx
//
// أسئلة محدَّدة بإجابات محسوبة، لا محادثة مفتوحة.
//
// السبب في رفض نمط الدردشة هنا: صاحب المتجر لا يعرف ما يسأل عنه غالباً،
// والسؤال المفتوح يُنتج تلخيصاً للبيانات لا قراراً. أربعة أسئلة ثابتة
// تغطّي ما يحتاجه فعلاً كل صباح، وكل إجابة مبنيّة على الأرقام نفسها التي
// تراها في بقية الصفحات - لا رأي منفصل يناقضها.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  EcomHeader, SectionHeading, DataGate, fmtNum,
} from "../_components/EcomPrimitives";
import { getProfitJourney, getStoreOverview } from "@/lib/ecommerce/storeIntelligence";
import { getEcommerceOverview } from "@/lib/ecommerce/productPerformance";
import { buildOpportunities } from "@/lib/ecommerce/opportunities";
import { HelpCircle, ArrowLeft } from "lucide-react";
import { tText, type Locale } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

interface Answer {
  question: string;
  answer: string;
  evidence: string[];
  href?: string;
  hrefLabel?: string;
  tone: "critical" | "warning" | "positive" | "neutral";
}

export default async function AiInsightsPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tx = (item: { key: string; vars?: Record<string, string | number> }) => tText(locale, "oppText", item);
  if (!user) {
    return <div className="py-20 text-center text-text-muted">انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) {
    return <DataGate titleAr="لا توجد مساحة عمل بعد" reasonAr="ارجع إلى «لمحة»." href="/dashboard" hrefLabelAr="إلى لمحة" />;
  }

  const [journey, prevJourney, overview, products, opps] = await Promise.all([
    getProfitJourney(workspace.id, 30),
    getProfitJourney(workspace.id, 60),
    getStoreOverview(workspace.id, 30),
    getEcommerceOverview(workspace.id, 30),
    buildOpportunities(workspace.id, 30),
  ]);

  const c = journey.currency;

  if (journey.revenue <= 0 && products.products.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <EcomHeader
          title="تحليلات ذكية"
          subtitle="أسئلة محدَّدة بإجابات محسوبة من أرقامك."
          storeName={workspace.name}
        />
        <DataGate
          titleAr="لا توجد بيانات كافية للإجابة بعد"
          reasonAr="الإجابات هنا محسوبة من مبيعاتك وتكاليفك الحقيقية. اربط متجرك وأضف منتجاتك ليبدأ التحليل."
        />
      </div>
    );
  }

  const answers: Answer[] = [];

  // ==== ١) لماذا انخفض الربح؟ ====
  const prevPeriodProfit = prevJourney.netProfit - journey.netProfit;
  const profitDelta = journey.netProfit - prevPeriodProfit;

  if (prevPeriodProfit !== 0 && profitDelta < 0) {
    // نجد أي بند تكلفة نما أكثر من غيره - السبب لا العَرَض
    const changes = journey.stages
      .filter((s) => s.key !== "revenue")
      .map((s) => {
        const prev = prevJourney.stages.find((x) => x.key === s.key);
        const prevAmount = prev ? Math.abs(prev.amount) - Math.abs(s.amount) : 0;
        const growth = prevAmount > 0 ? ((Math.abs(s.amount) - prevAmount) / prevAmount) * 100 : 0;
        return { label: s.labelAr, growth, amount: Math.abs(s.amount) };
      })
      .filter((x) => x.growth > 0)
      .sort((a, b) => b.growth - a.growth);

    const culprit = changes[0];
    answers.push({
      question: "لماذا انخفض الربح؟",
      answer: culprit
        ? `صافي ربحك تراجع ${fmtNum(Math.abs(profitDelta))} ${c} عن الفترة السابقة. أكبر بند نما هو «${culprit.label}» بنسبة ${Math.round(culprit.growth)}%.`
        : `صافي ربحك تراجع ${fmtNum(Math.abs(profitDelta))} ${c}، والسبب انخفاض الإيراد لا ارتفاع التكاليف.`,
      evidence: [
        `صافي الربح الآن: ${fmtNum(journey.netProfit)} ${c}`,
        `الفترة السابقة: ${fmtNum(prevPeriodProfit)} ${c}`,
        ...(culprit ? [`«${culprit.label}» يستهلك الآن ${fmtNum(culprit.amount)} ${c}`] : []),
      ],
      href: "/dashboard/ecommerce/profit",
      hrefLabel: "افتح رحلة الربح",
      tone: "critical",
    });
  } else if (prevPeriodProfit !== 0) {
    answers.push({
      question: "كيف يتحرّك ربحي؟",
      answer: `صافي ربحك ارتفع ${fmtNum(profitDelta)} ${c} عن الفترة السابقة. الاتجاه إيجابي.`,
      evidence: [
        `الآن: ${fmtNum(journey.netProfit)} ${c}`,
        `السابق: ${fmtNum(prevPeriodProfit)} ${c}`,
        `الهامش الصافي: ${journey.netMarginPct}%`,
      ],
      tone: "positive",
    });
  }

  // ==== ٢) أي منتج يجب أن أوسّعه؟ ====
  const scalable = products.products
    .filter((p) => p.verdict === "WINNER" && p.confidence === "RELIABLE")
    .sort((a, b) => b.totalProfit - a.totalProfit);

  answers.push({
    question: "أي منتج يجب أن أوسّعه؟",
    answer: scalable.length
      ? `«${scalable[0].name}» — ربح ${fmtNum(scalable[0].totalProfit)} ${c} بهامش ${scalable[0].marginPct}% ومعدّل إرجاع ${scalable[0].returnRatePct}% عبر ${scalable[0].unitsSold} وحدة. أداء مُثبَت لا صدفة.`
      : "لا يوجد منتج استوفى شروط التوسيع بعد: يلزم ربح موجب مع عيّنة كافية ومعدّل إرجاع منخفض. التوسيع بعيّنة صغيرة مضاعفة للمخاطرة لا للربح.",
    evidence: scalable.slice(0, 3).map(
      (p) => `${p.name}: ربح ${fmtNum(p.totalProfit)} ${c} • هامش ${p.marginPct}% • ${p.unitsSold} وحدة`
    ),
    href: scalable.length ? "/dashboard/campaigns/creatives" : "/dashboard/ecommerce/products",
    hrefLabel: scalable.length ? "زِد ميزانيته" : "راجع منتجاتك",
    tone: scalable.length ? "positive" : "neutral",
  });

  // ==== ٣) أي منتج يخسر مالاً؟ ====
  const losers = products.products
    .filter((p) => p.profitPerUnit < 0 && p.unitsSold > 0)
    .sort((a, b) => a.profitPerUnit * a.unitsSold - b.profitPerUnit * b.unitsSold);

  answers.push({
    question: "أي منتج يخسر مالاً؟",
    answer: losers.length
      ? `${losers.length} منتج يبيع تحت التعادل. أكبرها «${losers[0].name}»: يخسر ${fmtNum(Math.abs(losers[0].profitPerUnit))} ${c} في كل وحدة، وباع ${losers[0].unitsSold} وحدة — أي ${fmtNum(Math.abs(losers[0].profitPerUnit) * losers[0].unitsSold)} ${c} نزيفاً.`
      : "لا يوجد منتج يبيع تحت التعادل. كل منتجاتك تحقّق ربحاً موجباً بعد التكاليف الكاملة.",
    evidence: losers
      .slice(0, 3)
      .map((p) => `${p.name}: −${fmtNum(Math.abs(p.profitPerUnit))} ${c} للوحدة × ${p.unitsSold} وحدة`),
    href: losers.length ? "/dashboard/ecommerce/pricing-intelligence" : undefined,
    hrefLabel: "صحّح التسعير",
    tone: losers.length ? "critical" : "positive",
  });

  // ==== ٤) ماذا أفعل اليوم؟ ====
  const top = opps.opportunities[0];
  answers.push({
    question: "ماذا يجب أن أغيّر اليوم؟",
    answer: top
      ? `${tx(top.title)}. ${tx(top.action)}`
      : "لا يوجد إجراء عاجل اليوم. أرقامك ضمن المعقول، وأفضل استثمار لوقتك الآن هو توسيع ما يعمل لا إصلاح ما لا يعمل.",
    evidence: top
      ? [
          `الأثر المقدَّر: ${fmtNum(top.estimatedMonthlyProfit)} ${c} شهرياً`,
          tx(top.confidenceReason),
          ...opps.opportunities.slice(1, 3).map((o) => `${tx(o.title)}: +${fmtNum(o.estimatedMonthlyProfit)} ${c}`),
        ]
      : [],
    href: "/dashboard/ecommerce/opportunities",
    hrefLabel: "كل الفرص",
    tone: top ? "warning" : "positive",
  });

  const TONE = {
    critical: "border-critical/30 bg-critical/[0.05]",
    warning: "border-gap/30 bg-gap/[0.05]",
    positive: "border-verified/30 bg-verified/[0.05]",
    neutral: "border-border bg-surface",
  } as const;

  return (
    <div className="mx-auto max-w-4xl">
      <EcomHeader
        title="تحليلات ذكية"
        subtitle="أسئلة محدَّدة بإجابات محسوبة من أرقامك أنت — لا تلخيص عام ولا رأي يناقض بقية الصفحات."
        storeName={workspace.name}
      />

      <SectionHeading hint="كل إجابة تعرض الأرقام التي بُنيت عليها. الإجابة بلا دليل رأي لا تحليل.">
        الأسئلة الأربعة
      </SectionHeading>

      <div className="flex flex-col gap-3">
        {answers.map((a, i) => (
          <article key={i} className={`card-shadow rounded-2xl border p-5 ${TONE[a.tone]}`}>
            <div className="mb-2 flex items-start gap-2">
              <HelpCircle size={16} className="mt-0.5 shrink-0 text-text-muted" />
              <h3 className="text-[14px] font-semibold text-text-primary">{a.question}</h3>
            </div>

            <p className="text-[13px] leading-relaxed text-text-primary">{a.answer}</p>

            {a.evidence.length > 0 && (
              <div className="mt-3 rounded-xl border border-border bg-surface/70 p-3">
                <div className="mb-1.5 text-[11.5px] font-medium text-text-faint">الأرقام التي بُنيت عليها</div>
                <ul className="flex flex-col gap-1">
                  {a.evidence.map((e, j) => (
                    <li key={j} className="text-[12px] tabular-nums text-text-muted">
                      • {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {a.href && (
              <Link
                href={a.href}
                className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent no-underline hover:underline"
              >
                {a.hrefLabel}
                <ArrowLeft size={13} />
              </Link>
            )}
          </article>
        ))}
      </div>

      <p className="mt-6 text-[11.5px] leading-relaxed text-text-faint">
        هذه الإجابات محسوبة من قاعدة بياناتك مباشرة، لا مولَّدة بنموذج لغوي — فلا تستهلك رصيد الذكاء
        الاصطناعي، ولا تختلف نتيجتها بين تحديث وآخر ما لم تتغيّر أرقامك.
      </p>
    </div>
  );
}
