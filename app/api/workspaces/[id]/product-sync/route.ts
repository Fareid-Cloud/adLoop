// app/api/workspaces/[id]/product-sync/route.ts
//
// **سحبٌ فوريّ للمنتجات من متاجر المساحة** - نفس ما يفعله الكرون ليلاً،
// بيد المستخدم.
//
// وهو ليس ترفاً: من يربط متجره الآن لا يقبل أن ينتظر إلى الغد ليرى
// منتجاته، ويقرأ الصفحةَ الفارغة عطلاً في الربط لا انتظاراً لدورة.

import { NextRequest, NextResponse } from "next/server";
import { workspaceWriteFilter } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { syncProductsForWorkspace } from "@/lib/ecommerce/productSync";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // الملكية أوّلاً: المعرّف يصل من العميل، فلا يُقرأ منه شيءٌ قبل إثباتها.
  const workspace = await prisma.workspace.findFirst({
    where: { id, ...workspaceWriteFilter(user.id) },
    select: { id: true, isDemo: true },
  });
  if (!workspace) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // حارس العرض: مساحةٌ تجريبية لا تُجري نداءً خارجياً بحال.
  if (workspace.isDemo) {
    return NextResponse.json({ error: "demo" }, { status: 400 });
  }

  const runs = await syncProductsForWorkspace(id);

  return NextResponse.json({
    ok: runs.some((r) => r.ok),
    stores: runs.length,
    created: runs.reduce((s, r) => s + r.created, 0),
    updated: runs.reduce((s, r) => s + r.updated, 0),
    skipped: runs.reduce((s, r) => s + r.skipped, 0),
    // كلّ متجرٍ وسببه - «فشل» بلا تحديد أيّ متجرٍ فشل لا يُصلَح به شيء
    stores_detail: runs.map((r) => ({
      storeName: r.storeName ?? null,
      platform: r.platform ?? null,
      ok: r.ok,
      created: r.created,
      updated: r.updated,
      reasonKey: r.reasonKey ?? null,
      reasonVars: r.reasonVars ?? null,
    })),
  });
}
