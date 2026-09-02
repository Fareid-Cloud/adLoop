// app/api/products/[id]/apply-price/route.ts
//
// اعتماد السعر المقترح: يُحدَّث في قاعدتنا **وفي متجر العميل فعلياً** عبر
// واجهة المنصة. كان التحديث محلياً فقط، فيبقى المتجر يبيع بالسعر الخاسر -
// أي أن القرار لا يُنفَّذ حيث يهم.
//
// التسلسل مقصود: نُحدِّث المتجر أولاً، ثم قاعدتنا. العكس يعني أن فشل
// المتجر يترك رقمين مختلفين ويُظهر المنتج سليماً وهو ليس كذلك.

import { NextRequest, NextResponse } from "next/server";
import { workspaceWriteFilter } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { syncPriceToStore } from "@/lib/ecommerce/priceSync";
import { recordExperiment } from "@/lib/experimentEngine";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const product = await prisma.product.findFirst({
    // فلترُ الكتابة: ده بيغيّر سعراً في متجر العميل فعلاً.
    where: { id, workspace: workspaceWriteFilter(user.id) },
    include: { workspace: { select: { id: true, currency: true } } },
  });
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const newPrice = Number(body?.price);
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    return NextResponse.json({ error: t(locale, "apiErr.priceInvalid") }, { status: 400 });
  }

  const previousPrice = product.currentPrice;
  const sync = await syncPriceToStore(product.workspace.id, product.id, newPrice);

  await prisma.product.update({
    where: { id },
    data: {
      currentPrice: newPrice,
      ...(typeof body?.desiredMarginPct === "number" ? { desiredMarginPct: body.desiredMarginPct } : {}),
    },
  });

  const priceDescVars = {
    product: product.name,
    from: previousPrice,
    to: newPrice,
    currency: product.workspace.currency,
  };

  // تغيير السعر قرار له أثر يُقاس - يدخل المعمل تلقائياً مثل بقية القرارات
  await recordExperiment({
    workspaceId: product.workspace.id,
    changeType: "OTHER",
    description: t("ar", "expDesc.priceChange", priceDescVars),
    descKey: "expDesc.priceChange",
    descVars: priceDescVars,
    trackedMetrics: ["revenue", "orders", "aov", "returned_orders", "profit_estimate"],
    windowDays: 14,
    source: "AUTO",
  }).catch((err) => {
    // يُسجَّل ولا يُبتلع: السعر اتغيّر فعلاً في المتجر وفي قاعدتنا، والتجربة
    // هي اللي فشلت. ابتلاعها صامتة معناه قرار سعر منفَّذ بلا أي قياس لأثره -
    // وده بالظبط النوع اللي بيفضل شهور من غير ما حد ياخد باله.
    console.error("[apply-price] تعذّر فتح تجربة لقياس تغيير السعر:", err);
  });

  return NextResponse.json({
    ok: true,
    price: newPrice,
    // نُفرّق بوضوح: هل تغيّر السعر في المتجر فعلاً أم عندنا فقط؟
    storeUpdated: sync.ok,
    // المفتاح ومتغيّراته لا الجملة: الواجهة تعرف لغة قارئها، وهذا
    // المسار لا يعرفها. راجع `priceSync.ts`.
    storePlatform: sync.platformKey ?? null,
    storeNoticeKey: sync.ok ? null : sync.reasonKey ?? "unknown",
    storeNoticeVars: sync.ok ? null : (sync.reasonVars ?? null),
    needsSetup: sync.needsSetup ?? false,
  });
}
