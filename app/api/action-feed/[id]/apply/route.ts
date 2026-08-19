// app/api/action-feed/[id]/apply/route.ts
//
// إصلاح أمني حرج (BOLA - OWASP API Security #1): كان مفيش فحص ملكية
// خالص - أي مستخدم مسجّل دخول كان يقدر ينفّذ قرار أتمتة بتاع مستخدم تاني
// تماماً (زي إيقاف حملة أو تغيير ميزانية) لو عرف الـ ID بس.

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { getSessionUser } from "@/lib/auth";
import { applyActionFeedItem } from "@/lib/actionFeed";
import { prisma } from "@/lib/prisma";
import { logFeatureUse } from "@/lib/productTelemetry";
import { isFeatureEnabled } from "@/lib/featureFlags";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const item = await prisma.actionFeedItem.findFirst({
    where: { id: id, workspace: workspaceAccess(user.id) },
  });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  // نفس مفتاح الكرون: إيقاف التنفيذ الآليّ من اللوحة لازم يوقف
  // الزرّ اليدويّ كمان، وإلا كان الإيقاف نص إيقاف.
  if (!(await isFeatureEnabled("automation.apply"))) {
    return NextResponse.json({ error: "automation is temporarily disabled" }, { status: 503 });
  }

  try {
    await applyActionFeedItem(id);
    // قياس المنتج: التنفيذ الفعليّ - مش فتح الصفحة. الفرق بينهم هو الفرق
    // بين "الميزة اتشافت" و"الميزة اشتغلت".
    logFeatureUse(
      user.id,
      item.actionType?.startsWith("SET_BID_STRATEGY") ? "bid_strategy_apply" : "scale_kill_apply",
      item.workspaceId
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    // فشل تنفيذ حقيقي (زي فشل استدعاء API عند المنصة) - لازم يوصل
    // للمستخدم بوضوح، مش يختفي كإنه نجح
    console.error(`فشل تنفيذ إجراء ${id}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل التنفيذ" },
      { status: 500 }
    );
  }
}
