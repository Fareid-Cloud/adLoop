// lib/ecommerce/ingest.ts
//
// استقبال الطلبات: منطق واحد لكل المنصات. يتولّى منع التكرار، وتجميع
// المقاييس اليومية، وتسجيل أحداث البيع لكل منتج، وخصم المخزون تلقائياً.
//
// خصم المخزون هنا هو ما يجعل قواعد "أوقف الإعلان عند نفاد الرصيد" تعمل
// ببيانات حقيقية بدل إدخال يدوي.

import { prisma } from "@/lib/prisma";
import type { NormalizedOrder } from "./types";

/** يمنع معالجة نفس الطلب مرتين (إعادة إرسال الويب هوك أمر شائع). */
async function markProcessed(platform: string, orderId: string): Promise<boolean> {
  try {
    await prisma.processedWebhookEvent.create({
      data: { source: platform, externalEventId: orderId },
    });
    return true;
  } catch {
    return false; // قيد التفرّد رفضه ⇒ سبق أن عولج
  }
}

export interface IngestResult {
  status: "ok" | "duplicate" | "no_workspace";
  matchedProducts: number;
  stockUpdated: number;
}

export async function ingestOrder(order: NormalizedOrder): Promise<IngestResult> {
  const isFirstTime = await markProcessed(order.platform, order.externalOrderId);
  if (!isFirstTime) return { status: "duplicate", matchedProducts: 0, stockUpdated: 0 };

  // نحدّد مساحة العمل من الربط المسجّل لهذه المنصة
  const link = await prisma.ecommerceConnection.findFirst({
    where: { platform: order.platform as any, active: true },
  });
  if (!link) return { status: "no_workspace", matchedProducts: 0, stockUpdated: 0 };

  const workspaceId = link.workspaceId;
  const dateOnly = new Date(order.createdAt.toISOString().slice(0, 10));

  // مقاييس اليوم على مستوى المنصة - نفس الجدول الذي تقرأ منه بقية اللوحة
  await prisma.metricSnapshot.upsert({
    where: {
      // المفتاح الفريد يشمل حقلي التفصيل (اللذين تستخدمهما ميتا) - نمرّر
      // السلسلة الفارغة لهما كما تفعل بقية نقاط الكتابة غير الإعلانية
      workspaceId_platform_campaignId_date_placementBreakdown_placementDetail: {
        workspaceId,
        platform: order.platform as any,
        campaignId: order.externalOrderId,
        date: dateOnly,
        placementBreakdown: "",
        placementDetail: "",
      },
    },
    create: {
      workspaceId,
      platform: order.platform as any,
      campaignId: order.externalOrderId,
      date: dateOnly,
      impressions: 0, clicks: 0, cost: 0,
      rawConversions: 1, verifiedConversions: 0,
      ordersCount: 1,
      revenue: order.total,
      returnedOrdersCount: order.isReturned ? 1 : 0,
    },
    update: {
      ordersCount: { increment: 1 },
      revenue: { increment: order.total },
      rawConversions: { increment: 1 },
      returnedOrdersCount: order.isReturned ? { increment: 1 } : undefined,
    },
  });

  // ربط أسطر الطلب بمنتجات معروفة عبر SKU
  let matchedProducts = 0;
  let stockUpdated = 0;

  const skus = order.items.map((i) => i.sku).filter((s): s is string => !!s);
  if (skus.length > 0) {
    const products = await prisma.product.findMany({
      where: { workspaceId, sku: { in: skus } },
    });
    const bySku = new Map(products.map((p: any) => [p.sku, p]));

    for (const item of order.items) {
      if (!item.sku) continue;
      const product: any = bySku.get(item.sku);
      if (!product) continue;

      await prisma.productSaleEvent.create({
        data: {
          productId: product.id,
          quantity: item.quantity,
          revenue: item.lineTotal,
          returned: order.isReturned,
          occurredAt: order.createdAt,
        },
      });
      matchedProducts++;

      // خصم المخزون فعلياً - الطلب المرتجع يعيد الكمية بدل خصمها
      if (product.stockQuantity !== null) {
        const delta = order.isReturned ? item.quantity : -item.quantity;
        await prisma.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: Math.max(0, product.stockQuantity + delta),
            stockUpdatedAt: new Date(),
            stockSource: order.platform,
          },
        });
        stockUpdated++;
      }
    }
  }

  return { status: "ok", matchedProducts, stockUpdated };
}
