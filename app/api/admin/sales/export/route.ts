// app/api/admin/sales/export/route.ts - تصديرُ طابور المبيعات CSV
//
// **CSV لا Google Sheets.** الشيتُ اللي بيتحدّث لوحده محتاج تكاملَ OAuth
// ومعرَّفَ ملفٍّ ومزامنةً ليها مسارُ فشلٍ صامت خاصٌّ بيها؛ وملفٌّ بيتنزّل
// محدَّثاً في اللحظة بيدّي نفس النتيجة العملية بلا أيّ من ده. وإكسل بيفتح
// الـCSV مباشرةً.
//
// **مقصورٌ على مَن يقدر يمنح باقة** (`customers.subscription`) - نفس
// صلاحية الطابور نفسه. وبيتسجّل في سجلّ التدقيق زيّ تصدير العملاء: ملفٌّ
// واحد فيه بيانات تواصل الليدز كلها بيمشي بره النظام مرّةً واحدة، وده
// النوع اللي بيتسرّب فعلاً.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { isEnquiryStatus } from "@/lib/salesEnquiry";

const COLUMNS = [
  "company", "name", "email", "phone", "country",
  "monthly_spend", "ad_accounts", "status", "handled_by",
  "internal_note", "message", "created", "updated",
] as const;

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req, { capability: "customers.subscription" });
  if (!guard.ok) return guard.response;

  const statusParam = req.nextUrl.searchParams.get("status");
  const status = isEnquiryStatus(statusParam) ? statusParam : null;

  const rows = await prisma.salesEnquiry.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    select: {
      company: true, name: true, email: true, phone: true, country: true,
      monthlySpend: true, adAccounts: true, status: true, internalNote: true,
      message: true, createdAt: true, updatedAt: true,
      handledBy: { select: { name: true, email: true } },
    },
  });

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "EXPORT_SALES_ENQUIRIES",
    details: `${guard.admin.email} exported ${rows.length} rows — status ${status ?? "all"}`,
  });

  const lines = [COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.company, r.name, r.email, r.phone, r.country,
        r.monthlySpend, r.adAccounts, r.status,
        r.handledBy?.name ?? r.handledBy?.email ?? "",
        r.internalNote, r.message,
        r.createdAt.toISOString().slice(0, 10),
        r.updatedAt.toISOString().slice(0, 10),
      ].map(esc).join(",")
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  // BOM عشان إكسل يقرا العربي صح - من غيره أيُّ اسمٍ عربيّ بيتقري رموز.
  return new NextResponse(`﻿${lines.join("\r\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="adloop-sales-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
