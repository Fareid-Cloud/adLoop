// lib/ecommerce/storeScope.ts
//
// **أيّ متجرٍ تعرضه صفحات «متجري» الآن؟**
//
// سؤالٌ لم يكن له وجود: القيد كان يحصر المساحة في متجرٍ واحدٍ لكلّ منصّة،
// فكلّ صفحةٍ تجمع المساحة كلّها وتصيب. وبعد أن صار للتاجر متجران، صار
// المجموع وحده يخفي ما جاء يبحث عنه: أيّ متجرٍ يربح ولماذا.
//
// ═══ ما يُفلتَر وما لا يُفلتَر ═══
//
// الطلبات والإيراد والمرتجعات والمنتجات والعملاء كلّها تحمل متجرها،
// فتُفلتَر. أمّا **الإنفاق الإعلانيّ فلا**: الحملة تُشترى للمساحة لا
// لمتجرٍ بعينه، ولا تحمل المنصّاتُ الإعلانية أيّ إشارةٍ إلى أيّ متجرٍ
// أرسلت إليه الزائر.
//
// وقسمتُه على المتاجر بالتساوي أو بنسبة الإيراد تُنتج «ربحاً بعد الإعلان»
// **يبدو دقيقاً وهو مخترع** - في الصفحة التي يُقرَّر بها أين يُوضع المال.
// فيبقى الإنفاق على مستوى المساحة، وتقول الواجهة ذلك صراحةً.

import { prisma } from "@/lib/prisma";

export interface StoreOption {
  id: string;
  name: string;
  platform: string;
}

export interface StoreScope {
  /** متاجر المساحة - يُبنى منها المنتقي */
  options: StoreOption[];
  /** المتجر المختار، أو `null` حين «كلّ المتاجر» */
  selectedId: string | null;
  /** لا يُعرض المنتقي أصلاً بمتجرٍ واحد: خيارٌ بلا بديلٍ ضجيج */
  showPicker: boolean;
}

/**
 * @param raw قيمة `?store=` كما وصلت - **لا يُوثق بها**. معرّفٌ لمتجر
 *   مساحةٍ أخرى في الرابط يجب ألّا يعرض بياناتها، فيُتحقَّق من انتمائه
 *   إلى هذه المساحة قبل استعماله، وإلّا سقط إلى «كلّ المتاجر».
 */
export async function resolveStoreScope(
  workspaceId: string,
  raw: string | string[] | undefined
): Promise<StoreScope> {
  const stores = await prisma.ecommerceConnection.findMany({
    where: { workspaceId, active: true },
    select: { id: true, platform: true, storeName: true, storeUrl: true },
    orderBy: { createdAt: "asc" },
  });

  const options: StoreOption[] = stores.map((s) => ({
    id: s.id,
    name: s.storeName ?? s.storeUrl ?? s.platform,
    platform: s.platform,
  }));

  const wanted = Array.isArray(raw) ? raw[0] : raw;
  const selectedId = wanted && options.some((o) => o.id === wanted) ? wanted : null;

  return { options, selectedId, showPicker: options.length > 1 };
}

/**
 * شرط Prisma للطلبات بحسب المتجر المختار.
 *
 * يُدمج في `where` الموجود ولا يستبدله: `{ workspaceId, ...orderScope(id) }`.
 * ومع «كلّ المتاجر» يعود فارغاً، فلا فرعَ ثانياً في كلّ مستدعٍ.
 */
export function orderScope(selectedId: string | null): { connectionId?: string } {
  return selectedId ? { connectionId: selectedId } : {};
}
