// app/api/admin/backup/restore/route.ts - استعادةٌ تُضيف ولا تكتب فوق
//
// 🔴 **الاستعادةُ الوحيدة الآمنة هي التي لا تستطيع أن تُتلف شيئاً.**
//
// استعادةٌ تكتب فوق الموجود سلاحٌ بحدّين: تُصلِح قاعدةً فارغة، وتمحو
// قاعدةً عاملة إن ضُغط الزرُّ في اللحظة الخطأ - وهي لحظةٌ يُضغط فيها
// الزرّ تحت ضغطٍ ونصفُ معلومة. فكلُّ إدراجٍ هنا `skipDuplicates`: الصفُّ
// الموجود يُترك كما هو، والغائبُ وحده يُضاف.
//
// ولذلك المعنى الدقيق: **«املأ الناقص»** لا «ارجع بالزمن». وهو المطلوب
// فعلاً بعد قاعدةٍ جديدة فارغة.
//
// وتعمل على دفعات: `createMany` بعشرين ألف صفٍّ دفعةً واحدة تتجاوز حدود
// البارامترات في بوستجرس وتفشل كلُّها.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { validateOrError } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  url: z.string().url(),
  /** تأكيدٌ صريح بالكلمة - زرٌّ وحده لا يكفي لفعلٍ يكتب في كلّ جدول. */
  confirm: z.literal("RESTORE"),
});

const CHUNK = 500;

/** الترتيب مقصود: الأبُ قبل الابن، وإلّا رفض المفتاحُ الأجنبيّ الصفَّ
 *  اليتيم. والمفاتيحُ هي أسماء الحقول في ملفّ النسخة نفسه. */
const ORDER: Array<{ key: string; model: string }> = [
  { key: "users", model: "user" },
  { key: "workspaces", model: "workspace" },
  { key: "connectedPlatforms", model: "connectedPlatform" },
  { key: "members", model: "workspaceMember" },
  { key: "invites", model: "workspaceInvite" },
  { key: "campaignLinks", model: "campaignLink" },
  { key: "valueConfigs", model: "conversionValueConfig" },
  { key: "verifications", model: "conversionVerification" },
  { key: "products", model: "product" },
  { key: "productSales", model: "productSaleEvent" },
  { key: "customers", model: "customer" },
  { key: "orders", model: "order" },
  { key: "competitors", model: "competitor" },
  { key: "competitorAds", model: "competitorAd" },
  { key: "automationRules", model: "automationRule" },
  { key: "savedViews", model: "savedView" },
  { key: "reportViews", model: "savedReportView" },
  { key: "threads", model: "supportThread" },
  { key: "messages", model: "supportMessage" },
  { key: "notes", model: "supportNote" },
  { key: "ratings", model: "supportRating" },
  { key: "salesEnquiries", model: "salesEnquiry" },
  { key: "payments", model: "paymentIntent" },
  { key: "subscriptionEvents", model: "subscriptionEvent" },
  { key: "auditLog", model: "adminAuditLog" },
];

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req, { capability: "system.view", mutating: true, elevated: true });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  // الرابطُ لا بدّ أن يكون من مخزننا: قبولُ أيّ رابطٍ يعني أنّ من يبلغ
  // هذا المسار يستطيع حقنَ صفوفٍ من ملفٍّ يكتبه بنفسه.
  if (!/^https:\/\/[\w.-]+\.(?:public\.)?blob\.vercel-storage\.com\//.test(validation.data.url)) {
    return NextResponse.json({ error: "that file is not one of our backups" }, { status: 400 });
  }

  const res = await fetch(validation.data.url).catch(() => null);
  if (!res?.ok) return NextResponse.json({ error: "could not read the backup file" }, { status: 400 });

  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object" || data.format !== 2) {
    return NextResponse.json({ error: "unrecognised backup format" }, { status: 400 });
  }

  const inserted: Record<string, number> = {};
  const failed: string[] = [];

  for (const { key, model } of ORDER) {
    const rows = Array.isArray(data[key]) ? (data[key] as Record<string, unknown>[]) : [];
    if (rows.length === 0) continue;

    let count = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const delegate = (prisma as any)[model];
        const out = await delegate.createMany({ data: chunk, skipDuplicates: true });
        count += out.count;
      } catch {
        // جدولٌ يفشل لا يوقف الباقي: استعادةٌ جزئية أفضل من لا شيء، بشرط
        // أن يُقال أيُّ جدولٍ سقط بدل أن يُظنّ الكلُّ ناجحاً.
        if (!failed.includes(key)) failed.push(key);
      }
    }
    inserted[key] = count;
  }

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "BACKUP_RESTORE",
    details: `${guard.admin.email} restored from ${validation.data.url} — inserted ${JSON.stringify(inserted)}${failed.length ? ` — failed: ${failed.join(", ")}` : ""}`,
  });

  return NextResponse.json({ ok: true, inserted, failed });
}
