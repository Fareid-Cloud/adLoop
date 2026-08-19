// app/api/workspaces/[id]/ecommerce/route.ts
//
// ربط متجر إيكومرس بمساحة العمل. السرّ يُشفَّر قبل التخزين بنفس آلية
// توكنات المنصات الإعلانية، ولا يُعاد إرساله إلى الواجهة أبداً.

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { encryptToken } from "@/lib/encryption";
import { PLATFORM_LABEL, type EcommercePlatform } from "@/lib/ecommerce/types";
import { checkStoreLimit } from "@/lib/entitlements";
import { authSpecFor } from "@/lib/ecommerce/webhookAuth";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";
import { logFeatureUse } from "@/lib/productTelemetry";

const ALLOWED: EcommercePlatform[] = ["SALLA", "SHOPIFY", "ZID", "WOOCOMMERCE", "EASY_ORDERS"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({ where: { id, ...workspaceAccess(user.id) } });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const connections = await prisma.ecommerceConnection.findMany({
    where: { workspaceId: id },
    // السرّ لا يُعاد للواجهة إطلاقاً - يُعرض مرة واحدة فقط عند الإنشاء
    select: {
      id: true, platform: true, storeName: true, storeUrl: true,
      active: true, lastOrderAt: true, ordersReceived: true, createdAt: true,
      canWritePrices: true, storeIdentifier: true,
    },
  });

  return NextResponse.json({
    connections,
    available: ALLOWED.map((p) => ({ platform: p, label: PLATFORM_LABEL[p] })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const workspace = await prisma.workspace.findFirst({ where: { id, ...workspaceAccess(user.id) } });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  // 🔴 حدّ الباقة كان معرَّفاً في `entitlements` ولا يُستدعى من أيّ مكان،
  // فباقة تعرض «متجر واحد» كانت تقبل أيّ عدد. الفحص قبل التحقّق من
  // الحمولة: لا معنى لتدقيق بيانات لن تُقبل أصلاً.
  //
  // ويُميَّز التعديل من الإضافة بمعرّف المتجر لا بالمنصّة: بعد أن صار
  // للمساحة أكثر من متجرٍ على المنصّة الواحدة، صارت المنصّة لا تدلّ على
  // متجرٍ بعينه، فإضافةُ الثاني كانت تُقرأ تعديلاً وتفلت من الحدّ.
  const editingId = typeof body.connectionId === "string" ? body.connectionId : null;
  const storeCheck = await checkStoreLimit(user.id, id, editingId);
  if (!storeCheck.allowed) {
    return NextResponse.json(
      {
        // 🔴 كانتا نصّاً عربياً مثبَّتاً هنا، فتصلان مشتركاً يقرأ الإنجليزية
        // عربيّتين - وهما أوّل ما يراه عند منعه من المتابعة. وفحص تسريب
        // العربية لم يلتقطهما لأنّه لا يفحص هذا المسار، فلتُصلَح باليد.
        error:
          storeCheck.limit === 0
            ? t(locale, "apiErr.storesNotInPlan")
            : t(locale, "apiErr.storeLimitReached", { limit: storeCheck.limit }),
        limitReached: true,
        limit: storeCheck.limit,
      },
      { status: 403 }
    );
  }

  if (!ALLOWED.includes(body.platform)) {
    return NextResponse.json({ error: t(locale, "apiErr.platformUnsupported") }, { status: 400 });
  }
  if (typeof body.webhookSecret !== "string" || body.webhookSecret.trim().length < 8) {
    return NextResponse.json(
      { error: t(locale, "apiErr.webhookSecretRequired") },
      { status: 400 }
    );
  }

  // 🔴 زد لا توقّع ويب هوكاتها إطلاقاً - المصادقة الأساسية هي كلّ ما
  // لديها، وهي **اختيارية عندها**. فقبولُ ربطٍ بلا اسم مستخدم يعني فتح
  // مسار استقبال بيانات مالية يقبل من أيّ أحدٍ عرف الرابط، ويحقن مبيعاتٍ
  // وهمية في حساب تاجر. إجباريّةٌ عندنا، ويُرفض الحفظ بدونها.
  const spec = authSpecFor(body.platform);
  const webhookUsername =
    typeof body.webhookUsername === "string" ? body.webhookUsername.trim() : "";
  if (spec?.needsUsername && webhookUsername.length < 4) {
    return NextResponse.json(
      { error: t(locale, "apiErr.webhookUsernameRequired") },
      { status: 400 }
    );
  }

  // 🔴 **متجرٌ جديد أم تعديلُ متجرٍ قائم؟** كان `upsert` على
  // `[workspaceId, platform]` يجيب عن هذا ضمناً: لا يوجد إلّا واحد.
  // فلمّا صار للمساحة متجران على المنصّة نفسها، صار الحفظ بلا معرّف
  // يكتب **فوق** متجرٍ قائم بدل إضافة الثاني - يظنّ التاجر أنّه أضاف
  // وقد استبدل، ويكتشف ذلك حين تتوقّف طلبات متجره الأوّل.
  //
  // فالمعرّف هو الفارق: بوجوده تعديل، وبغيابه إضافة.
  if (editingId) {
    // الملكية شرطٌ في التحديث نفسه: معرّفٌ وحده يفتح باب تعديل متجر غيرك.
    const updated = await prisma.ecommerceConnection.updateMany({
      where: { id: editingId, workspaceId: id },
      data: {
        storeName: typeof body.storeName === "string" ? body.storeName.trim().slice(0, 120) : undefined,
        storeUrl: typeof body.storeUrl === "string" ? body.storeUrl.trim().slice(0, 300) : undefined,
        webhookSecret: encryptToken(body.webhookSecret.trim()),
        ...(typeof body.apiToken === "string" && body.apiToken.trim()
          ? { apiToken: encryptToken(body.apiToken.trim()), canWritePrices: true } : {}),
        ...(typeof body.apiSecret === "string" && body.apiSecret.trim()
          ? { apiSecret: encryptToken(body.apiSecret.trim()) } : {}),
        ...(webhookUsername ? { webhookUsername } : {}),
        active: true,
      },
    });
    if (updated.count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ connection: { id: editingId } });
  }

  const connection = await prisma.ecommerceConnection.create({
    data: {
      workspaceId: id,
      platform: body.platform,
      storeName: typeof body.storeName === "string" ? body.storeName.trim().slice(0, 120) : null,
      storeUrl: typeof body.storeUrl === "string" ? body.storeUrl.trim().slice(0, 300) : null,
      webhookSecret: encryptToken(body.webhookSecret.trim()),
      // توكن الكتابة اختياري: بدونه يعمل الاستقبال، لكن تحديث الأسعار
      // تلقائياً في المتجر لا يعمل - نسجّل ذلك صراحةً بدل افتراضه.
      apiToken: typeof body.apiToken === "string" && body.apiToken.trim()
        ? encryptToken(body.apiToken.trim()) : null,
      apiSecret: typeof body.apiSecret === "string" && body.apiSecret.trim()
        ? encryptToken(body.apiSecret.trim()) : null,
      storeIdentifier: typeof body.storeIdentifier === "string" ? body.storeIdentifier.trim() || null : null,
      webhookUsername: webhookUsername || null,
      canWritePrices: !!(typeof body.apiToken === "string" && body.apiToken.trim()),
      active: true,
    },
    select: { id: true, platform: true, storeName: true, active: true },
  });

  logFeatureUse(user.id, "store_connected", id);
  return NextResponse.json({ connection }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const workspace = await prisma.workspace.findFirst({ where: { id, ...workspaceAccess(user.id) } });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  // بمعرّف المتجر يُحذف متجرٌ واحد. وبالمنصّة وحدها تُحذف متاجرها كلّها -
  // وهو ما كان يعنيه الحذف حين لم يكن للمنصّة إلّا متجرٌ واحد، فيبقى
  // للتوافق مع من يفصل «سلّة» كلّها.
  const connectionId = searchParams.get("connectionId");
  const platform = searchParams.get("platform");
  if (!connectionId && (!platform || !ALLOWED.includes(platform as EcommercePlatform))) {
    return NextResponse.json({ error: t(locale, "apiErr.platformUnknown") }, { status: 400 });
  }

  await prisma.ecommerceConnection.deleteMany({
    where: connectionId
      ? { id: connectionId, workspaceId: id }
      : { workspaceId: id, platform: platform as any },
  });

  return NextResponse.json({ ok: true });
}
