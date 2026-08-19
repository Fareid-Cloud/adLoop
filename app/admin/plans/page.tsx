// app/admin/plans/page.tsx
//
// كتالوج الباقات - **للقراءة بس، بقرار صريح.**
//
// نقل الأسعار والحدود لقاعدة البيانات عشان تتعدّل من هنا كان معناه إنّ
// غلطة كتابة واحدة بتعيد تسعير كل المشتركين، وبتلمس صفحة الأسعار العامة
// وجدول المقارنة وحساب الاستحقاقات لكل حساب. الكتالوج في الكود بيتراجع
// في مراجعة كود وبينشر بنشرة - وده الفرق بين تغيير مقصود وحادث.
//
// أي تخصيص لحساب واحد بيتعمل من صفحته (Overrides)، وأثره محصور فيه.

import Link from "next/link";
import { CreditCard, Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PLANS, COMPARISON_ROWS, YEARLY_MONTHS_CHARGED } from "@/lib/plans";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TH_NUM, TR, TD, TD_NUM } from "@/app/components/ui/tableStyles";
import { AdminPageHeader, Card, SectionTitle } from "../components/AdminUI";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const [counts, overridden] = await Promise.all([
    prisma.user.groupBy({ by: ["subscriptionPlan"], _count: true }),
    prisma.user.count({
      where: {
        OR: [
          // `Prisma.DbNull` مش `null`: عمود Json عنده حالتان مختلفتان
          // (`NULL` في قاعدة البيانات، و`"null"` كقيمة JSON)، والـtype
          // بيرفض `null` المجرّد عشان يجبرنا نقول أنهي واحدة نقصد.
          { planLimitOverrides: { not: Prisma.DbNull } },
          { featureOverrides: { not: Prisma.DbNull } },
          { customPriceOverrideCents: { not: null } },
        ],
      },
    }),
  ]);
  const byPlan = new Map(counts.map((c) => [c.subscriptionPlan ?? "free", c._count]));

  return (
    <div>
      <AdminPageHeader
        title="Plans"
        subtitle="The live catalogue exactly as customers see it"
        icon={CreditCard}
      />

      <div className="mb-4 flex items-start gap-2 rounded-2xl border border-border bg-surface p-3">
        <Lock size={14} className="mt-0.5 shrink-0 text-text-faint" />
        <p className="m-0 text-[12.5px] leading-relaxed text-text-muted">
          This page is read-only on purpose. Prices and limits live in code so a typo cannot reprice every subscriber at
          once, and so a change goes through review and a deploy. To give one account different terms, open that account
          and set an override — {overridden > 0 ? (
            <Link href="/admin/customers" className="text-accent no-underline hover:underline">
              {overridden} account{overridden === 1 ? " has" : "s have"} one today
            </Link>
          ) : "no account has one today"}.
        </p>
      </div>

      <SectionTitle hint={`yearly is charged for ${YEARLY_MONTHS_CHARGED} months`}>Pricing</SectionTitle>
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr className={THEAD_ROW}>
              <th className={TH}>Plan</th>
              <th className={TH_NUM}>EGP / mo</th>
              <th className={TH_NUM}>SAR / mo</th>
              <th className={TH_NUM}>USD / mo</th>
              <th className={TH_NUM}>Accounts on it</th>
              <th className={TH}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map((p) => (
              <tr key={p.key} className={TR}>
                <td className={TD}>
                  {p.key}
                  {p.highlighted && <span className="ms-1.5 rounded bg-accent/15 px-1 py-0.5 text-[10px] text-accent">featured</span>}
                </td>
                <td className={TD_NUM}>{p.price.EGP.toLocaleString("en-US")}</td>
                <td className={TD_NUM}>{p.price.SAR.toLocaleString("en-US")}</td>
                <td className={TD_NUM}>{p.price.USD.toLocaleString("en-US")}</td>
                <td className={TD_NUM}>{byPlan.get(p.key) ?? 0}</td>
                <td className={TD}>
                  <span className="text-[11.5px] text-text-faint">
                    {p.contactOnly ? "contact only — blocked in checkout" : "self-serve"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle hint="the same rows the public comparison table renders">Limits</SectionTitle>
      <Card className="overflow-x-auto p-0">
        <table className={TABLE}>
          <thead>
            <tr className={THEAD_ROW}>
              <th className={TH}>Limit</th>
              {PLANS.map((p) => <th key={p.key} className={TH_NUM}>{p.key}</th>)}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.key} className={TR}>
                <td className={TD}>{row.key}</td>
                {PLANS.map((p) => {
                  const v = p.limits[row.key];
                  return (
                    <td key={p.key} className={TD_NUM}>
                      {typeof v === "boolean" ? (v ? "yes" : "—") : v === -1 ? "∞" : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
