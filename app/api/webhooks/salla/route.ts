// app/api/webhooks/salla/route.ts - **مسارٌ مُحال، لا يستقبل شيئاً.**
//
// 🔴 **كان مسارَ استقبالٍ ثانياً حيّاً لسلّة، بمنطقٍ مختلفٍ عن الموحَّد** -
// وهو ما رصده الأوديت (D-4، High) وأمر بحذفه، ولم يُحذف.
//
// العنوانُ المعتمَد الوحيد الآن:
//   /api/webhooks/ecommerce/salla
// وهو ما تعرضه شاشةُ ربط المتجر (`StoreConnectDialog`) وما توثّقه قائمةُ
// التفعيل. والسرُّ يُحفظ **لكلّ مساحة عمل** مشفَّراً في
// `EcommerceConnection.webhookSecret`، لا في متغيّر بيئةٍ واحدٍ للجميع.
//
// **لماذا لم يكفِ تركُه يعمل:**
//
// ١) **الطلبُ يُعَدّ مرّتين لمن سجّل العنوانين.** منعُ التكرار هنا كان
//    `markEventAsProcessed("SALLA", orderId, storeId)`، وفي الموحَّد
//    `markEventAsProcessed(platform, "<orderId>#<fingerprint>", connectionId)`.
//    المعرّفُ والنطاقُ مختلفان، فقيدُ `@@unique` لا يتصادم أبداً - ويصير
//    `ordersCount` ضعفَه والإيرادُ مقسوماً على صفّين.
//
// ٢) **ومن سجّل هذا وحده كان أسوأ:** يكتب `storeRevenue` تحت
//    `campaignId:"unlinked"` **ولا ينشئ `Order` ولا `Customer` ولا
//    `ProductSaleEvent`** - فكوهورت العملاء ومعدّل الشراء المتكرّر والمرتجعات
//    وتقييمُ الاحتيال كلُّها فارغةٌ بينما اللوحة تعرض طلبات.
//
// ٣) **وحسمُ الملكية كان يتخطّى `lib/ecommerce/resolveStore.ts`** إلى
//    `campaignLink.findFirst` بسرٍّ عامٍّ واحد - وهو النمطُ الذي وُجد ذلك
//    الملفُّ أصلاً لأنّه سرّب طلباتٍ بين المستأجرين.
//
// و`410 Gone` لا حذفُ الملفّ: الحذفُ يعطي `404`، وهي عند المتجر «خطأٌ
// مؤقّت» فيعيد المحاولة أياماً. و`410` تعني «راح ولن يعود» فيتوقّف، وتترك
// للمالك سطراً يقرؤه إن كان قد سجّل هذا العنوان يوماً. والأهمّ: العنوانُ
// القديم لا يستطيع بعد اليوم أن يبتلع طلباً بصمت.

import { NextResponse } from "next/server";

const GONE = {
  error: "gone",
  message:
    "This endpoint was retired. Register the Salla webhook at /api/webhooks/ecommerce/salla " +
    "and set the signing secret when connecting the store in AdLoop.",
} as const;

export async function POST() {
  console.warn(
    "[webhooks/salla] استُقبل طلبٌ على المسار القديم المُحال - سجّل العنوان الموحَّد " +
      "/api/webhooks/ecommerce/salla من شاشة ربط المتجر."
  );
  return NextResponse.json(GONE, { status: 410 });
}

export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}
