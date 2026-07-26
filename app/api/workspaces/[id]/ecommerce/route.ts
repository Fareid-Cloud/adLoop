// app/api/workspaces/[id]/ecommerce/route.ts
//
// ربط متجر إيكومرس بمساحة العمل. السرّ يُشفَّر قبل التخزين بنفس آلية
// توكنات المنصات الإعلانية، ولا يُعاد إرساله إلى الواجهة أبداً.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { encryptToken } from "@/lib/encryption";
import { PLATFORM_LABEL, type EcommercePlatform } from "@/lib/ecommerce/types";

const ALLOWED: EcommercePlatform[] = ["SALLA", "SHOPIFY", "ZID", "WOOCOMMERCE", "EASY_ORDERS"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({ where: { id, userId: user.id } });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const connections = await prisma.ecommerceConnection.findMany({
    where: { workspaceId: id },
    // السرّ لا يُعاد للواجهة إطلاقاً - يُعرض مرة واحدة فقط عند الإنشاء
    select: {
      id: true, platform: true, storeName: true, storeUrl: true,
      active: true, lastOrderAt: true, ordersReceived: true, createdAt: true,
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

  const workspace = await prisma.workspace.findFirst({ where: { id, userId: user.id } });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  if (!ALLOWED.includes(body.platform)) {
    return NextResponse.json({ error: "منصة غير مدعومة." }, { status: 400 });
  }
  if (typeof body.webhookSecret !== "string" || body.webhookSecret.trim().length < 8) {
    return NextResponse.json(
      { error: "سرّ الويب هوك مطلوب (8 أحرف على الأقل) - بدونه لا يمكن التحقق من صحة الطلبات الواردة." },
      { status: 400 }
    );
  }

  const connection = await prisma.ecommerceConnection.upsert({
    where: { workspaceId_platform: { workspaceId: id, platform: body.platform } },
    create: {
      workspaceId: id,
      platform: body.platform,
      storeName: typeof body.storeName === "string" ? body.storeName.trim().slice(0, 120) : null,
      storeUrl: typeof body.storeUrl === "string" ? body.storeUrl.trim().slice(0, 300) : null,
      webhookSecret: encryptToken(body.webhookSecret.trim()),
      active: true,
    },
    update: {
      storeName: typeof body.storeName === "string" ? body.storeName.trim().slice(0, 120) : undefined,
      storeUrl: typeof body.storeUrl === "string" ? body.storeUrl.trim().slice(0, 300) : undefined,
      webhookSecret: encryptToken(body.webhookSecret.trim()),
      active: true,
    },
    select: { id: true, platform: true, storeName: true, active: true },
  });

  return NextResponse.json({ connection }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({ where: { id, userId: user.id } });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  if (!platform || !ALLOWED.includes(platform as EcommercePlatform)) {
    return NextResponse.json({ error: "منصة غير معروفة." }, { status: 400 });
  }

  await prisma.ecommerceConnection.deleteMany({
    where: { workspaceId: id, platform: platform as any },
  });

  return NextResponse.json({ ok: true });
}
