// app/admin/customers/page.tsx
//
// قائمة العملاء - الفلاتر في الرابط لا في حالة المكوّن.
//
// السبب عمليّ: التصدير CSV بيقرا **نفس** الرابط، فاللي بيتحمّل هو اللي
// معروض بالظبط. لو الفلاتر عاشت في حالة العميل (client state)، كان لازم
// نبعتها للتصدير بطريقة تانية، وأول اختلاف بين الطريقتين بيخلّي الملفّ
// يحتوي صفوف مش اللي المالك شايفها.

import Link from "next/link";
import { Users, Download, Star, Ban, ShieldCheck } from "lucide-react";
import { getSessionUserFromCookies } from "@/lib/auth";
import { resolveAdminRole, adminCapabilities } from "@/lib/adminRole";
import { listCustomers, parseCustomerFilters } from "@/lib/admin/customers";
import { PLANS } from "@/lib/plans";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TH_NUM, TR, TD, TD_NUM, TD_MUTED } from "@/app/components/ui/tableStyles";
import { AdminPageHeader, Badge, money, shortDate } from "../components/AdminUI";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);

  const user = await getSessionUserFromCookies();
  const caps = adminCapabilities(resolveAdminRole(user));
  const canSeeMoney = caps.includes("analytics.financial");
  const canExport = caps.includes("customers.export");

  const filters = parseCustomerFilters(qs);
  const page = Math.max(1, Number(qs.get("page") ?? 1) || 1);
  const { rows, total } = await listCustomers(filters, {
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const linkWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(qs);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    const s = next.toString();
    return `/admin/customers${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <AdminPageHeader
        title="Customers"
        subtitle={`${total.toLocaleString("en-US")} account${total === 1 ? "" : "s"} matching the current filter`}
        icon={Users}
        actions={
          canExport ? (
            <a
              href={`/api/admin/customers/export${qs.toString() ? `?${qs.toString()}` : ""}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-medium text-text-muted no-underline transition-colors hover:text-text-primary"
            >
              <Download size={13} /> Export CSV
            </a>
          ) : undefined
        }
      />

      {/* الفلاتر */}
      <form method="GET" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-text-faint">Search</span>
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Email, name, company"
            className="field field-sm h-8 w-56"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-text-faint">Plan</span>
          <select name="plan" defaultValue={filters.plan ?? ""} className="field field-sm h-8">
            <option value="">Any</option>
            {PLANS.map((p) => (
              <option key={p.key} value={p.key}>{p.key}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-text-faint">Status</span>
          <select name="status" defaultValue={filters.status ?? ""} className="field field-sm h-8">
            <option value="">Any</option>
            {["NONE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary h-8 px-3 text-[12.5px]">Apply</button>
        <Link href="/admin/customers" className="h-8 self-end px-2 text-[12.5px] text-text-faint no-underline hover:text-text-primary">
          Reset
        </Link>
      </form>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip href={linkWith({ vip: filters.vip ? null : "1" })} active={!!filters.vip}>
          <Star size={11} /> VIP
        </FilterChip>
        <FilterChip href={linkWith({ atRisk: filters.atRisk ? null : "1" })} active={!!filters.atRisk}>
          At risk
        </FilterChip>
        <FilterChip href={linkWith({ suspended: filters.suspended ? null : "1" })} active={!!filters.suspended}>
          <Ban size={11} /> Suspended
        </FilterChip>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-[13px] text-text-muted">
          No accounts match this filter.
        </div>
      ) : (
        <div className={TABLE_WRAP}>
          <table className={TABLE}>
            <thead>
              <tr className={THEAD_ROW}>
                <th className={TH}>Account</th>
                <th className={TH}>Plan</th>
                <th className={TH}>Status</th>
                {canSeeMoney && <th className={TH_NUM}>Monthly</th>}
                <th className={TH_NUM}>Workspaces</th>
                <th className={TH_NUM}>AI (mo)</th>
                <th className={TH}>Last login</th>
                <th className={TH}>Signed up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={TR}>
                  <td className={TD}>
                    <Link href={`/admin/customers/${r.id}`} className="flex items-center gap-1.5 text-text-primary no-underline hover:underline">
                      {r.isVip && <Star size={11} className="shrink-0 fill-gap text-gap" />}
                      <span className="truncate">{r.email}</span>
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-text-faint">
                      {r.companyName && <span className="truncate">{r.companyName}</span>}
                      {r.country && <span>· {r.country}</span>}
                      {r.isSuspended && <Badge tone="bad">suspended</Badge>}
                      {r.hasOverrides && <Badge tone="info"><ShieldCheck size={9} /> custom</Badge>}
                      {!r.emailVerified && <Badge tone="warn">unverified</Badge>}
                    </div>
                  </td>
                  <td className={TD}>{r.plan}</td>
                  <td className={TD}>
                    <Badge tone={statusTone(r.status)}>{r.status.toLowerCase()}</Badge>
                  </td>
                  {canSeeMoney && (
                    <td className={TD_NUM}>
                      {r.mrrCents !== null ? money(r.mrrCents, r.mrrCurrency ?? "USD") : "—"}
                    </td>
                  )}
                  <td className={TD_NUM}>{r.workspaceCount}</td>
                  <td className={TD_NUM}>{r.aiUsedThisMonth}</td>
                  <td className={TD_MUTED}>
                    <span className={r.atRisk ? "text-gap" : undefined}>
                      {r.lastLoginAt ? shortDate(r.lastLoginAt) : "never"}
                    </span>
                  </td>
                  <td className={TD_MUTED}>{shortDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[12.5px] text-text-muted">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <PageLink qs={qs} page={page - 1}>← Previous</PageLink>}
            {page < pages && <PageLink qs={qs} page={page + 1}>Next →</PageLink>}
          </div>
        </div>
      )}
    </div>
  );
}

function statusTone(status: string) {
  if (status === "ACTIVE") return "ok" as const;
  if (status === "PAST_DUE") return "bad" as const;
  if (status === "TRIALING") return "info" as const;
  if (status === "CANCELED") return "warn" as const;
  return "muted" as const;
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium no-underline transition-colors ${
        active ? "bg-critical/15 text-critical" : "border border-border text-text-muted hover:text-text-primary"
      }`}
    >
      {children}
    </Link>
  );
}

function PageLink({ qs, page, children }: { qs: URLSearchParams; page: number; children: React.ReactNode }) {
  const next = new URLSearchParams(qs);
  next.set("page", String(page));
  return (
    <Link href={`/admin/customers?${next.toString()}`} className="text-accent no-underline hover:underline">
      {children}
    </Link>
  );
}
