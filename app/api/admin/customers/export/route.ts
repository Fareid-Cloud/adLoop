// app/api/admin/customers/export/route.ts
//
// تصدير CSV بنفس الفلتر المعروض على الشاشة.
//
// **محصور في OWNER** بخلاف عرض القائمة نفسها: مئة فتحة صفحة أثر بسيط،
// وملفّ واحد فيه قاعدة العملاء كلها بيمشي بره النظام مرّة واحدة - وده
// النوع اللي بيتسرّب فعلاً. والأعمدة قائمة صريحة في
// `lib/admin/customers.ts` مش انعكاس لكل حقل في الجدول.

import { NextRequest, NextResponse } from "next/server";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { exportCustomers, parseCustomerFilters, toCsv } from "@/lib/admin/customers";

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req, { capability: "customers.export" });
  if (!guard.ok) return guard.response;

  const filters = parseCustomerFilters(req.nextUrl.searchParams);
  const rows = await exportCustomers(filters);

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "EXPORT_CUSTOMERS",
    details: `${guard.admin.email} exported ${rows.length} rows — filters ${JSON.stringify(filters)}`,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="adloop-customers-${stamp}.csv"`,
      // ملفّ فيه بيانات عملاء مايتخزّنش في أي وسيط
      "cache-control": "no-store",
    },
  });
}
