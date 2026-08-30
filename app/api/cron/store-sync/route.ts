// app/api/cron/store-sync/route.ts
//
// **مزامنة يومية لما تملكه منصّة المتجر: المنتجات وأسعارها ومخزونها،
// ثمّ تكلفة البضاعة حيث تُتاح.**
//
// لماذا كرون لا ويب هوك: الطلب حدثٌ يقع مرّة فيُرسَل، أمّا سعرُ منتجٍ
// عُدِّل في لوحة المتجر ومخزونٌ نقص مع كلّ بيعٍ فحالةٌ تتغيّر بلا حدثٍ
// تُرسله المنصّات. راجع رأس `lib/ecommerce/productSync.ts`.
//
// وكلّ مساحة داخل `try` مستقلّ: متجرٌ واحدٌ يُعيد ٥٠٣ لا يجوز أن يمنع
// بقيّة الحسابات من التحديث - وهو الخطأ الشائع في مهامّ الكرون الجماعية.
//
// **مساحات العرض تُستثنى صراحةً:** بياناتها مبذورة لا مسحوبة، وأيّ نداءٍ
// خارجيّ منها مخالفٌ لحارس الديمو.

import { NextRequest } from "next/server";
import { denyUnlessCron } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";
import { ownerNotSuspended } from "@/lib/accountActive";
import { finishCronRun } from "@/lib/cronRun";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = denyUnlessCron(req);
  if (denied) return denied;

  const startedAt = Date.now();

  // المساحات التي لها متجرٌ نشطٌ فعلاً - لا كلّ المساحات
  const workspaces = await prisma.workspace.findMany({
    // حسابٌ معلَّق لا تُسحَب طلباته ولا تكاليفه - راجع `lib/accountActive.ts`.
    where: { isDemo: false, ecommerceConnections: { some: { active: true } }, ...ownerNotSuspended },
    select: { id: true },
  });

  const { syncProductsForWorkspace } = await import("@/lib/ecommerce/productSync");
  const { syncCostsFromStore } = await import("@/lib/ecommerce/costSync");

  const results: Array<{
    workspaceId: string;
    created?: number;
    updated?: number;
    skipped?: number;
    costsUpdated?: number;
    error?: string;
  }> = [];

  for (const workspace of workspaces) {
    const entry: (typeof results)[number] = { workspaceId: workspace.id };
    try {
      const runs = await syncProductsForWorkspace(workspace.id);
      entry.created = runs.reduce((s, r) => s + r.created, 0);
      entry.updated = runs.reduce((s, r) => s + r.updated, 0);
      entry.skipped = runs.reduce((s, r) => s + r.skipped, 0);
      // سببُ أوّل متجرٍ فشل - مفتاحاً لا جملة، فالسجلّ يُقرأ بأيّ لغة
      const failed = runs.find((r) => !r.ok);
      if (failed?.reasonKey) entry.error = failed.reasonKey;
    } catch (err) {
      entry.error = err instanceof Error ? err.message.slice(0, 160) : "unknown";
    }

    // التكلفة بعد المنتجات لا قبلها: تُطابَق بالـSKU، والسحب أعلاه هو ما
    // يجلب الـSKU أصلاً. عكسُ الترتيب يجعل أوّل يومٍ بلا تكلفة دائماً.
    try {
      const cost = await syncCostsFromStore(workspace.id);
      entry.costsUpdated = cost.updated;
    } catch {
      // التكلفة ليست متاحةً عند ثلاثٍ من الخمس أصلاً - فشلها لا يُفشل الدورة
    }

    results.push(entry);
  }

  // الرمز يتبع النتيجة لا مجرّد بلوغ آخر السطر: متجرٌ فشل يجب أن يظهر في
  // لوحة الكرون، لا أن يُخبَّأ داخل `200` مع مصفوفة أخطاء لا يقرؤها أحد.
  const failed = results.filter((r) => r.error).length;
  return finishCronRun(
    {
      job: "store-sync",
      total: results.length,
      succeeded: results.length - failed,
      failed,
      startedAt,
      errors: results.filter((r) => r.error).map((r) => ({ workspaceId: r.workspaceId, error: r.error })),
    },
    { results }
  );
}
