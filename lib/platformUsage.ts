// lib/platformUsage.ts
//
// عدّ نداءات المنصّات - عملياتٌ لا «مزامنات».
//
// **هذه المرحلة عدٌّ بلا سقف، عن قصد.** كلّ رقمٍ في جدول التخصيص المقترَح
// (`docs/api-quota-plan.md`) تخمينٌ حتى تُقاس التكلفة الحقيقية للمساحة
// الواحدة. والعدُّ وحده لا يغيّر سلوكاً ولا يحتاج قراراً، فلا سبب لتأجيله
// خلف نقاشٍ في أرقامٍ لا تُحسم قبله.
//
// 🔴 **ولا يُوقِف العدُّ مزامنةً أبداً.** فشلُ كتابةِ عدّادٍ لا يجوز أن
// يُسقط سحبَ بيانات العميل: هذا قياسٌ لنا، والبيانات له. لذلك كلّ نداءٍ
// هنا محاطٌ بـtry، وأسوأُ ما يقع أن يَنقص رقمٌ في تقريرٍ داخليّ.

import { prisma } from "@/lib/prisma";
import type { Platform } from "@prisma/client";
// استيراد **نوعٍ فقط**: يُمحى وقت الترجمة فلا يجرّ gRPC ولا `fs`/`tls`
// معه - وهو ما كسر البناء في هذا المشروع حين استُورد الوحدة نفسها.
import type { services } from "google-ads-api";

/** اليوم بتوقيت UTC - حدود الحصص اليومية عند المنصّات تُحسب به لا بتوقيت الخادم. */
function utcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** تسجيل عملياتٍ على مساحةٍ ومنصّة. زيادةٌ ذرّية: الكرون يمرّ على المساحات
 *  بالتوازي، والقراءةُ ثمّ الكتابة تفقد نداءاتٍ تحت التزامن. */
export async function recordOperations(
  workspaceId: string,
  platform: Platform,
  count = 1
): Promise<void> {
  if (count <= 0) return;
  try {
    const day = utcDay();
    await prisma.platformUsage.upsert({
      where: { workspaceId_platform_day: { workspaceId, platform, day } },
      create: { workspaceId, platform, day, operations: count },
      update: { operations: { increment: count } },
    });
  } catch (err) {
    // مقصود: القياس لا يعطّل السحب. ويُسجَّل كي لا يمرّ الخلل صامتاً.
    console.error("[platformUsage] تعذّر تسجيل الاستهلاك", { workspaceId, platform, err });
  }
}

/** نداء HTTP معدود - لميتا وتيك توك.
 *
 *  التوقيعُ نفسُ `fetch` مسبوقاً بمن يُحسَب عليه، فالاستبدال في مواضع
 *  النداء لا يغيّر شيئاً سواه. */
export async function countedFetch(
  workspaceId: string,
  platform: Platform,
  input: string | URL,
  init?: RequestInit
): Promise<Response> {
  // يُسجَّل قبل النداء لا بعده: النداء الذي يفشل استهلك حصّةً عند المنصّة
  // فعلاً، وعدُّ الناجح وحده يُظهر استهلاكاً أقلّ ممّا وقع - وهو الاتجاه
  // الخطير في رقمٍ يُبنى عليه سقف.
  await recordOperations(workspaceId, platform);
  return fetch(input, init);
}

/** استعلام Google Ads معدود.
 *
 *  `customer` هنا بنوعٍ ضيّق عمداً بدل استيراد نوع المكتبة: استيراد
 *  `google-ads-api` يجرّ gRPC ومعها `fs`/`tls`/`net`، وأيُّ مكوّن عميل
 *  يلمس هذا الملفّ بعدها ينكسر بناؤه - وقد وقع ذلك في هذا المشروع من قبل. */
export async function countedGoogleQuery(
  workspaceId: string,
  // النوع ملموسٌ لا عامّ: `query` في المكتبة عامّةٌ بافتراضيٍّ
  // (`query<T = IGoogleAdsRow[]>`)، وتمريرُها إلى معاملٍ عامّ يجعل الاستنتاج
  // يسقط إلى `unknown` فتضيع أنواع الصفوف في كلّ موضع نداء. وتثبيتُه على
  // الافتراضيّ نفسه يبقي مواضع النداء على ما كانت عليه بالضبط.
  customer: { query: (gaql: string) => Promise<services.IGoogleAdsRow[]> },
  gaql: string
): Promise<services.IGoogleAdsRow[]> {
  await recordOperations(workspaceId, "GOOGLE_ADS");
  return customer.query(gaql);
}

export type UsageRow = { platform: Platform; operations: number };

/** استهلاك مساحةٍ اليوم - لواجهةٍ أو تقرير. */
export async function usageForWorkspace(workspaceId: string): Promise<UsageRow[]> {
  const rows = await prisma.platformUsage.findMany({
    where: { workspaceId, day: utcDay() },
    select: { platform: true, operations: true },
  });
  return rows;
}

/** استهلاك الحوض اليوم لكلّ منصّة - المجموع على كلّ المساحات.
 *
 *  جوجل وتيك توك وحدهما حوضٌ مشترَك؛ ميتا حصّتها لكلّ حسابٍ إعلانيّ فلا
 *  حوضَ لها يُقسَّم - وإدخالُها هنا يخترع ندرةً لا تفرضها المنصّة. */
export async function poolUsageToday(): Promise<UsageRow[]> {
  const rows = await prisma.platformUsage.groupBy({
    by: ["platform"],
    where: { day: utcDay(), platform: { in: ["GOOGLE_ADS", "TIKTOK_ADS"] } },
    _sum: { operations: true },
  });
  return rows.map((r: { platform: Platform; _sum: { operations: number | null } }) => ({
    platform: r.platform,
    operations: r._sum.operations ?? 0,
  }));
}
