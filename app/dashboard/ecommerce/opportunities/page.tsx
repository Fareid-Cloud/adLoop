// app/dashboard/ecommerce/opportunities/page.tsx
//
// كل ما يمكن فعله الآن لزيادة الربح، مرتَّباً بالأثر المالي.
//
// هذه الصفحة هي الفرق بين لوحة تحليل ومستشار: لا تعرض أن الهامش انخفض،
// بل تقول ما يُفعل، وكم يُتوقَّع أن يعيد، وما درجة الثقة في ذلك التقدير.
// كل فرصة تحمل ثلاثة أشياء: أثر بالمال، ثقة مبرَّرة، وصعوبة صريحة.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  EcomHeader, SectionHeading, DataGate, LimitsNote, fmtNum,
} from "../_components/EcomPrimitives";
import { buildOpportunities, type Opportunity } from "@/lib/ecommerce/opportunities";
import { MetricCard } from "@/app/components/ui/MetricCard";
import {
  TrendingUp, Target, Layers, ArrowLeft, ArrowUpCircle, ArrowDownCircle,
  PauseCircle, PackagePlus, Boxes, Users, RotateCcw, Wallet,
} from "lucide-react";

export const dynamic = "force-dynamic";

const TYPE_META: Record<
  Opportunity["type"],
  { icon: typeof TrendingUp; labelAr: string; tone: string }
> = {
  RAISE_PRICE: { icon: ArrowUpCircle, labelAr: "رفع سعر", tone: "text-gap bg-gap/10" },
  LOWER_PRICE: { icon: ArrowDownCircle, labelAr: "خفض سعر", tone: "text-accent bg-accent/10" },
  PAUSE_ADS: { icon: PauseCircle, labelAr: "إيقاف إعلان", tone: "text-critical bg-critical/10" },
  INCREASE_BUDGET: { icon: TrendingUp, labelAr: "زيادة ميزانية", tone: "text-verified bg-verified/10" },
  RESTOCK: { icon: PackagePlus, labelAr: "إعادة طلب", tone: "text-critical bg-critical/10" },
  BUNDLE: { icon: Boxes, labelAr: "باقة", tone: "text-accent bg-accent/10" },
  CROSS_SELL: { icon: Layers, labelAr: "بيع متقاطع", tone: "text-accent bg-accent/10" },
  WIN_BACK: { icon: Users, labelAr: "استرجاع عملاء", tone: "text-gap bg-gap/10" },
  REDUCE_RETURNS: { icon: RotateCcw, labelAr: "خفض مرتجعات", tone: "text-critical bg-critical/10" },
};

const CONFIDENCE_AR = { HIGH: "ثقة عالية", MEDIUM: "ثقة متوسطة", LOW: "ثقة منخفضة" } as const;
const CONFIDENCE_TONE = {
  HIGH: "bg-verified/10 text-verified",
  MEDIUM: "bg-gap/10 text-gap",
  LOW: "bg-surface-raised text-text-muted",
} as const;
const DIFFICULTY_AR = { EASY: "سهل", MEDIUM: "متوسط", HARD: "يحتاج جهداً" } as const;

