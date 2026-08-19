// app/api/admin/system/close-run/[runId]/route.ts
//
// إغلاق تشغيل مزامنة معلّق.
//
// مش إلغاء للعمل - العمل نفسه انتهى أو مات من زمان، والصفّ ده أثره
// الوحيد الباقي. الإغلاق بيحرّر المساحة من حالة "شغّال" الكاذبة اللي
// بتخفي أي مشكلة حقيقية تحتها.

import { NextRequest, NextResponse } from "next/server";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { closeStuckRun } from "@/lib/admin/system";

export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const guard = await guardAdmin(req, { capability: "system.resync", mutating: true });
  if (!guard.ok) return guard.response;

  const closed = await closeStuckRun(runId, guard.admin.email);
  if (!closed) return NextResponse.json({ error: "run is not stuck (or does not exist)" }, { status: 400 });

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "CLOSE_STUCK_RUN",
    details: `${guard.admin.email} closed stuck sync run ${runId}`,
  });

  return NextResponse.json({ success: true });
}
