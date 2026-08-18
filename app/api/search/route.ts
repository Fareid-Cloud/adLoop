// app/api/search/route.ts
//
// البحث الشامل داخل مساحة العمل - **لا عناوين صفحاتٍ وحدها.**
//
// 🔴 كان بحثُ الرأس يقرأ من `NAV_GROUPS` فقط، أي من قائمة التنقّل نفسها -
// فيُعطي ما في الشريط الجانبيّ حرفاً بحرف، ولا شيء غيره. ومن يكتب اسم
// حملةٍ أو منتجٍ لا يجد شيئاً، رغم أنّ ذلك أوّلُ ما يُبحث عنه في أداةٍ
// إعلانية. الصفحات تبقى (فالانتقال السريع مفيد)، ويُضاف إليها ما في
// المساحة فعلاً.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export interface SearchHit {
  /** الصفحات تُطابَق في العميل بلا رحلةِ شبكة، والباقي من القاعدة */
  kind: "campaign" | "product" | "creative" | "store" | "customer" | "order";
  label: string;
  /** سطرٌ يفصل المتشابهات: المنصّة للحملة، ورمز المنتج له */
  context: string | null;
  href: string;
  platform: string | null;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ hits: [] });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  // حرفان على الأقلّ: حرفٌ واحد يطابق كلّ شيء تقريباً، فتكون الرحلة إلى
  // قاعدة البيانات بلا فائدةٍ للقارئ.
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) return NextResponse.json({ hits: [] });

  const [campaigns, products, creatives, stores, customers, orders] = await Promise.all([
    prisma.campaignLink.findMany({
      where: { workspaceId: workspace.id, campaignName: { contains: q, mode: "insensitive" } },
      select: { campaignName: true, platform: true, externalCampaignId: true },
      take: 6,
    }),
    prisma.product.findMany({
      where: { workspaceId: workspace.id, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, sku: true },
      take: 6,
    }),
    // 🔴 الإعلان الفردي يتكرّر يومياً في `CreativeSnapshot`، فالبحث فيه
    // بلا تمييزٍ يُرجع الاسم نفسه ثلاثين مرّة. `distinct` على معرّف
    // الإعلان يُبقي صفّاً واحداً لكلّ إعلان.
    prisma.creativeSnapshot.findMany({
      where: { workspaceId: workspace.id, adName: { contains: q, mode: "insensitive" } },
      select: { adId: true, adName: true, platform: true },
      distinct: ["adId"],
      take: 6,
    }),
    prisma.ecommerceConnection.findMany({
      where: { workspaceId: workspace.id, storeName: { contains: q, mode: "insensitive" } },
      select: { id: true, storeName: true, platform: true },
      take: 4,
    }),
    // الاسم الأوّل وحده مخزَّنٌ عندنا، والهاتف والبريد مجزوءان - فالبحث
    // بالاسم هو الممكن، والمطابقة بهما مستحيلةٌ بحكم التصميم لا بالسهو.
    prisma.customer.findMany({
      where: { workspaceId: workspace.id, displayName: { contains: q, mode: "insensitive" } },
      select: { id: true, displayName: true, city: true },
      take: 4,
    }),
    prisma.order.findMany({
      where: { workspaceId: workspace.id, externalOrderId: { contains: q, mode: "insensitive" } },
      select: { id: true, externalOrderId: true, platform: true, total: true },
      take: 4,
    }),
  ]);

  const hits: SearchHit[] = [
    ...campaigns.map((c) => ({
      kind: "campaign" as const,
      label: c.campaignName,
      // المنصّة سياقُ الحملة: حملتان بالاسم نفسه على منصّتين شيئان.
      context: c.platform,
      href: `/dashboard/campaigns?highlight=${encodeURIComponent(c.externalCampaignId)}`,
      platform: c.platform,
    })),
    ...products.map((p) => ({
      kind: "product" as const,
      label: p.name,
      context: p.sku,
      href: `/dashboard/ecommerce/products?highlight=${encodeURIComponent(p.id)}`,
      platform: null,
    })),
    ...creatives.map((c) => ({
      kind: "creative" as const,
      label: c.adName ?? c.adId,
      context: c.platform,
      href: `/dashboard/campaigns/creatives?highlight=${encodeURIComponent(c.adId)}`,
      platform: c.platform,
    })),
    ...stores.map((st) => ({
      kind: "store" as const,
      label: st.storeName ?? st.platform,
      context: st.platform,
      href: `/dashboard/ecommerce/stores?highlight=${encodeURIComponent(st.id)}`,
      platform: st.platform,
    })),
    ...customers.map((c) => ({
      kind: "customer" as const,
      label: c.displayName ?? "",
      context: c.city,
      href: `/dashboard/ecommerce/customers?highlight=${encodeURIComponent(c.id)}`,
      platform: null,
    })),
    ...orders.map((o) => ({
      kind: "order" as const,
      label: o.externalOrderId,
      context: o.platform,
      href: `/dashboard/ecommerce/orders?highlight=${encodeURIComponent(o.id)}`,
      platform: o.platform,
    })),
  ];

  return NextResponse.json({ hits });
}
