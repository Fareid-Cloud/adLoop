// app/api/admin/system/resync/[workspaceId]/route.ts
//
// إعادة مزامنة مساحة واحدة من صندوق أدوات الإصلاح - نفس الدالة اللي
// بيستخدمها الكرون وزرّ العميل، على مستوى المساحة بدل الحساب.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { resyncWorkspace } from "@/lib/resyncWorkspace";

export const maxDuration = 120;

export async function POST(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const guard = await guardAdmin(req, { capability: "system.resync", mutating: true });
  if (!guard.ok) return guard.response;

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, userId: true, user: { select: { email: true } } },
  });
  if (!ws) return NextResponse.json({ error: "not found" }, { status: 404 });

  const result = await resyncWorkspace(workspaceId, "MANUAL");

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "FORCE_RESYNC",
    targetUserId: ws.userId,
    targetWorkspaceId: workspaceId,
    details: `${guard.admin.email} re-synced "${ws.name}" (${ws.user.email}) — ${result.succeeded}/${result.results.length} platforms ok`,
  });

  return NextResponse.json({ success: true, ...result });
}
