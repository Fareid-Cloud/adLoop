// app/admin/sales/page.tsx - طابورُ طلبات الباقة الاتفاقية
//
// **طابورٌ لا صندوق.** التذكرةُ بتتقفل بالردّ؛ الطلبُ ده بيعدّي بحالات
// (جديد → اتّصلنا → رَبِح/خسر)، وبيفضل مفتوحاً أسابيع. حطُّه في صندوق
// الدعم كان بيخلّي «اتّصلنا وبنستنّى ردّه» تبان تذكرةً مهمَلة.
//
// الصلاحية: `customers.subscription` - اللي يقدر يمنح باقةً هو اللي
// المفروض يشوف مين طالبها. مش `support.handle`.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Mail, Phone, ExternalLink, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { resolveAdminRole, adminCapabilities } from "@/lib/adminRole";
import { ENQUIRY_STATUSES } from "@/lib/salesEnquiry";
import { AdminPageHeader, Card, Badge, dateTime, type BadgeTone } from "../components/AdminUI";
import { EnquiryRow } from "./EnquiryRow";

export const dynamic = "force-dynamic";

const SPEND_LABEL: Record<string, string> = {
  under_10k: "Under $10k/mo",
  "10k_50k": "$10k–50k/mo",
  "50k_200k": "$50k–200k/mo",
  over_200k: "Over $200k/mo",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  NEW: "info", CONTACTED: "warn", WON: "ok", LOST: "muted",
};

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const user = await getSessionUserFromCookies();
  const caps = adminCapabilities(resolveAdminRole(user));
  if (!caps.includes("customers.subscription")) redirect("/admin");

  const status = (ENQUIRY_STATUSES as readonly string[]).includes(sp.status ?? "")
    ? sp.status!
    : null;

  const [rows, counts] = await Promise.all([
    prisma.salesEnquiry.findMany({
      where: status ? { status } : {},
      // الجديدُ فوق دايماً بلا علاقةٍ بالفلتر: الطلبُ اللي لسه ما اتردّش
      // عليه هو الوحيد اللي وقتُه بيجري.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true, company: true, name: true, email: true, phone: true, country: true,
        monthlySpend: true, adAccounts: true, message: true, status: true,
        internalNote: true, createdAt: true, handledAt: true,
        userId: true,
        handledBy: { select: { name: true, email: true } },
      },
    }),
    prisma.salesEnquiry.groupBy({ by: ["status"], _count: true }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const c of counts) byStatus[c.status] = c._count;

  return (
    <div>
      <AdminPageHeader
        title="Sales enquiries"
        subtitle="Enterprise requests — priced on a call, granted from the customer's page"
        icon={Briefcase}
        actions={
          rows.length > 0 ? (
            // ملفٌّ بيتنزّل محدَّثاً في اللحظة - إكسل بيفتحه مباشرةً.
            // وبيحمل الفلترَ المعروض عشان اللي على الشاشة هو اللي بينزل.
            <a
              href={`/api/admin/sales/export${status ? `?status=${status}` : ""}`}
              className="flex items-center gap-1.5 rounded-lg border border-border-visible px-2.5 py-1.5 text-[12.5px] text-text-muted no-underline transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              <Download size={14} /> Export CSV
            </a>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1">
        <Link
          href="/admin/sales"
          className={`rounded-lg px-2.5 py-1 text-[12.5px] no-underline transition-colors ${
            !status ? "bg-critical/12 text-critical" : "text-text-muted hover:bg-surface-raised"
          }`}
        >
          All
        </Link>
        {ENQUIRY_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/sales?status=${s}`}
            className={`rounded-lg px-2.5 py-1 text-[12.5px] no-underline transition-colors ${
              status === s ? "bg-critical/12 text-critical" : "text-text-muted hover:bg-surface-raised"
            }`}
          >
            {s[0] + s.slice(1).toLowerCase()}
            {(byStatus[s] ?? 0) > 0 && (
              <span className="ms-1.5 tabular-nums text-text-faint">{byStatus[s]}</span>
            )}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="m-0 text-[13px] text-text-muted">
            Nothing here. Enterprise requests arrive from the “Contact sales” button on the plans page.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-text-primary">{r.company}</span>
                    <Badge tone={STATUS_TONE[r.status] ?? "muted"}>{r.status.toLowerCase()}</Badge>
                    {r.monthlySpend && (
                      <Badge tone="muted">{SPEND_LABEL[r.monthlySpend] ?? r.monthlySpend}</Badge>
                    )}
                    {r.adAccounts ? <Badge tone="muted">{r.adAccounts} accounts</Badge> : null}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-muted">
                    <span>{r.name}</span>
                    {/* روابطُ اتّصالٍ حقيقية: نسخُ البريد باليد من شاشةٍ
                        خطوةٌ بتتعمل عشرين مرّةً في اليوم بلا سبب. */}
                    <a href={`mailto:${r.email}`} className="flex items-center gap-1 no-underline hover:text-text-primary" dir="ltr">
                      <Mail size={12} /> {r.email}
                    </a>
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="flex items-center gap-1 no-underline hover:text-text-primary" dir="ltr">
                        <Phone size={12} /> {r.phone}
                      </a>
                    )}
                    <span className="text-text-faint">{dateTime(r.createdAt)}</span>
                  </div>

                  {r.message && (
                    <p className="m-0 mt-2 max-w-2xl whitespace-pre-wrap text-[12.5px] text-text-primary">
                      {r.message}
                    </p>
                  )}
                </div>

                {/* الطريقُ من الطلب للمنح: صاحبُ الطلب لو له حساب، الصفحةُ
                    اللي فيها زرارُ «Gift plan» على بُعد دوسة. */}
                {r.userId && (
                  <Link
                    href={`/admin/customers/${r.userId}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-visible px-2.5 py-1.5 text-[12px] text-text-muted no-underline transition-colors hover:bg-surface-raised hover:text-text-primary"
                  >
                    Open account <ExternalLink size={12} />
                  </Link>
                )}
              </div>

              <EnquiryRow
                id={r.id}
                status={r.status}
                note={r.internalNote ?? ""}
                handledBy={r.handledBy?.name ?? r.handledBy?.email ?? null}
                handledAt={r.handledAt ? dateTime(r.handledAt) : null}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
