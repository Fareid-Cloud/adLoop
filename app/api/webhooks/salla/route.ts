// app/api/webhooks/salla/route.ts
//
// سلة بتبعت طلب POST هنا في كل مرة يتعمل فيها طلب جديد (order.created).
// بنربط الطلب بالكليك الأصلي (gclid) عن طريق UTM parameters اللي بتتحفظ
// وقت الكليك على صفحة المتجر، بنفس مبدأ نظام تتبع الواتساب بالظبط.
//
// أمان: (1) بنتحقق من توقيع سلة (HMAC-SHA256) على الـ body الخام قبل أي
// معالجة - وإلا أي حد يعرف الرابط يقدر يبعت طلبات وهمية تتسجل كمبيعات
// حقيقية. (2) بنسجل معرف كل طلب اتعالج فعلاً، عشان لو سلة بعتت نفس
// الحدث تاني (بتعمل كده لحد 3 مرات لو ماخدتش رد 200 خلال 30 ثانية)
// منضاعفش الإيراد.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyHmacSignature, markEventAsProcessed } from "@/lib/webhookSecurity";

export async function POST(req: NextRequest) {
  // لازم ناخد الـ body كنص خام قبل أي تحليل - التوقيع بيتحسب على البايتات
  // الأصلية بالظبط، مش على نسخة JSON معاد تجميعها ممكن تختلف شكلاً
  const rawBody = await req.text();

  const signature = req.headers.get("x-salla-signature");
  const secret = process.env.SALLA_WEBHOOK_SECRET;

  if (!secret) {
    console.error("SALLA_WEBHOOK_SECRET غير مضبوط - رافضين كل الطلبات لحد ما يتظبط");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  if (!verifyHmacSignature(rawBody, signature, secret)) {
    console.warn("توقيع Salla غير صحيح - الطلب مرفوض");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  if (body.event !== "order.created") {
    return NextResponse.json({ ok: true }); // بنتجاهل أي حدث غير الطلبات الجديدة
  }

  const order = body.data;
  const storeId = String(body.merchant); // معرف المتجر في سلة

  // الحماية من التكرار - لو الطلب ده اتعالج قبل كده، نوقف هنا فوراً
  const orderId = String(order.id ?? order.reference_id ?? "");
  if (!orderId) {
    console.error("طلب سلة بدون معرف - مينفعش نضمن عدم التكرار، بنرفضه");
    return NextResponse.json({ error: "missing order id" }, { status: 400 });
  }

  const isFirstTime = await markEventAsProcessed("SALLA", orderId);
  if (!isFirstTime) {
    return NextResponse.json({ ok: true, note: "already processed" });
  }

  // بنحاول نلاقي الـ Workspace المربوط بالمتجر ده
  const link = await prisma.campaignLink.findFirst({
    where: { platform: "SALLA", externalAccountId: storeId },
  });

  if (!link) {
    console.warn(`مفيش Workspace مربوط بمتجر سلة: ${storeId}`);
    return NextResponse.json({ ok: true });
  }

  // بنسجل الطلب كـ snapshot يومي (بنجمعه مع باقي طلبات نفس اليوم لاحقاً)
  const orderDate = new Date(order.created_at ?? Date.now());
  const dateOnly = new Date(orderDate.toISOString().slice(0, 10));

  await prisma.metricSnapshot.upsert({
    where: {
      workspaceId_platform_campaignId_date_placementBreakdown_placementDetail: {
        workspaceId: link.workspaceId,
        platform: "SALLA",
        campaignId: order.reference_id ?? "unlinked", // لو فيه UTM/gclid مربوط بالطلب
        date: dateOnly,
        placementBreakdown: "ALL",
        placementDetail: "ALL",
      },
    },
    create: {
      workspaceId: link.workspaceId,
      platform: "SALLA",
      campaignId: order.reference_id ?? "unlinked",
      date: dateOnly,
      ordersCount: 1,
      revenue: Number(order.total?.amount ?? 0),
      returnedOrdersCount: 0,
    },
    update: {
      ordersCount: { increment: 1 },
      revenue: { increment: Number(order.total?.amount ?? 0) },
    },
  });

  // ربط حقيقي على مستوى المنتج الفردي - كان مفقود تماماً قبل كده
  // (بس إجمالي على مستوى الـWorkspace). لو الطلب فيه تفاصيل عناصر
  // (order.items، بمطابقة sku)، بنسجّل حدث بيع حقيقي لكل منتج معروف
  if (Array.isArray(order.items)) {
    for (const item of order.items) {
      const sku = item.sku ?? null;
      if (!sku) continue; // مفيش SKU نقدر نطابق بيه، بنتجاهل السطر ده

      const product = await prisma.product.findFirst({
        where: { workspaceId: link.workspaceId, sku },
      });
      if (!product) continue; // منتج مش متسجّل عندنا لسه - مش خطأ، بس مفيش نربطه بيه

      await prisma.productSaleEvent.create({
        data: {
          productId: product.id,
          quantity: Number(item.quantity ?? 1),
          revenue: Number(item.amounts?.total?.amount ?? item.price ?? 0),
          returned: false,
          occurredAt: orderDate,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
