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
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

const AD_PLATFORMS = new Set(["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS", "SNAPCHAT_ADS"]);

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  let body: { workspaceId?: string; key?: string; connectionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t(locale, "apiErr.badRequest") }, { status: 400 });
  }

  const { workspaceId, key, connectionId } = body;
  if (!workspaceId || !key) return NextResponse.json({ error: t(locale, "apiErr.missingFields") }, { status: 400 });

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const def = integrationByKey(key);
  if (!def?.platform) {
    return NextResponse.json({ error: t(locale, "apiErr.integrationNotDisconnectable") }, { status: 400 });
  }

  try {
    if (AD_PLATFORMS.has(def.platform)) {
      // التوكن على مستوى المستخدم، وربط الحملات على مستوى مساحة العمل.
      // نحذف الاثنين معاً وإلّا بقيت حملات مرتبطة بحساب لا نملك توكنه،
      // فتفشل كل مزامنة تالية بخطأ غامض بدل حالة "غير مربوط" الواضحة.
      //
      // 🔴 وحين يملك المشترك أكثر من تسجيل دخولٍ للمنصّة الواحدة، صار
      // الحذف الشامل يعني أنّ فصل حساب عميلٍ **يفصل بقيّة العملاء معه**.
      // فإن أُشير إلى منحةٍ بعينها، لا يُحذف إلّا ما يخصّها: حملاتُ
      // الحسابات التي تصلها هي، ثمّ هي.
      if (typeof connectionId === "string" && connectionId) {
        const owned = await prisma.connectedPlatform.findFirst({
          where: { id: connectionId, userId: user.id, platform: def.platform as never },
          select: { id: true, accounts: { select: { externalAccountId: true } } },
        });
        if (!owned) {
          return NextResponse.json({ error: "not found" }, { status: 404 });
        }
        const accountIds = owned.accounts.map((a) => a.externalAccountId);
        await prisma.$transaction([
          // حساباتٌ لم تُكتشف بعد (لم يُفتح «اختر الحملات» لهذه المنحة) تعني
          // قائمةً فارغة - وحذفٌ بشرطٍ فارغ يمسح **كلّ** حملات المنصّة. لذلك
          // لا يُحذف شيءٌ من الحملات حين لا نعرف ما يخصّها.
          ...(accountIds.length > 0
            ? [
                prisma.campaignLink.deleteMany({
                  where: {
                    workspaceId,
                    platform: def.platform as never,
                    externalAccountId: { in: accountIds },
                  },
                }),
              ]
            : []),
          prisma.connectedPlatform.delete({ where: { id: owned.id } }),
        ]);
      } else {
        await prisma.$transaction([
          prisma.campaignLink.deleteMany({
            where: { workspaceId, platform: def.platform as never },
          }),
          prisma.connectedPlatform.deleteMany({
            where: { userId: user.id, platform: def.platform as never },
          }),
        ]);
      }
    } else {
      // متجرٌ بعينه إن أُشير إليه، وإلّا متاجر المنصّة كلّها - فقد صار
      // للمساحة أكثر من متجرٍ على المنصّة الواحدة، وفصلُ أحدها يجب ألّا
      // يفصل أخواته معه.
      await prisma.ecommerceConnection.deleteMany({
        where:
          typeof connectionId === "string" && connectionId
            ? { id: connectionId, workspaceId }
            : { workspaceId, platform: def.platform as never },
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
