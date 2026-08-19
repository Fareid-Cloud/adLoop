// app/admin/analytics/tabs/PlansTab.tsx
//
// الباقات من زاوية الأعمال - التوزيع، الإيراد لكل باقة، والتحوّل من
// المجّاني/التجربة إلى المدفوع.

import type { BusinessSummary } from "@/lib/admin/business";
import type { CustomerAnalytics } from "@/lib/admin/customers";
import { PLANS } from "@/lib/plans";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TH_NUM, TR, TD, TD_NUM } from "@/app/components/ui/tableStyles";
import { Card, SectionTitle, money, pct } from "../../components/AdminUI";
import { Donut } from "./Charts";

export function PlansTab({
  business,
  customers,
}: {
  business: BusinessSummary;
  customers: CustomerAnalytics;
}) {
  const totalAccounts = customers.total;
  const rows = PLANS.map((p) => {
    const accounts = customers.byPlan[p.key] ?? 0;
    const mrr = business.mrr.byPlan[p.key];
    return {
      key: p.key,
      accounts,
      sharePct: totalAccounts > 0 ? (accounts / totalAccounts) * 100 : null,
      paying: mrr?.customers ?? 0,
      mrrUsdCents: mrr?.usdCents ?? 0,
      arpuUsdCents: mrr && mrr.customers > 0 ? mrr.usdCents / mrr.customers : 0,
      listPrice: p.price,
    };
  });

  const donut = rows.filter((r) => r.mrrUsdCents > 0).map((r) => ({ name: r.key, value: Math.round(r.mrrUsdCents / 100) }));

  // "تحوّل" مقاس كلقطة: كام حساب من كل من سجّل بقى دافع دلوقتي. اللحظة
  // الدقيقة للتحوّل محتاجة `SubscriptionEvent`، وبيتراكم من دلوقتي.
  const conversionPct = totalAccounts > 0 ? (customers.paying / totalAccounts) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Plan performance</SectionTitle>
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Plan</th>
                  <th className={TH_NUM}>Accounts</th>
                  <th className={TH_NUM}>Share</th>
                  <th className={TH_NUM}>Paying</th>
                  <th className={TH_NUM}>MRR</th>
                  <th className={TH_NUM}>ARPU</th>
                  <th className={TH}>List price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={TR}>
                    <td className={TD}>{r.key}</td>
                    <td className={TD_NUM}>{r.accounts}</td>
                    <td className={TD_NUM}>{pct(r.sharePct)}</td>
                    <td className={TD_NUM}>{r.paying}</td>
                    <td className={TD_NUM}>{r.mrrUsdCents > 0 ? money(r.mrrUsdCents) : "—"}</td>
                    <td className={TD_NUM}>{r.arpuUsdCents > 0 ? money(r.arpuUsdCents) : "—"}</td>
                    <td className={TD_NUM}>
                      <span className="text-[11.5px] text-text-faint">
                        {r.listPrice.EGP} EGP · {r.listPrice.SAR} SAR · ${r.listPrice.USD}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <SectionTitle>MRR share</SectionTitle>
          <Donut data={donut} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="point-in-time, not moment-of-conversion">Free / trial → paid</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="All accounts" value={totalAccounts} />
            <Stat label="Paying now" value={customers.paying} tone="ok" />
            <Stat label="Conversion" text={pct(conversionPct, 1)} />
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-text-faint">
            This counts everyone who ever signed up against who pays today. The exact moment-of-conversion rate needs
            subscription events, which start accumulating from now.
          </p>
        </Card>

        <Card>
          <SectionTitle>Upgrades & downgrades</SectionTitle>
          {business.movement.events === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-text-faint">
              No plan changes recorded yet. Every plan change from now on is classified as expansion or contraction by
              comparing the two plans&apos; catalogue order — no guessing from dates.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Expansion" text={money(business.movement.expansionUsdCents)} tone="ok" />
              <Stat label="Contraction" text={money(business.movement.contractionUsdCents)} tone="warn" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, text, tone }: { label: string; value?: number; text?: string; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-verified" : tone === "warn" ? "text-gap" : "text-text-primary";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>
        {text ?? value?.toLocaleString("en-US") ?? "—"}
      </div>
    </div>
  );
}
