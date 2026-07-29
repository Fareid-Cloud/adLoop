// app/dashboard/ecommerce/orders/page.tsx
//
// جودة الطلبات لا إدارتها. لا تنفيذ ولا طباعة بوالص - المتجر يفعل ذلك.
// السؤال هنا: أي طلبات تكلّفك مالاً دون أن تُنتج بيعاً، ولماذا.
//
// الترتيب مقصود بالأثر المالي: المرتجع أغلى من الملغى (دفعت الشحن مرّتين)،
// والمتأخّر هو السبب المباشر لكليهما.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  EcomHeader, SectionHeading, RecommendedActions, DataGate,
  DataTable, Td, Tr, fmtNum, type RecommendedAction,
} from "../_components/EcomPrimitives";
import { getOrderQuality } from "@/lib/ecommerce/storeIntelligence";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

const STATE_AR: Record<string, { label: string; className: string }> = {
  PLACED: { label: "قيد التنفيذ", className: "bg-surface-raised text-text-muted" },
  FULFILLED: { label: "مُنفَّذ", className: "bg-verified/10 text-verified" },
  CANCELLED: { label: "ملغى", className: "bg-gap/10 text-gap" },
  RETURNED: { label: "مرتجع", className: "bg-critical/10 text-critical" },
};

const TONE_STYLE = {
  critical: "border-critical/30 bg-critical/[0.06]",
  warning: "border-gap/30 bg-gap/[0.06]",
  positive: "border-verified/30 bg-verified/[0.06]",
  neutral: "border-border bg-surface",
} as const;

const TONE_TEXT = {
  critical: "text-critical",
  warning: "text-gap",
  positive: "text-verified",
  neutral: "text-text-primary",
} as const;

