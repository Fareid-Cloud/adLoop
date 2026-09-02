// app/admin/analytics/page.tsx
//
// التحليلات - ستّة تبويبات، كل واحد بيحمّل بياناته هو بس.
//
// التبويب في الرابط مش في حالة المكوّن: صفحة بتشتغل على الخادم، والتبويب
// في الحالة كان معناه تحميل الستّة كلهم عشان واحد يتعرض - ستّة أضعاف
// الاستعلامات لواحد بيتشاف.

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { getSessionUserFromCookies } from "@/lib/auth";
import { resolveAdminRole, adminCapabilities } from "@/lib/adminRole";
import { lastNDays } from "@/lib/admin/shared";
import { getBusinessSummary, KNOWN_GAPS } from "@/lib/admin/business";
import { getCustomerAnalytics } from "@/lib/admin/customers";
import { getAcquisitionAnalytics } from "@/lib/admin/acquisition";
import { getProductAnalytics } from "@/lib/admin/product";
import { getOperationalAnalytics } from "@/lib/admin/operational";
import { getUsageOverview } from "@/lib/admin/usage";
import { buildInsights } from "@/lib/admin/insights";
import { AdminPageHeader, InsightStrip } from "../components/AdminUI";
import { BusinessTab } from "./tabs/BusinessTab";
import { CustomersTab } from "./tabs/CustomersTab";
import { AcquisitionTab } from "./tabs/AcquisitionTab";
import { ProductTab } from "./tabs/ProductTab";
import { PlansTab } from "./tabs/PlansTab";
import { OperationalTab } from "./tabs/OperationalTab";
import { UsageTab } from "./tabs/UsageTab";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "business", label: "Business", financial: true },
  { key: "customers", label: "Customers", financial: false },
  { key: "acquisition", label: "Acquisition", financial: false },
  { key: "product", label: "Product", financial: false },
  // "Plan performance" لا "Plans": فيه صفحة اسمها Plans في القائمة، وهي
  // **الكتالوج** (بنبيع إيه) لا الأداء (الباقات ماشية إزاي). الاسمان
  // المتطابقان كانا بيخلّوا الواحدة تبان نسخة من التانية، فيتفتح الاتنين
  // بحثاً عن نفس الشيء.
  { key: "plans", label: "Plan performance", financial: true },
  { key: "operational", label: "Operational", financial: false },
  { key: "usage", label: "Usage & Costs", financial: true },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const range = lastNDays(days);

  const user = await getSessionUserFromCookies();
  const caps = adminCapabilities(resolveAdminRole(user));
  const canMoney = caps.includes("analytics.financial");

  const visible = TABS.filter((t) => !t.financial || canMoney);
  const requested = (sp.tab ?? visible[0].key) as TabKey;
  const tab: TabKey = visible.some((t) => t.key === requested) ? requested : visible[0].key;

  // كل تبويب بيحمّل نفسه بس. الرؤى محتاجة أكتر من مصدر، فبتتحسب من اللي
  // اتحمّل فعلاً - والقواعد اللي ماوصلهاش مصدرها بتتخطّى نفسها بهدوء.
  const business = tab === "business" || tab === "plans" ? await getBusinessSummary(range) : undefined;
  const acquisition = tab === "acquisition" ? await getAcquisitionAnalytics(range) : undefined;
  const customers = tab === "customers" || tab === "plans" ? await getCustomerAnalytics(range) : undefined;
  const product = tab === "product" ? await getProductAnalytics(days) : undefined;
  const operational = tab === "operational" ? await getOperationalAnalytics(range) : undefined;
  const usage = tab === "usage" ? await getUsageOverview(days) : undefined;

  const insights = buildInsights({ business, customers, product, operational, usage });

  return (
    <div>
      <AdminPageHeader
        title="Analytics & Insights"
        subtitle={`Last ${days} days`}
        icon={TrendingUp}
        actions={
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <Link
                key={d}
                href={`/admin/analytics?tab=${tab}&days=${d}`}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-medium no-underline transition-colors ${
                  d === days ? "bg-critical/15 text-critical" : "border border-border text-text-muted hover:text-text-primary"
                }`}
              >
                {d}d
              </Link>
            ))}
          </div>
        }
      />

      <nav className="mb-5 flex flex-wrap gap-1 border-b border-border pb-2">
        {visible.map((t) => (
          <Link
            key={t.key}
            href={`/admin/analytics?tab=${t.key}&days=${days}`}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium no-underline transition-colors ${
              t.key === tab ? "bg-critical/15 text-critical" : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <InsightStrip insights={insights} />

      {tab === "business" && business && <BusinessTab data={business} gaps={KNOWN_GAPS} />}
      {tab === "customers" && customers && <CustomersTab data={customers} />}
      {tab === "acquisition" && acquisition && <AcquisitionTab data={acquisition} />}
      {tab === "product" && product && <ProductTab data={product} />}
      {tab === "plans" && business && customers && <PlansTab business={business} customers={customers} />}
      {tab === "operational" && operational && <OperationalTab data={operational} />}
      {tab === "usage" && usage && <UsageTab data={usage} />}
    </div>
  );
}
