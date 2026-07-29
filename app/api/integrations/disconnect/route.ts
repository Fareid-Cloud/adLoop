// app/api/integrations/disconnect/route.ts
//
// فصل ربط تكامل. عملية لا رجعة فيها من طرفنا (يجب إعادة الموافقة لاستئنافها)،
// لذا: فحص ملكية صارم، وحذف بيانات الاعتماد وحدها.
//
// قرار مقصود: **لا نحذف البيانات التاريخية**. لقطات الأداء والتحويلات
// المتحقّق منها تخصّ المستخدم لا المنصة، وحذفها عند الفصل يمحو تاريخه
// كلّه بضغطة واحدة - وهو ما يفعله عدد من الأدوات ويندم عليه المستخدم لاحقاً.
// نحذف التوكن وحده، فيتوقّف التدفّق ويبقى الماضي قابلاً للقراءة.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { integrationByKey } from "@/lib/integrationsCatalog";

const AD_PLATFORMS = new Set(["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS", "SNAPCHAT_ADS"]);

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { workspaceId?: string; key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const { workspaceId, key } = body;
  if (!workspaceId || !key) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const def = integrationByKey(key);
  if (!def?.platform) {
    return NextResponse.json({ error: "هذا التكامل لا يدعم الفصل من هنا" }, { status: 400 });
  }

  try {
    if (AD_PLATFORMS.has(def.platform)) {
      // التوكن على مستوى المستخدم، وربط الحملات على مستوى مساحة العمل.
      // نحذف الاثنين معاً وإلّا بقيت حملات مرتبطة بحساب لا نملك توكنه،
      // فتفشل كل مزامنة تالية بخطأ غامض بدل حالة "غير مربوط" الواضحة.
      await prisma.$transaction([
        prisma.campaignLink.deleteMany({
          where: { workspaceId, platform: def.platform as never },
        }),
        prisma.connectedPlatform.deleteMany({
          where: { userId: user.id, platform: def.platform as never },
        }),
      ]);
    } else {
      await prisma.ecommerceConnection.deleteMany({
        where: { workspaceId, platform: def.platform as never },
      });
    }

    return NextResponse.json({
      ok: true,
      message: `فُصل ربط ${def.name}. بياناتك التاريخية باقية كما هي.`,
    });
  } catch (err) {
    console.error(`فشل فصل ربط ${key}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "تعذّر فصل الربط" },
      { status: 500 }
    );
  }
}