export default async function OrdersPage() {
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

  const quality = await getOrderQuality(workspace.id, 30);
  const c = quality.currency;

  if (!quality.hasData) {
    return (
      <div className="mx-auto max-w-5xl">
        <EcomHeader
          title="الطلبات"
          subtitle="أي طلبات تكلّفك مالاً دون أن تُنتج بيعاً، ولماذا."
          storeName={workspace.name}
        />
        <DataGate
          titleAr="لا توجد طلبات مسجَّلة بعد"
          reasonAr="تصل الطلبات عبر ويب هوك متجرك فور حدوثها. تأكّد من تسجيل الويب هوك في لوحة المتجر ليبدأ التحليل."
        />
      </div>
    );
  }

  const actions: RecommendedAction[] = [];
  const byKey = new Map(quality.buckets.map((b) => [b.key, b]));

  const delayed = byKey.get("delayed");
  if (delayed && delayed.count > 0) {
    actions.push({
      titleAr: `نفّذ ${delayed.count} طلباً متأخّراً اليوم`,
      reasonAr: "التأخير هو السبب المباشر الأول للإلغاء والمرتجعات. كل يوم إضافي يرفع احتمال خسارة الطلب كاملاً.",
      impactAr: `قيمة معرَّضة للخطر: ${fmtNum(delayed.value)} ${c}`,
      tone: "critical",
    });
  }

  const returned = byKey.get("returned");
  if (returned && returned.count > 0 && quality.totalOrders > 0) {
    const pct = Math.round((returned.count / quality.totalOrders) * 100);
    if (pct >= 10) {
      actions.push({
        titleAr: `معدّل الإرجاع ${pct}% — مرتفع`,
        reasonAr: `${fmtNum(returned.value)} ${c} عادت مرتجعة. راجع أكثر المنتجات إرجاعاً: أغلب الأسباب وصف أو مقاس، لا عيب في المنتج نفسه.`,
        tone: "critical",
        href: "/dashboard/ecommerce/products",
        hrefLabelAr: "المنتجات",
      });
    }
  }

  const risky = byKey.get("risky");
  if (risky && risky.count > 0) {
    actions.push({
      titleAr: `راجع ${risky.count} طلباً قبل شحنه`,
      reasonAr: "إشارات مخاطرة مجتمعة. مكالمة تأكيد واحدة قبل الشحن أرخص من شحنة ترتدّ بتكلفة ذهاب وعودة.",
      impactAr: `قيمة معرَّضة: ${fmtNum(risky.value)} ${c}`,
      tone: "warning",
    });
  }

  const cancelled = byKey.get("cancelled");
  if (cancelled && cancelled.count > 0) {
    actions.push({
      titleAr: `${cancelled.count} طلب ملغى — تكلفتها إعلانية بحتة`,
      reasonAr: "دفعت لجلب هؤلاء العملاء ولم تبع لهم شيئاً. راجع سبب الإلغاء الأشيع: غالباً سعر شحن مفاجئ عند الدفع أو مدة توصيل طويلة.",
      tone: "warning",
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <EcomHeader
        title="الطلبات"
        subtitle="أي طلبات تكلّفك مالاً دون أن تُنتج بيعاً، ولماذا. آخر ٣٠ يوماً."
        storeName={workspace.name}
      />

      <SectionHeading hint={`من إجمالي ${fmtNum(quality.totalOrders)} طلباً في الفترة. مرتَّبة بالأثر المالي لا بالعدد.`}>
        جودة الطلبات
      </SectionHeading>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quality.buckets.map((b) => (
          <div key={b.key} className={`card-shadow rounded-2xl border p-4 ${TONE_STYLE[b.tone]}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-text-primary">{b.labelAr}</span>
              <span className={`text-[22px] font-semibold tabular-nums ${TONE_TEXT[b.tone]}`}>{b.count}</span>
            </div>
            <div className="mt-1 text-[12px] tabular-nums text-text-muted">
              {fmtNum(b.value)} {c}
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted">{b.descriptionAr}</p>
          </div>
        ))}
      </div>

      <SectionHeading hint="أحدث ٤٠ طلباً. درجة المخاطرة ترجيح من أنماط معروفة، لا كشف احتيال — مرّر المؤشّر لترى أسبابها.">
        أحدث الطلبات
      </SectionHeading>

      <div className="card-shadow overflow-hidden rounded-2xl border border-border bg-surface">
        <DataTable headers={["الطلب", "العميل", "التاريخ", "القيمة", "الحالة", "الدفع", "مخاطرة"]}>
          {quality.recent.map((o) => {
            const state = STATE_AR[o.state] ?? STATE_AR.PLACED;
            const risky = (o.fraudRiskScore ?? 0) >= 50;
            return (
              <Tr key={o.id}>
                <Td>
                  <span className="font-medium text-text-primary">#{o.externalOrderId}</span>
                </Td>
                <Td className="text-text-muted">{o.customerName ?? "—"}</Td>
                <Td className="tabular-nums text-text-muted">{o.orderedAt.toISOString().slice(0, 10)}</Td>
                <Td className="tabular-nums font-medium text-text-primary">{fmtNum(o.total)}</Td>
                <Td>
                  <span className={`rounded-md px-2 py-0.5 text-[11.5px] font-medium ${state.className}`}>
                    {state.label}
                  </span>
                </Td>
                <Td className="text-text-muted">
                  {o.isCod ? (
                    <span className="text-gap">عند الاستلام</span>
                  ) : (
                    <span>مدفوع</span>
                  )}
                </Td>
                <Td>
                  {o.fraudRiskScore === null || o.fraudRiskScore === 0 ? (
                    <span className="text-text-faint">—</span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium tabular-nums ${
                        risky ? "bg-critical/10 text-critical" : "bg-surface-raised text-text-muted"
                      }`}
                      title={o.fraudRiskReasons.join(" • ")}
                    >
                      {risky && <ShieldAlert size={11} />}
                      {Math.round(o.fraudRiskScore)}
                    </span>
                  )}
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      </div>

      <RecommendedActions actions={actions} emptyAr="جودة طلباتك جيدة: لا تأخير ولا معدّل إرجاع مقلق في هذه الفترة." />
    </div>
  );
}
