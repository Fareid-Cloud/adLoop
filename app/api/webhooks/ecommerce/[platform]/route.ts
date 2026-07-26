// app/api/webhooks/ecommerce/[platform]/route.ts
//
// نقطة استقبال موحّدة لكل منصات الإيكومرس. المسار الوحيد المطلوب من
// المستخدم نسخه في لوحة متجره:
//   https://<domain>/api/webhooks/ecommerce/shopify   (أو salla | zid | woocommerce | easy-orders)
//
// المنطق كله مشترك (lib/ecommerce/ingest.ts)، وما يختلف بين المنصات هو
// تحويل الصيغة والتحقق من التوقيع فقط (lib/ecommerce/adapters.ts).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";
import { parseOrder, verifySignature } from "@/lib/ecommerce/adapters";
import { ingestOrder } from "@/lib/ecommerce/ingest";
import type { EcommercePlatform } from "@/lib/ecommerce/types";

const SLUG_TO_PLATFORM: Record<string, EcommercePlatform> = {
  salla: "SALLA",
  shopify: "SHOPIFY",
  zid: "ZID",
  woocommerce: "WOOCOMMERCE",
  "easy-orders": "EASY_ORDERS",
  easyorders: "EASY_ORDERS",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform: slug } = await params;
  const platform = SLUG_TO_PLATFORM[slug.toLowerCase()];
  if (!platform) {
    return NextResponse.json({ error: "unknown platform" }, { status: 404 });
  }

  // النص الخام مطلوب للتحقق من التوقيع - إعادة تسلسل JSON تُغيّر البايتات
  // وتُفشل المقارنة حتى لو كان المحتوى صحيحاً.
  const rawBody = await req.text();

  const connection = await prisma.ecommerceConnection.findFirst({
    where: { platform: platform as any, active: true },
  });
  if (!connection) {
    return NextResponse.json({ error: "store not connected" }, { status: 404 });
  }

  const secret = connection.webhookSecret ? decryptToken(connection.webhookSecret) : undefined;
  if (!verifySignature(platform, rawBody, req.headers, secret)) {
    // الرفض هو السلوك الافتراضي: بيانات مالية بلا تحقق لا تُقبل
    console.error(`توقيع ويب هوك غير صالح لمنصة ${platform}`);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const order = parseOrder(platform, body);
  if (!order) {
    // ليس كل حدث طلباً (تحديث حالة، تحديث منتج...) - نردّ 200 حتى لا
    // تعيد المنصة الإرسال إلى ما لا نهاية على حدث لا يعنينا
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await ingestOrder(order);

  if (result.status === "ok") {
    await prisma.ecommerceConnection.update({
      where: { id: connection.id },
      data: { lastOrderAt: new Date(), ordersReceived: { increment: 1 } },
    });
  }

  return NextResponse.json({ ok: true, ...result });
}

// بعض المنصات تتحقق من الرابط بطلب GET قبل التفعيل
export async function GET() {
  return NextResponse.json({ ok: true });
}