export default async function OpportunitiesPage() {
  const user = await getSessionUserFromCookies();
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

  const result = await buildOpportunities(workspace.id, 30);
  const c = result.currency;

  const easyWins = result.opportunities.filter((o) => o.difficulty === "EASY");
  const highConfidence = result.opportunities.filter((o) => o.confidence === "HIGH");

  return (
    <div className="mx-auto max-w-5xl">
      <EcomHeader
        title="الفرص"
        subtitle="كل ما يمكن فعله الآن لزيادة الربح، مرتَّباً بالأثر المالي لا بالترتيب الأبجدي."
        storeName={workspace.name}
      />

      {result.opportunities.length > 0 && (
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="إجمالي الفرص المرصودة"
            value={fmtNum(result.totalPotentialProfit)}
            unit={`${c} شهرياً`}
            icon={Wallet}
            tone="verified"
          />
          <MetricCard
            label="مكاسب سريعة"
            value={easyWins.length}
            icon={Target}
            tone="accent"
            caption={
              easyWins.length > 0
                ? { text: `بأثر ${fmtNum(easyWins.reduce((s, o) => s + o.estimatedMonthlyProfit, 0))} ${c}`, tone: "positive" }
                : undefined
            }
          />
          <MetricCard
            label="فرص عالية الثقة"
            value={highConfidence.length}
            icon={TrendingUp}
            tone="verified"
            caption={{ text: "مبنيّة على عيّنة كافية من مبيعاتك", tone: "muted" }}
          />
        </div>
      )}

      <LimitsNote items={result.blindSpotsAr} />

      {result.opportunities.length === 0 ? (
        <DataGate
          titleAr="لا توجد فرص مرصودة الآن"
          reasonAr="إمّا أن أرقامك ضمن المعقول فعلاً، وإمّا أن البيانات لا تكفي لرصد فرصة بثقة. راجع «ما لا نراه بعد» أعلاه إن ظهر."
          href="/dashboard/ecommerce/products"
          hrefLabelAr="راجع منتجاتك"
        />
      ) : (
        <>
          <SectionHeading hint="الترتيب بالأثر المالي، والثقة تفصل بين المتقاربين. الفرصة التي لا نستطيع تقدير أثرها بالمال لا تُعرض هنا إطلاقاً.">
            {result.opportunities.length} فرصة
          </SectionHeading>

          <div className="flex flex-col gap-3">
            {result.opportunities.map((o) => {
              const meta = TYPE_META[o.type];
              const Icon = meta.icon;
              return (
                <article
                  key={o.id}
                  className="card-shadow rounded-2xl border border-border bg-surface p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[14px] font-semibold text-text-primary">{o.titleAr}</h3>
                          <span className="rounded-md bg-surface-raised px-1.5 py-0.5 text-[11px] text-text-muted">
                            {meta.labelAr}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">{o.reasonAr}</p>
                      </div>
                    </div>

                    <div className="shrink-0 text-end">
                      <div className="text-[22px] font-semibold leading-none tabular-nums text-verified">
                        +{fmtNum(o.estimatedMonthlyProfit)}
                      </div>
                      <div className="mt-1 text-[11.5px] text-text-muted">{c} شهرياً</div>
                    </div>
                  </div>

                  {/* الإجراء المحدَّد - لا نصيحة عامة */}
                  <div className="mt-3 rounded-xl border border-border bg-surface-2/50 p-3">
                    <div className="mb-1 text-[11.5px] font-medium text-text-faint">ماذا تفعل بالضبط</div>
                    <p className="text-[12.5px] leading-relaxed text-text-primary">{o.actionAr}</p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11.5px] font-medium ${CONFIDENCE_TONE[o.confidence]}`}
                        title={o.confidenceReasonAr}
                      >
                        {CONFIDENCE_AR[o.confidence]}
                      </span>
                      <span className="rounded-md bg-surface-raised px-2 py-0.5 text-[11.5px] text-text-muted">
                        {DIFFICULTY_AR[o.difficulty]}
                      </span>
                      {o.oneClick && (
                        <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[11.5px] font-medium text-accent">
                          تنفيذ بضغطة
                        </span>
                      )}
                    </div>

                    {o.actionHref && (
                      <Link
                        href={o.actionHref}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-[12.5px] font-medium text-accent no-underline transition-colors hover:bg-accent/20"
                      >
                        نفّذ
                        <ArrowLeft size={13} />
                      </Link>
                    )}
                  </div>

                  {/* سبب درجة الثقة معروض دائماً - درجة بلا تفسير لا قيمة لها */}
                  <p className="mt-2 text-[11.5px] leading-relaxed text-text-faint">
                    {o.confidenceReasonAr}
                  </p>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
