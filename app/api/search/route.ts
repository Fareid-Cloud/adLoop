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
  /** `campaign` | `product` - الصفحات تُطابَق في العميل بلا رحلةِ شبكة */
  kind: "campaign" | "product";
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

  const [campaigns, products] = await Promise.all([
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
  ];

  return NextResponse.json({ hits });
}
