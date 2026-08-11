// app/dashboard/campaigns/shopping/page.tsx
//
// "منتجات كتالوجي كلها بتظهر فعلاً، ولا فيه منتجات مرفوضة بصمت؟" -
// عبر shopping_product (المورد الحالي، مش Content API القديم اللي بيتقفل
// 18 أغسطس 2026).

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getRelativeSpendThreshold } from "@/lib/relativeSpendThreshold";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { ShoppingBag, AlertTriangle, Coins, ExternalLink, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

interface ShoppingRow {
  id: string;
  itemId: string;
  title: string | null;
  issuesDetail: string | null;
  cost: number;
}

/**
 * صفّ منتج واحد.
 *
 * 🔴 ما استُبدل: `className="btn btn-danger bg-critical/10 p-4"` على `<div>`.
 * `.btn-danger` تفرض خلفيةً حمراء صريحة وتهزم `bg-critical/10` (نفس فخّ
 * «الاختصار في CSS يغلب أداة Tailwind» المتكرّر في هذا المشروع)، و`.btn`
 * تفرض `inline-flex` و`nowrap` - فيصطفّ اسم المنتج وسبب رفضه في سطر واحد
 * فوق شريط أحمر صريح يبدو زرّاً ضخماً لا يفعل شيئاً عند الضغط. صفٌّ لا زرّ:
 * فيه معلومة تُقرأ، واللون على الأيقونة والحدّ لا على المساحة كلّها.
 */
function ProductRow({
  title, detail, cost, currency, costLabel, tone, Icon,
}: {
  title: string;
  detail: string | null;
  cost: number;
  currency: string;
  costLabel: string;
  tone: "critical" | "gap";
  Icon: LucideIcon;
}) {
  // أصناف كاملة لا مركَّبة بالنصّ: Tailwind يقرأ الملفّ نصّياً، فصنفٌ يُبنى
  // من متغيّر (`bg-${c}/12`) لا يوجد في المخرجات إطلاقاً ويسقط اللون بصمت.
  const TONE = {
    critical: { border: "border-critical/35", box: "bg-critical/12 text-critical" },
    gap: { border: "border-gap/35", box: "bg-gap/12 text-gap" },
  }[tone];

  return (
    <div className={`card pad-md flex items-start gap-3 ${TONE.border}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE.box}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-text-primary">{title}</div>
        {detail && <div className="mt-0.5 text-[12px] leading-relaxed text-text-muted">{detail}</div>}
      </div>
      <div className="shrink-0 text-end">
        <div className="text-[10.5px] uppercase tracking-wide text-text-faint">{costLabel}</div>
        <div className="num text-[13.5px] font-semibold text-text-primary">
          {Math.round(cost).toLocaleString("en-US")}{" "}
          <span className="text-[11px] font-normal text-text-muted">{currency}</span>
        </div>
      </div>
    </div>
  );
}

export default async function ShoppingProductsPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  // إصلاح باگ: الرقم كان ثابت (10) من غير وعي بالعملة - بقى نسبي لصرف
  // الحساب نفسه، نفس العملة تلقائياً
  const wastefulThreshold = await getRelativeSpendThreshold(workspace.id);

  const [rejectedProducts, wastefulProducts] = await Promise.all([
    prisma.shoppingProductSnapshot.findMany({
      where: { workspaceId: workspace.id, hasIssues: true },
      orderBy: { cost: "desc" },
      take: 20,
    }),
    prisma.shoppingProductSnapshot.findMany({
      where: { workspaceId: workspace.id, hasIssues: false, conversions: 0, cost: { gt: wastefulThreshold } },
      orderBy: { cost: "desc" },
      take: 20,
    }),
  ]);

  const hasAnyData = rejectedProducts.length > 0 || wastefulProducts.length > 0;

  return (
    <div>
      <PageHeader
        icon={ShoppingBag}
        tone="gap"
        eyebrow={workspace.name}
        title={t(locale, "campPages.shopTitle")}
        description={t(locale, "campPages.shopIntro")}
      />

      {!hasAnyData ? (
        <EmptyState
          title={t(locale, "campPages.shopNone")}
          description={t(locale, "campPages.shopNoneBody")}
        />
      ) : (
        <>
          {rejectedProducts.length > 0 && (
            <section className="mb-6">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h2 className="section-title text-critical">{t(locale, "campPages.shopRejected")}</h2>
                {/* القاعدة الحاكمة: نقطة تمنع المستخدم تحمل معها الحلّ. سبب
                    الرفض لا يُصلَح عندنا بل في Merchant Center، فالرابط
                    جزء من التشخيص لا إضافة عليه. رابط عامّ لا عميق: لا
                    توجد صيغة موثّقة لرابط منتج بعينه. */}
                <a
                  href="https://merchants.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  {t(locale, "campPages.shopFixInMc")}
                  <ExternalLink size={13} />
                </a>
              </div>
              <p className="mb-3 max-w-2xl text-[12.5px] leading-relaxed text-text-muted">
                {t(locale, "campPages.shopRejectedHint")}
              </p>
              <div className="flex flex-col gap-2">
                {rejectedProducts.map((p: ShoppingRow) => (
                  <ProductRow
                    key={p.id}
                    title={p.title ?? p.itemId}
                    /* منتج مرفوض بلا تفصيل من المنصّة كان يعرض سطراً فارغاً
                       يُقرأ كعطل - الجملة تقول إنّ الغياب من المنصّة لا منّا. */
                    detail={p.issuesDetail ?? t(locale, "campPages.shopNoIssueDetail")}
                    cost={p.cost}
                    currency={workspace.currency}
                    costLabel={t(locale, "campPages.shopSpendLabel")}
                    tone="critical"
                    Icon={AlertTriangle}
                  />
                ))}
              </div>
            </section>
          )}

          {wastefulProducts.length > 0 && (
            <section>
              <h2 className="section-title mb-1 text-gap">{t(locale, "campPages.shopNoConv")}</h2>
              <p className="mb-3 max-w-2xl text-[12.5px] leading-relaxed text-text-muted">
                {t(locale, "campPages.shopNoConvHint")}
              </p>
              <div className="flex flex-col gap-2">
                {wastefulProducts.map((p: ShoppingRow) => (
                  <ProductRow
                    key={p.id}
                    title={p.title ?? p.itemId}
                    detail={null}
                    cost={p.cost}
                    currency={workspace.currency}
                    costLabel={t(locale, "campPages.shopSpendLabel")}
                    tone="gap"
                    Icon={Coins}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
