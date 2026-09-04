// lib/sheetFeed.ts
//
// بناءُ صفوف CSV لروابط تغذية الشيتات - في مكانٍ واحد يقرؤه المسارُ العام
// وصفحةُ اللوحة معاً، فلا يفترق ما يُعرَض عمّا يُصدَّر.

import { prisma } from "@/lib/prisma";

export const SHEET_DATASETS = ["sales", "customers"] as const;
export type SheetDataset = (typeof SHEET_DATASETS)[number];

export function isSheetDataset(v: unknown): v is SheetDataset {
  return typeof v === "string" && (SHEET_DATASETS as readonly string[]).includes(v);
}

export const DATASET_LABEL: Record<SheetDataset, string> = {
  sales: "Sales enquiries",
  customers: "Customers",
};

/** تهريبُ خليّةٍ واحدة. Google Sheets يقرأ CSV القياسيّ، فالاقتباس
 *  المزدوج هو ما يحمي الفاصلة والسطر الجديد داخل النصّ. */
function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: readonly string[], rows: unknown[][]): string {
  const lines = [header.join(",")];
  for (const r of rows) lines.push(r.map(cell).join(","));
  // 🔴 **بلا BOM هنا، بخلاف ملفّات التنزيل.**
  // إكسل محتاج البايتات دي ليقرأ العربي، لكنّ `IMPORTDATA` بيقراها
  // كمحارف في أوّل خليّة - فالعمودُ الأوّل يبقى اسمُه مشوَّهاً في كلّ شيت.
  return lines.join("\r\n");
}

const date = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export async function buildSheetCsv(dataset: SheetDataset): Promise<string> {
  if (dataset === "sales") {
    const rows = await prisma.salesEnquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 5_000,
      select: {
        company: true, name: true, email: true, phone: true, country: true,
        monthlySpend: true, adAccounts: true, status: true, message: true,
        createdAt: true, updatedAt: true,
        handledBy: { select: { name: true, email: true } },
      },
    });
    return toCsv(
      ["company", "name", "email", "phone", "country", "monthly_spend",
       "ad_accounts", "status", "handled_by", "message", "created", "updated"],
      rows.map((r) => [
        r.company, r.name, r.email, r.phone, r.country, r.monthlySpend,
        r.adAccounts, r.status, r.handledBy?.name ?? r.handledBy?.email ?? "",
        r.message, date(r.createdAt), date(r.updatedAt),
      ])
    );
  }

  // العملاء: أعمدةٌ مُعدَّدة صراحةً لا انعكاسٌ للجدول - الجدول فيه
  // هاشُ كلمة السرّ وسرُّ التحقّق بخطوتين وتوكناتٌ مشفّرة، وأيُّ تصديرٍ
  // «بكلّ الحقول» يخرج بها إلى شيتٍ لا يحرسه أحد.
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 5_000,
    select: {
      email: true, name: true, subscriptionPlan: true, subscriptionStatus: true,
      currentPeriodEnd: true, billingCountry: true, isSuspended: true,
      createdAt: true, lastActiveAt: true,
    },
  });
  return toCsv(
    ["email", "name", "plan", "status", "period_end", "country",
     "suspended", "signed_up", "last_active"],
    rows.map((r) => [
      r.email, r.name, r.subscriptionPlan, r.subscriptionStatus,
      date(r.currentPeriodEnd), r.billingCountry,
      r.isSuspended ? "yes" : "no", date(r.createdAt), date(r.lastActiveAt),
    ])
  );
}
