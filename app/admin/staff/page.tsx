// app/admin/staff/page.tsx
//
// أدوار الفريق - جدول صغير، مش مصفوفة صلاحيات.
//
// مستويان بس بقرار صريح: **مالك** (كل شيء بما فيه المال والصلاحيات) و
// **دعم** (يشوف ويساعد ويصلّح، بلا فلوس ولا صلاحيات ولا تصدير). مصفوفة
// صلاحيات كاملة لفريق من شخص أو اتنين تكلفتها الحقيقية إنّ حد بيغلط في
// خانة وياخد صلاحية ماكانتش مقصودة - والمستويان بيتقروا في ثانية.

import { ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { adminCapabilities, resolveAdminRole } from "@/lib/adminRole";
import { isOwnerEmail, OWNER_EMAIL } from "@/lib/owner";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TR, TD, TD_MUTED } from "@/app/components/ui/tableStyles";
import { AdminAction } from "../components/AdminAction";
import { AdminPageHeader, Badge, Card, SectionTitle, shortDate } from "../components/AdminUI";
import { GrantAccessForm } from "./GrantAccessForm";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  // بريد المالك بيدخل اللوحة من غير ما `isAdmin` يبقى متظبّط - `resolveAdminRole`
  // بيرجّعه OWNER بالبريد وحده. استعلام على الحقل لوحده كان بيرسم جدول فاضي
  // لصاحب اللوحة وهو واقف فيها، وبالتالي بيعدّ صفر ملّاك ويقفل زرار التنزيل غلط.
  const staff = await prisma.user.findMany({
    where: { OR: [{ isAdmin: true }, { email: { equals: OWNER_EMAIL, mode: "insensitive" } }] },
    select: {
      id: true, email: true, name: true, adminRole: true, isAdmin: true,
      mfaEnabled: true, lastLoginAt: true, createdAt: true, isSuspended: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const owners = staff.filter((s) => resolveAdminRole(s) === "OWNER").length;

  return (
    <div>
      <AdminPageHeader
        title="Staff"
        subtitle={`${staff.length} account${staff.length === 1 ? "" : "s"} with panel access`}
        icon={ShieldCheck}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card>
          <SectionTitle>Owner</SectionTitle>
          <p className="m-0 text-[12.5px] leading-relaxed text-text-muted">
            Everything: entitlement overrides, custom pricing, gifting and extending subscriptions, customer email,
            CSV export, feature flags, financial analytics, and role changes.
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {adminCapabilities("OWNER").map((c) => <Badge key={c} tone="muted">{c}</Badge>)}
          </div>
        </Card>
        <Card>
          <SectionTitle>Support</SectionTitle>
          <p className="m-0 text-[12.5px] leading-relaxed text-text-muted">
            Can see accounts, impersonate, suspend, annotate, re-sync, read non-financial analytics and handle the
            support inbox. Cannot touch money, roles, flags — or export the customer list.
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {adminCapabilities("SUPPORT").map((c) => <Badge key={c} tone="muted">{c}</Badge>)}
          </div>
        </Card>
      </div>

      <GrantAccessForm />

      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr className={THEAD_ROW}>
              <th className={TH}>Account</th>
              <th className={TH}>Role</th>
              <th className={TH}>2FA</th>
              <th className={TH}>Last login</th>
              <th className={TH}>Change to</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const role = resolveAdminRole(s);
              const locked = isOwnerEmail(s.email);
              // آخر مالك مايتنزّلش - نفس القاعدة المطبَّقة في المسار،
              // والزرّ بيتشال هنا كمان عشان مايتدوسش ويرجع خطأ.
              const isLastOwner = role === "OWNER" && owners <= 1;
              return (
                <tr key={s.id} className={TR}>
                  <td className={TD}>
                    <div>{s.name ?? s.email.split("@")[0]}</div>
                    <div className="text-[11px] text-text-faint">{s.email}</div>
                  </td>
                  <td className={TD}>
                    <Badge tone={role === "OWNER" ? "bad" : "info"}>{role ?? "none"}</Badge>
                    {locked && <div className="mt-0.5 text-[10.5px] text-text-faint">OWNER_EMAIL — fixed</div>}
                    {s.isSuspended && <div className="mt-0.5"><Badge tone="bad">suspended</Badge></div>}
                  </td>
                  <td className={TD}>
                    {s.mfaEnabled
                      ? <Badge tone="ok">on</Badge>
                      : <Badge tone="bad">off — cannot enter the panel</Badge>}
                  </td>
                  <td className={TD_MUTED}>{s.lastLoginAt ? shortDate(s.lastLoginAt) : "never"}</td>
                  <td className={TD}>
                    {locked ? (
                      <span className="text-[11.5px] text-text-faint">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {role !== "OWNER" && (
                          <AdminAction
                            url={`/api/admin/staff/${s.id}/role`}
                            body={{ role: "OWNER" }}
                            label="Owner"
                            confirmLabel="Grant full access?"
                            icon="ShieldAlert"
                            tone="danger"
                            size="sm"
                            needsElevation
                          />
                        )}
                        {role !== "SUPPORT" && !isLastOwner && (
                          <AdminAction
                            url={`/api/admin/staff/${s.id}/role`}
                            body={{ role: "SUPPORT" }}
                            label="Support"
                            confirmLabel="Limit to support?"
                            icon="ShieldCheck"
                            size="sm"
                            needsElevation
                          />
                        )}
                        {!isLastOwner && (
                          <AdminAction
                            url={`/api/admin/staff/${s.id}/role`}
                            body={{ role: "NONE" }}
                            label="Revoke"
                            confirmLabel="Remove all access?"
                            icon="ShieldOff"
                            tone="danger"
                            size="sm"
                            needsElevation
                          />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-text-faint">
        Two-factor authentication is required to enter the panel, so a role cannot be granted to an account that has not
        enabled it. Changing a role signs that account out everywhere immediately — a demotion that only applies after
        the current 30-day session expires is not a demotion. The last owner cannot be demoted, and the account matching
        OWNER_EMAIL is always an owner regardless of this table.
      </p>
    </div>
  );
}
