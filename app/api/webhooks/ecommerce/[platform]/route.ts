// app/api/webhooks/ecommerce/[platform]/route.ts
//
// نقطة استقبال موحّدة لكل منصات الإيكومرس. المسار الوحيد المطلوب من
// المستخدم نسخه في لوحة متجره:
//   https://<domain>/api/webhooks/ecommerce/shopify   (أو salla | zid | woocommerce | easy-orders)
//
// المنطق كله مشترك (lib/ecommerce/ingest.ts)، وما يختلف بين المنصات هو
// تحويل الصيغة والتحقق من التوقيع فقط (lib/ecommerce/adapters.ts).
//
// 🔴 وحسم **صاحب** الطلب في `lib/ecommerce/resolveStore.ts` - كان هنا
// `findFirst({ platform })` بلا `workspaceId`، فيصل طلب متجرٍ إلى مساحة
// عمل متجرٍ آخر. اقرأ ذلك الملفّ قبل تعديل أيّ شيء هنا.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseOrder, extractStoreIdentifier } from "@/lib/ecommerce/adapters";
import { resolveStoreConnection } from "@/lib/ecommerce/resolveStore";
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

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // الجسم مُحلَّل قبل التحقّق **لقراءة معرّف المتجر وحده** - وهو مفتاح
  // بحثٍ لا إذن. لا يُكتب شيءٌ ولا يُصدَّق شيءٌ منه قبل أن يصحّ التوقيع.
  const storeIdentifier = extractStoreIdentifier(platform, req.headers, body);

  const store = await resolveStoreConnection(platform, storeIdentifier, rawBody, req.headers);
  if (!store) {
    // رسالةٌ واحدة لحالتين متمايزتين عمداً: «متجر غير مربوط» و«توقيع
    // خاطئ» - التفريق بينهما للعالَم الخارجي يكشف أيّ المتاجر مربوطة
    // عندنا. والسجلّ عندنا يفرّق بينهما، وهو ما يلزم للتشخيص.
    console.error(
      `[ecommerce/${slug}] لم يُحسم المتجر - المعرّف: ${storeIdentifier ?? "غير متاح"}`
    );
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const order = parseOrder(platform, body);
  if (!order) {
    // ليس كل حدث طلباً (تحديث حالة، تحديث منتج...) - نردّ 200 حتى لا
    // تعيد المنصة الإرسال إلى ما لا نهاية على حدث لا يعنينا
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await ingestOrder(order, store.workspaceId, store.connectionId);

  if (result.status === "ok") {
    await prisma.ecommerceConnection.update({
      where: { id: store.connectionId },
      data: { lastOrderAt: new Date(), ordersReceived: { increment: 1 } },
    });
  }

  return NextResponse.json({ ok: true, ...result });
}

// بعض المنصات تتحقق من الرابط بطلب GET قبل التفعيل
export async function GET() {
  return NextResponse.json({ ok: true });
}
