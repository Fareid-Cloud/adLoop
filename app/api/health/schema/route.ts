// app/api/health/schema/route.ts
//
// فحص تطابق قاعدة البيانات مع ما يتوقّعه الكود. الغرض تشخيصي بحت: عند
// ظهور "حدث خطأ غير متوقع" في كل الصفحات، السبب الأشيع هو عمود أو جدول
// جديد لم يُنشأ بعد في قاعدة الإنتاج - وبدون هذه النقطة لا توجد أي وسيلة
// لمعرفة **أيّ** عمود بالضبط دون الوصول إلى سجلات الخادم.
//
// آمن للعرض: لا يكشف أي بيانات، فقط أسماء جداول وأعمدة يعرفها المخطط
// أصلاً، ولا يعمل إلا لمستخدم مسجَّل دخوله.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

/** الأعمدة والجداول التي أُضيفت مؤخراً - أكثر ما يُرجَّح غيابه. */
const EXPECTED: Array<{ table: string; columns: string[] }> = [
  { table: "Workspace", columns: ["pauseAdsOnOutOfStock", "monthlyChangeCeilingPct", "profitMarginPct"] },
  { table: "Product", columns: [
    "sku", "stockQuantity", "lowStockThreshold", "stockUpdatedAt", "stockSource",
    "packagingCost", "handlingCost", "codFeePct", "restockingLossPct",
    "externalProductId", "externalVariantId",
  ] },
  { table: "MonitoredPage", columns: ["detectedSystems", "adloopDetected", "auditResult"] },
  { table: "AutomationRule", columns: ["platform", "appliesTo", "specificCampaignIds"] },
  { table: "ExperimentLog", columns: [
    "trackedMetrics", "metricResults", "source", "status", "platform",
    "note", "windowDays", "measuredAt", "sourceActionId",
  ] },
  { table: "ActionFeedItem", columns: ["actionType", "actionPayload", "read"] },
  { table: "EcommerceConnection", columns: [
    "platform", "webhookSecret", "apiToken", "apiSecret", "storeIdentifier", "canWritePrices",
  ] },
];

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const missingTables: string[] = [];
  const missingColumns: Array<{ table: string; column: string }> = [];
  let dbReachable = true;
  let dbError: string | null = null;

  try {
    // أسماء الأعمدة الفعلية من الكتالوج - المصدر الوحيد الموثوق.
    //
    // بقالبٍ موسوم (`$queryRaw`) لا `$queryRawUnsafe`: الاستعلام اليوم بلا
    // متغيّرات فلا فرق أمنيّ بينهما الآن، لكنّ الاسم `Unsafe` دعوةٌ لأوّل
    // من يضيف متغيّراً بالدمج النصّي. والقالب الموسوم يمنعه بالبناء لا
    // بالانتباه.
    const rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
    `;

    const actual = new Map<string, Set<string>>();
    for (const r of rows) {
      const t = actual.get(r.table_name) ?? new Set<string>();
      t.add(r.column_name);
      actual.set(r.table_name, t);
    }

    for (const exp of EXPECTED) {
      const cols = actual.get(exp.table);
      if (!cols) {
        missingTables.push(exp.table);
        continue;
      }
      for (const c of exp.columns) {
        if (!cols.has(c)) missingColumns.push({ table: exp.table, column: c });
      }
    }
  } catch (err) {
    dbReachable = false;
    dbError = err instanceof Error ? err.message.slice(0, 300) : "خطأ غير معروف";
  }

  const inSync = dbReachable && missingTables.length === 0 && missingColumns.length === 0;

  return NextResponse.json({
    inSync,
    dbReachable,
    dbError,
    missingTables,
    missingColumns,
    summaryAr: !dbReachable
      ? `تعذّر الوصول إلى قاعدة البيانات: ${dbError}`
      : inSync
      ? "قاعدة البيانات متطابقة مع الكود بالكامل."
      : `قاعدة البيانات ناقصة: ${missingTables.length} جدول و${missingColumns.length} عمود. شغّل: npx prisma db push`,
  });
}
