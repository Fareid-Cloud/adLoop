// app/api/admin/system/reset-limits/[userId]/route.ts
//
// تصفير عدّادات حدّ الذكاء الاصطناعي لحساب واحد.
//
// **الحالة الحقيقية اللي بيحلّها:** فحص خُصم ثم فشل لعطل عندنا أو عند
// مزوّد خارجي، ودوال الردّ التلقائي (`refundAiRefreshQuota` وأخواتها)
// ماوصلتش لأنّ العملية ماتت في النص. من غير الزرّ ده كان الحلّ الوحيد
// تعديل مباشر في قاعدة البيانات.
//
// **محصور في OWNER** بخلاف باقي أدوات الإصلاح: ده بيدّي رصيداً مدفوعاً
// فعلياً، فهو أقرب لفعل ماليّ منه لإجراء دعم.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const guard = await guardAdmin(req, { capability: "customers.override", mutating: true, elevated: true });
  if (!guard.ok) return guard.response;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      aiRefreshMonthlyCount: true, imageQualityMonthlyCount: true, siteScanMonthlyCount: true,
    },
  });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  const before = `${target.aiRefreshMonthlyCount}/${target.imageQualityMonthlyCount}/${target.siteScanMonthlyCount}`;
  const now = new Date();

  await prisma.user.update({
    where: { id: userId },
    data: {
      // العدّاد وتاريخ التصفير مع بعض: تصفير العدّاد وحده بيخلّي أول
      // نداء جاي يلاقي شهراً "قديم" فيصفّر تاني - نتيجة صحيحة بالصدفة
      // النهاردة وغلط لو المنطق اتغيّر.
      aiRefreshMonthlyCount: 0, aiRefreshMonthlyReset: now,
      aiRefreshHourlyCount: 0, aiRefreshHourlyReset: now,
      aiChatHourlyCount: 0, aiChatHourlyReset: now,
      imageQualityMonthlyCount: 0, imageQualityMonthlyReset: now,
      imageQualityHourlyCount: 0, imageQualityHourlyReset: now,
      siteScanMonthlyCount: 0, siteScanMonthlyReset: now,
      siteScanHourlyCount: 0, siteScanHourlyReset: now,
    },
  });

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "RESET_AI_LIMITS",
    targetUserId: userId,
    details: `${guard.admin.email} reset AI counters for ${target.email} (was ${before})`,
  });

  return NextResponse.json({ success: true });
}
