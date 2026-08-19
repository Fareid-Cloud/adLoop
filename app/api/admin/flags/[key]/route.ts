// app/api/admin/flags/[key]/route.ts
//
// مفتاح تشغيل عامّ. المفتاح لازم يبقى من القائمة المغلقة في
// `lib/featureFlags.ts` - صفّ لمفتاح مافيش كود بيقراه بيدّي إحساس تحكّم
// مالوش وجود.

import { NextRequest, NextResponse } from "next/server";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { isFeatureFlagKey, setFeatureFlag } from "@/lib/featureFlags";

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const guard = await guardAdmin(req, { capability: "flags.manage", mutating: true });
  if (!guard.ok) return guard.response;

  if (!isFeatureFlagKey(key)) return NextResponse.json({ error: "unknown flag" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  await setFeatureFlag(key, body.enabled);
  await logAdminAction({
    adminUserId: guard.admin.id,
    action: body.enabled ? "FLAG_ENABLE" : "FLAG_DISABLE",
    details: `${guard.admin.email} turned ${key} ${body.enabled ? "on" : "off"} globally`,
  });

  return NextResponse.json({ success: true, key, enabled: body.enabled });
}
