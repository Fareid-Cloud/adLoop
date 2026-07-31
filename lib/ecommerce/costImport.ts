// lib/ecommerce/costImport.ts
//
// استيراد/تصدير تكلفة البضاعة بملف CSV.
//
// ثلاث من المنصات الخمس لا تُعرّض التكلفة إطلاقاً (زد، ووكومرس، إيزي
// أوردرز)، ومن يستخدمها لا سبيل أمامه سوى الإدخال اليدوي - وهو مستحيل
// عملياً عند مئتي منتج، فيبقى قسم التسعير كله معطَّلاً عنده.
//
// التصدير يخرج بالمنتجات وتكلفتها الحالية، فيملأ التاجر عموداً واحداً
// ويعيده. لا نطلب منه بناء ملف من الصفر ولا تذكّر ترتيب الأعمدة.

import { prisma } from "@/lib/prisma";

export interface CostImportRow {
  sku: string;
  cogs: number;
}

export interface CostImportResult {
  updated: number;
  /** أسطر لا يقابلها منتج بهذا الـSKU */
  unmatched: string[];
  /** أسطر تعذّرت قراءتها - يُعاد رقم السطر ليصلحه المستخدم بدقّة */
  invalid: number[];
  totalRows: number;
}

/**
 * محلّل CSV مصغَّر يحترم الاقتباس المزدوج. لا نستورد مكتبة كاملة لملف
 * من عمودين، ولا نقسّم بالفاصلة مباشرةً لأن أسماء المنتجات تحوي فواصل.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // BOM من Excel يلتصق بأول ترويسة فلا تُطابَق أبداً
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    if (c === "\r") continue;
    field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * يقبل الترويسة بالعربية أو الإنجليزية، وبأي ترتيب أعمدة. التاجر يفتح
 * الملف في Excel عربي فتُترجَم الترويسة أحياناً - رفض الملف حينها عقاب
 * على شيء لم يفعله.
 */
const SKU_HEADERS = ["sku", "رمز", "الرمز", "sku/رمز"];
const COST_HEADERS = ["cogs", "cost", "التكلفة", "تكلفة", "cost_price"];

export function extractRows(csv: string): { rows: CostImportRow[]; invalid: number[] } {
  const table = parseCsv(csv);
  if (table.length === 0) return { rows: [], invalid: [] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const skuIdx = header.findIndex((h) => SKU_HEADERS.includes(h));
  const costIdx = header.findIndex((h) => COST_HEADERS.includes(h));

  // بلا ترويسة معروفة نفترض عمودين بالترتيب - أفضل من رفض الملف كلّه
  const sIdx = skuIdx >= 0 ? skuIdx : 0;
  const cIdx = costIdx >= 0 ? costIdx : 1;
  const startRow = skuIdx >= 0 || costIdx >= 0 ? 1 : 0;

  const rows: CostImportRow[] = [];
  const invalid: number[] = [];

  for (let i = startRow; i < table.length; i++) {
    const sku = (table[i][sIdx] ?? "").trim();
    const rawCost = (table[i][cIdx] ?? "").trim().replace(/[^\d.-]/g, "");
    const cogs = Number(rawCost);
    if (!sku || rawCost === "" || Number.isNaN(cogs) || cogs < 0) {
      invalid.push(i + 1);
      continue;
    }
    rows.push({ sku, cogs });
  }
  return { rows, invalid };
}

export async function applyCostImport(
  workspaceId: string,
  csv: string
): Promise<CostImportResult> {
  const { rows, invalid } = extractRows(csv);

  const products = await prisma.product.findMany({
    where: { workspaceId, sku: { not: null } },
    select: { id: true, sku: true, cogs: true },
  });
  const bySku = new Map(products.map((p) => [p.sku!.trim().toLowerCase(), p]));

  let updated = 0;
  const unmatched: string[] = [];

  for (const row of rows) {
    const product = bySku.get(row.sku.toLowerCase());
    if (!product) { unmatched.push(row.sku); continue; }
    if (Math.abs(product.cogs - row.cogs) < 0.01) continue;

    await prisma.product.update({
      where: { id: product.id },
      data: { cogs: row.cogs, cogsLastUpdatedAt: new Date() },
    });
    updated++;
  }

  return { updated, unmatched: unmatched.slice(0, 50), invalid, totalRows: rows.length };
}

/** ملف جاهز للتعبئة - يخرج بما لدينا فلا يبدأ التاجر من ورقة فارغة */
export async function buildCostCsv(workspaceId: string): Promise<string> {
  const products = await prisma.product.findMany({
    where: { workspaceId },
    select: { name: true, sku: true, cogs: true, currentPrice: true },
    orderBy: { name: "asc" },
  });

  const esc = (v: string | number | null) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = ["sku,name,price,cogs"];
  for (const p of products) {
    lines.push([esc(p.sku), esc(p.name), esc(p.currentPrice), esc(p.cogs || "")].join(","));
  }
  // BOM حتى يقرأ Excel العربية بشكل صحيح بدل رموز مشوّهة
  return "﻿" + lines.join("\n");
}
