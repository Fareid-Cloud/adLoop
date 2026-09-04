// app/api/workspaces/[id]/order-backfill/route.ts
//
// **سحب الطلبات السابقة على الربط، بطلبٍ من المستخدم.**
//
// ليس كروناً: العملية تلمس تاريخ الحساب كلّه وتستغرق ما تستغرق، فتُبدأ
// بقرارٍ لا في الخلفية. وتُعيد ما جرى بالتفصيل - كم دخل وكم كان موجوداً
// وكم تغيّرت حالته - لأنّ «تمّ» وحدها لا تُطمئن مَن ينتظر تاريخه.

import { NextRequest, NextResponse } from "next/server";
import { workspaceWriteFilter } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { backfillOrdersForWorkspace } from "@/lib/ecommerce/orderBackfill";

/** نوافذ مسموحة - رقمٌ حرٌّ من العميل يفتح بابَ سحبٍ بلا نهاية */
const ALLOWED_WINDOWS = [30, 90, 180, 365];

export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({
    where: { id, ...workspaceWriteFilter(user.id) },
    select: { id: true, isDemo: true },
  });
  if (!workspace) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (workspace.isDemo) return NextResponse.json({ error: "demo" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const windowDays = ALLOWED_WINDOWS.includes(Number(body?.windowDays))
    ? Number(body.windowDays)
    : 90;

  const runs = await backfillOrdersForWorkspace(id, windowDays);

  return NextResponse.json({
    ok: runs.some((r) => r.ok),
    windowDays,
    imported: runs.reduce((s, r) => s + r.imported, 0),
    duplicates: runs.reduce((s, r) => s + r.duplicates, 0),
    updated: runs.reduce((s, r) => s + r.updated, 0),
    unreadable: runs.reduce((s, r) => s + r.unreadable, 0),
    // يُقال صراحةً حين يبقى تاريخٌ أقدم لم يُسحب
    reachedCap: runs.some((r) => r.reachedCap),
    stores_detail: runs.map((r) => ({
      storeName: r.storeName ?? null,
      platform: r.platform ?? null,
      ok: r.ok,
      imported: r.imported,
      updated: r.updated,
      reasonKey: r.reasonKey ?? null,
      reasonVars: r.reasonVars ?? null,
    })),
  });
}
