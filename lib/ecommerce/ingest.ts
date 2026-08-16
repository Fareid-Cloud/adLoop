// lib/ecommerce/ingest.ts
//
// استقبال الطلبات: منطق واحد لكل المنصات. يتولّى منع التكرار، وتجميع
// المقاييس اليومية، وتسجيل أحداث البيع لكل منتج، وخصم المخزون تلقائياً.
//
// خصم المخزون هنا هو ما يجعل قواعد "أوقف الإعلان عند نفاد الرصيد" تعمل
// ببيانات حقيقية بدل إدخال يدوي.

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { markEventAsProcessed } from "@/lib/webhookSecurity";
import { isCancelledStatus, isCashOnDelivery, type NormalizedOrder, type NormalizedCustomer } from "./types";

function hash(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * يجد العميل أو ينشئه، ويحدّث مجاميعه. المطابقة بالمعرّف الخارجي أولاً
 * (الأدقّ)، ثم بالبريد المُهشَّم، ثم بالهاتف المُهشَّم - لأن بعض المنصات
 * لا ترسل معرّف عميل للطلبات كضيف، فيبقى البريد هو الرابط الوحيد بين
 * طلبين لنفس الشخص. بدون هذا التسلسل يصبح كل طلب "عميلاً جديداً"
 * ويصير معدّل الشراء المتكرّر صفراً دائماً - رقم خاطئ يبدو حقيقياً.
 */
async function upsertCustomer(
  workspaceId: string,
  platform: string,
  customer: NormalizedCustomer | null | undefined,
  order: { total: number; createdAt: Date; isReturned: boolean }
): Promise<string | null> {
  if (!customer) return null;

  const emailHash = hash(customer.email);
  const phoneHash = hash(customer.phone);
  const externalId = customer.externalId ?? null;
  if (!externalId && !emailHash && !phoneHash) return null;

  const existing = await prisma.customer.findFirst({
    where: {
      workspaceId,
      OR: [
        ...(externalId ? [{ platform: platform as never, externalCustomerId: externalId }] : []),
        ...(emailHash ? [{ emailHash }] : []),
        ...(phoneHash ? [{ phoneHash }] : []),
      ],
    },
  });

  const spent = order.isReturned ? 0 : order.total;

  if (existing) {
    const updated = await prisma.customer.update({
      where: { id: existing.id },
      data: {
        ordersCount: { increment: 1 },
        totalSpent: { increment: spent },
        totalReturned: order.isReturned ? { increment: order.total } : undefined,
        returnedOrdersCount: order.isReturned ? { increment: 1 } : undefined,
        lastOrderAt: order.createdAt,
        // نملأ ما كان ناقصاً فقط - الطلب كضيف قد يحمل بريداً لم يصلنا سابقاً
        emailHash: existing.emailHash ?? emailHash,
        phoneHash: existing.phoneHash ?? phoneHash,
        externalCustomerId: existing.externalCustomerId ?? externalId,
        city: existing.city ?? customer.city ?? null,
        country: existing.country ?? customer.country ?? null,
      },
    });
    return updated.id;
  }

  const created = await prisma.customer.create({
    data: {
      workspaceId,
      platform: platform as never,
      externalCustomerId: externalId,
      emailHash,
      phoneHash,
      displayName: customer.firstName?.trim().split(/\s+/)[0] ?? null,
      city: customer.city ?? null,
      country: customer.country ?? null,
      firstOrderAt: order.createdAt,
      lastOrderAt: order.createdAt,
      ordersCount: 1,
      totalSpent: spent,
      totalReturned: order.isReturned ? order.total : 0,
      returnedOrdersCount: order.isReturned ? 1 : 0,
    },
  });
  return created.id;
}

/**
 * مخاطرة الطلب - إشارات محسوبة صراحةً، لا نموذج مُدرَّب.
 * ⚠️ حدّ صريح يُعرض في الواجهة: هذه ترجيحات من أنماط معروفة في السوق
 * العربي (الدفع عند الاستلام + طلب مرتفع القيمة + عميل جديد)، وليست
 * كشف احتيال حقيقياً. الأدوات المتخصّصة تستخدم بصمة جهاز وتاريخ دفع
 * لا نملك أياً منهما.
 */
function assessOrderRisk(input: {
  isCod: boolean;
  total: number;
  avgOrderValue: number;
  isNewCustomer: boolean;
  customerReturnRate: number;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (input.isCod) {
    score += 25;
    reasons.push("الدفع عند الاستلام - لا التزام مالي مسبق من العميل");
  }
  if (input.avgOrderValue > 0 && input.total >= input.avgOrderValue * 3) {
    score += 25;
    reasons.push("قيمة الطلب أعلى من متوسط متجرك بثلاثة أضعاف أو أكثر");
  }
  if (input.isNewCustomer && input.isCod) {
    score += 20;
    reasons.push("عميل لأول مرة يدفع عند الاستلام");
  }
  if (input.customerReturnRate >= 50) {
    score += 30;
    reasons.push(`هذا العميل ارتدّت ${Math.round(input.customerReturnRate)}% من طلباته السابقة`);
  }

  return { score: Math.min(100, score), reasons };
}

/** يمنع معالجة نفس الطلب مرتين (إعادة إرسال الويب هوك أمر شائع). */
// نسخةٌ ثانية من منطق منع التكرار كانت هنا، بجانب `markEventAsProcessed`
// في `lib/webhookSecurity.ts`. ومنطقان لمنع التكرار يعنيان أنّ إصلاح أحدهما
// لا يصل الآخر - وهو ما حدث بالضبط: النطاق أُضيف هناك وبقي هذا عامّاً.
// موضعٌ واحد يعرف كيف يُمنع التكرار.

export interface IngestResult {
  // `no_workspace` أُزيلت: كانت تعني «لم أجد مساحةً لهذا الطلب» أيّام
  // كانت هذه الدالة تبحث بنفسها. صار الحسم قبلها ومرّةً واحدة، فالحالة
  // لا تُبلَغ هنا أصلاً - والمسار يردّ `401` قبل أن يصل إلينا شيء.
  status: "ok" | "duplicate";
  matchedProducts: number;
  stockUpdated: number;
}

export async function ingestOrder(
  order: NormalizedOrder,
  /** 🔴 **يُمرَّر ولا يُستنتَج.**
   *
   *  كانت هذه الدالة تعيد حسم المساحة بنفسها بـ
   *  `findFirst({ platform, active })` - بلا `workspaceId`، فتأخذ أوّل
   *  ربطٍ لتلك المنصّة في القاعدة كلّها. وكان المسار الداعي قد حسمها
   *  **صحيحةً** قبل سطرين، فيضيع حسمُه وتُكتب مبيعات متجرٍ في مساحة
   *  متجرٍ آخر. مصدرُ حقيقةٍ واحدٌ للملكية: `resolveStoreConnection`،
   *  ومَن يستدعي هذه الدالة يمرّر نتيجته. */
  workspaceId: string,
  /** 🔴 **الربط الذي وصل منه الطلب - وبدونه يبتلع تاجرٌ طلبات تاجرٍ آخر.**
   *
   *  منعُ التكرار كان بالمفتاح `[platform, externalOrderId]` وحده، عامّاً
   *  على القاعدة كلّها. وأرقام الطلبات ليست عالمية: ووكومرس تُنصَّب على
   *  خادم كلّ تاجر وتبدأ من واحد، فطلب «1001» عند الثاني يُقرأ مكرَّراً
   *  لأنّ الأوّل سجّله، **فيُهمَل بلا خطأ ولا سجلّ** - إيرادٌ ناقصٌ في
   *  تقريرٍ لا يشكو، ولا يُكتشف إلّا بمراجعة يدوية مع التاجر.
   *
   *  والنطاق الربطُ لا المساحة، ليصحّ كذلك لمن يملك متجرين على المنصّة
   *  نفسها داخل مساحةٍ واحدة. */
  connectionId: string
): Promise<IngestResult> {
  const isFirstTime = await markEventAsProcessed(
    order.platform,
    order.externalOrderId,
    connectionId
  );
  if (!isFirstTime) return { status: "duplicate", matchedProducts: 0, stockUpdated: 0 };

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

  // ==== العميل ثم الطلب: صفّان حقيقيان بدل مجاميع يومية فقط ====
  const customerId = await upsertCustomer(workspaceId, order.platform, order.customer, {
    total: order.total,
    createdAt: order.createdAt,
    isReturned: order.isReturned,
  });

  const isCod = isCashOnDelivery(order.paymentMethod);
  const cancelled = isCancelledStatus(order.status);

  // متوسط قيمة الطلب في المتجر - مرجع "الطلب مرتفع القيمة" لهذا المتجر
  // تحديداً، لا رقم عام مستورد
  const aggregate = await prisma.order.aggregate({
    where: { workspaceId },
    _avg: { total: true },
  });
  const avgOrderValue = aggregate._avg.total ?? 0;

  let isNewCustomer = true;
  let customerReturnRate = 0;
  if (customerId) {
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    if (c) {
      isNewCustomer = c.ordersCount <= 1;
      customerReturnRate = c.ordersCount > 0 ? (c.returnedOrdersCount / c.ordersCount) * 100 : 0;
    }
  }

  const risk = assessOrderRisk({
    isCod,
    total: order.total,
    avgOrderValue,
    isNewCustomer,
    customerReturnRate,
  });

  const orderRow = await prisma.order.upsert({
    where: {
      // المتجر جزءٌ من المفتاح: متجرا التاجر الواحد على المنصّة نفسها
      // يبدأ كلٌّ منهما ترقيمه من عنده، فرقم «1001» يتكرّر بينهما.
      workspaceId_platform_connectionId_externalOrderId: {
        workspaceId,
        platform: order.platform as never,
        connectionId,
        externalOrderId: order.externalOrderId,
      },
    },
    create: {
      workspaceId,
      connectionId,
      platform: order.platform as never,
      externalOrderId: order.externalOrderId,
      customerId,
      orderedAt: order.createdAt,
      total: order.total,
      shippingCost: order.shippingCost ?? 0,
      currency: order.currency ?? null,
      rawStatus: order.status ?? null,
      state: cancelled ? "CANCELLED" : order.isReturned ? "RETURNED" : order.fulfilledAt ? "FULFILLED" : "PLACED",
      isReturned: order.isReturned,
      itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
      fulfilledAt: order.fulfilledAt ?? null,
      paymentMethod: order.paymentMethod ?? null,
      isCod,
      fraudRiskScore: risk.score,
      fraudRiskReasons: risk.reasons,
    },
    update: {
      rawStatus: order.status ?? null,
      state: cancelled ? "CANCELLED" : order.isReturned ? "RETURNED" : order.fulfilledAt ? "FULFILLED" : "PLACED",
      isReturned: order.isReturned,
      fulfilledAt: order.fulfilledAt ?? null,
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
          orderId: orderRow.id,
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
