// app/admin/audit/page.tsx
//
// سجلّ التدقيق الكامل.
//
// **موظّف الدعم بيشوف أفعاله هو بس.** مش إخفاء لسوء ظنّ - سجلّ الأفعال
// المالية والصلاحيات فيه معلومات عن أسعار خاصة واتفاقات، وموظّف الدعم
// مالوش شغل بيها أصلاً (مش من صلاحياته يعملها). المالك بيشوف الكل.

import Link from "next/link";
import { ScrollText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { resolveAdminRole, adminCapabilities } from "@/lib/adminRole";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TR, TD, TD_MUTED } from "@/app/components/ui/tableStyles";
import { AdminPageHeader, Badge, dateTime } from "../components/AdminUI";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

/** الأفعال اللي بتغيّر حاجة لا رجعة فيها - بتتلوّن غير الباقي */
const HIGH_IMPACT = new Set([
  "IMPERSONATE", "SUSPEND_USER", "SUBSCRIPTION_GIFT", "SUBSCRIPTION_EXTEND",
  "SUBSCRIPTION_CANCEL", "OVERRIDE_ENTITLEMENTS", "STAFF_ROLE_CHANGE",
  "EXPORT_CUSTOMERS", "RESET_AI_LIMITS", "REAUTH_FAILED",
]);

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const me = await getSessionUserFromCookies();
  const role = resolveAdminRole(me);
  const seesEverything = adminCapabilities(role).includes("audit.viewAll");

  const where = {
    ...(seesEverything ? {} : { adminUserId: me?.id ?? "__none__" }),
    ...(sp.action ? { action: sp.action } : {}),
    ...(sp.q ? { details: { contains: sp.q, mode: "insensitive" as const } } : {}),
  };

  const [rows, total, actionGroups, admins] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.groupBy({
      by: ["action"],
      where: seesEverything ? {} : { adminUserId: me?.id ?? "__none__" },
      _count: true,
      orderBy: { _count: { action: "desc" } },
    }),
    prisma.user.findMany({ where: { isAdmin: true }, select: { id: true, email: true } }),
  ]);

  const emailById = new Map(admins.map((a) => [a.id, a.email]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminPageHeader
        title="Audit Log"
        subtitle={
          seesEverything
            ? `${total.toLocaleString("en-US")} recorded action${total === 1 ? "" : "s"}`
            : "Your own actions"
        }
        icon={ScrollText}
      />

      <form method="GET" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-text-faint">Search details</span>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="email, plan, reason" className="field h-8 w-56 px-2 text-[12.5px]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-text-faint">Action</span>
          <select name="action" defaultValue={sp.action ?? ""} className="field h-8 px-2 text-[12.5px]">
            <option value="">Any</option>
            {actionGroups.map((g) => (
              <option key={g.action} value={g.action}>{g.action} ({g._count})</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary h-8 px-3 text-[12.5px]">Filter</button>
        <Link href="/admin/audit" className="h-8 self-end px-2 text-[12.5px] text-text-faint no-underline hover:text-text-primary">
          Reset
        </Link>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-[13px] text-text-muted">
          Nothing matches this filter.
        </div>
      ) : (
        <div className={TABLE_WRAP}>
          <table className={TABLE}>
            <thead>
              <tr className={THEAD_ROW}>
                <th className={TH}>When</th>
                <th className={TH}>Action</th>
                <th className={TH}>By</th>
                <th className={TH}>Details</th>
                <th className={TH}>Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={TR}>
                  <td className={TD_MUTED}>{dateTime(r.createdAt)}</td>
                  <td className={TD}>
                    <Badge tone={HIGH_IMPACT.has(r.action) ? "bad" : "muted"}>{r.action}</Badge>
                  </td>
                  <td className={TD_MUTED}>{emailById.get(r.adminUserId) ?? r.adminUserId}</td>
                  <td className={TD}>
                    <span className="text-[12px] text-text-muted">{r.details ?? "—"}</span>
                  </td>
                  <td className={TD_MUTED}>
                    {r.targetUserId ? (
                      <Link href={`/admin/customers/${r.targetUserId}`} className="text-accent no-underline hover:underline">
                        account
                      </Link>
                    ) : r.targetWorkspaceId ? (
                      <span className="font-mono text-[11px]">workspace</span>
                    ) : "—"}
                  </td>
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
            {page > 1 && <PageLink sp={sp} page={page - 1}>← Previous</PageLink>}
            {page < pages && <PageLink sp={sp} page={page + 1}>Next →</PageLink>}
          </div>
        </div>
      )}
    </div>
  );
}

function PageLink({
  sp, page, children,
}: {
  sp: { action?: string; q?: string }; page: number; children: React.ReactNode;
}) {
  const q = new URLSearchParams();
  if (sp.action) q.set("action", sp.action);
  if (sp.q) q.set("q", sp.q);
  q.set("page", String(page));
  return (
    <Link href={`/admin/audit?${q.toString()}`} className="text-accent no-underline hover:underline">
      {children}
    </Link>
  );
}
