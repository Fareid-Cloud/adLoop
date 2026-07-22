// app/api/account/export-data/route.ts
//
// حق "قابلية نقل البيانات" (Data Portability) - المستخدم يقدر ياخد نسخة
// كاملة من بياناته بصيغة قابلة للقراءة (JSON) في أي وقت.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [profile, workspaces, feedback] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true, email: true, name: true, createdAt: true,
        preferredLocale: true, businessScale: true, timezone: true,
      },
    }),
    prisma.workspace.findMany({
      where: { userId: user.id },
      include: {
        campaignLinks: true,
        products: true,
      },
    }),
    prisma.feedback.findMany({ where: { userId: user.id } }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    profile,
    workspaces,
    feedback,
    // ملاحظة: أرقام الأداء اليومية (MetricSnapshot) مش متضمّنة هنا كاملة
    // عشان الحجم - لو محتاجها كاملة، استخدم "تصدير CSV" في صفحة التقارير
    note: "لأرقام الأداء اليومية الكاملة، استخدم زرار تصدير CSV في صفحة التقارير.",
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="adloop-my-data-${user.id}.json"`,
    },
  });
}
