// app/admin/sheets/page.tsx - روابط تغذية Google Sheets
//
// **شيتٌ حيّ بلا تكامل.** دالّة `IMPORTDATA` تسحب من رابط CSV وتحدّث
// نفسها دورياً، فالنتيجة شيتٌ يبقى محدَّثاً بلا OAuth ولا مشروع Google
// Cloud ولا مزامنةٍ نكتبها ونصونها ولها مسارُ فشلٍ صامت خاصّ بها.
//
// الصلاحية `customers.export`: رابطٌ واحد يخرج بقاعدة العملاء كلّها.

import { redirect } from "next/navigation";
import { Table2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { resolveAdminRole, adminCapabilities } from "@/lib/adminRole";
import { getAppUrl } from "@/lib/appUrl";
import { DATASET_LABEL, isSheetDataset } from "@/lib/sheetFeed";
import { AdminPageHeader, Card, Badge, dateTime, ago } from "../components/AdminUI";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TR, TD, TD_MUTED } from "@/app/components/ui/tableStyles";
import { SheetFeedClient, RevokeButton } from "./SheetFeedClient";

export const dynamic = "force-dynamic";

export default async function AdminSheetsPage() {
  const user = await getSessionUserFromCookies();
  const caps = adminCapabilities(resolveAdminRole(user));
  if (!caps.includes("customers.export")) redirect("/admin");

  const feeds = await prisma.sheetFeed.findMany({
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true, label: true, dataset: true, revokedAt: true,
      lastReadAt: true, readCount: true, createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });

  return (
    <div>
      <AdminPageHeader
        title="Sheet feeds"
        subtitle="A live Google Sheet without an integration — the sheet pulls, we do not push"
        icon={Table2}
      />

      <SheetFeedClient origin={getAppUrl()} />

      <div className="mt-4">
        {feeds.length === 0 ? (
          <Card>
            <p className="m-0 text-[13px] text-text-muted">
              No links yet. Create one above, paste the formula into a cell, and the sheet keeps
              itself current.
            </p>
          </Card>
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Name</th>
                  <th className={TH}>Data</th>
                  <th className={TH}>Reads</th>
                  <th className={TH}>Last read</th>
                  <th className={TH}>Created</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody>
                {feeds.map((f) => (
                  <tr key={f.id} className={`${TR} ${f.revokedAt ? "opacity-55" : ""}`}>
                    <td className={TD}>
                      {f.label}
                      {f.revokedAt && (
                        <span className="ms-2"><Badge tone="muted">revoked</Badge></span>
                      )}
                    </td>
                    <td className={TD_MUTED}>
                      {isSheetDataset(f.dataset) ? DATASET_LABEL[f.dataset] : f.dataset}
                    </td>
                    {/* عدّادُ القراءات هو ما يكشف رابطاً مسرَّباً: قفزةٌ فيه
                        بلا سببٍ تسبق أيّ دليلٍ آخر بأيام. */}
                    <td className={TD}>{f.readCount}</td>
                    <td className={TD_MUTED}>{f.lastReadAt ? ago(f.lastReadAt) : "never"}</td>
                    <td className={TD_MUTED}>
                      {dateTime(f.createdAt)}
                      <span className="ms-1.5 text-text-faint">
                        · {f.createdBy?.name ?? f.createdBy?.email ?? ""}
                      </span>
                    </td>
                    <td className={TD}>{!f.revokedAt && <RevokeButton id={f.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
