// app/api/admin/customers/[id]/resync/route.ts
//
// "بياناته واقفة" - أكتر شكوى بيتحلّ بضغطة. بينفّذ نفس المزامنة اللي
// الكرون بيعملها يومياً (`lib/resyncWorkspace.ts`)، على مساحات الحساب
// كلها، دلوقتي بدل ما يستنّى الدورة الجاية.
//
// فعل آمن وقابل للتكرار، فمتاح للدعم كمان مش للمالك وحده - ومحتاج CSRF
// بس بلا تحقّق طازج: أسوأ ما يعمله إنه يسحب البيانات من جديد.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { resyncWorkspace } from "@/lib/resyncWorkspace";

export const maxDuration = 120;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardAdmin(req, { capability: "system.resync", mutating: true });
  if (!guard.ok) return guard.response;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { email: true, workspaces: { select: { id: true, name: true } } },
  });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (target.workspaces.length === 0) {
    return NextResponse.json({ error: "this account has no workspaces" }, { status: 400 });
  }

  const runs = [];
  for (const ws of target.workspaces) {
    const r = await resyncWorkspace(ws.id, "MANUAL");
    runs.push({ workspaceId: ws.id, name: ws.name, ...r });
  }

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "FORCE_RESYNC",
    targetUserId: id,
    details: `${guard.admin.email} re-synced ${target.workspaces.length} workspace(s) for ${target.email}`,
  });

  return NextResponse.json({ success: true, runs });
}
