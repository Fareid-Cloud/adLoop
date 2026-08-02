// lib/setupProgress.ts
//
// تقدّم الإعداد الحقيقي: كل خطوة تُعتبر مكتملة **فقط** إذا تحقّقت فعلياً في
// قاعدة البيانات (حساب مربوط، حملات مختارة، بيانات وصلت، تتبع يعمل...).
// هذا بديل "الجولة" التي كان يُضغط فيها Next دون إنجاز شيء - هنا لا تكتمل
// الخطوة إلا بالفعل الحقيقي.
//
// قاعدتان تحكمان هذا الملف:
//
// ١) **لا خطوة تُحيل إلى الإعدادات.** الإعدادات مكان يذهب إليه من يريد
//    الضبط بمزاجه، لا محطة إجبارية في طريق الإعداد. كل خطوة تُنفَّذ في
//    مكانها أو في الصفحة التي تخصّها فعلاً.
//
// ٢) **"وصلت بيانات" ليست "نجحت المزامنة".** حساب جديد قد يُزامَن بنجاح
//    ويُرجع صفر صفوف لأن حملاته لم تُنتج أرقاماً بعد. ربط اكتمال الخطوة
//    بوجود صفوف كان يُعلّق المستخدم إلى ما لا نهاية على خطوة نفّذها فعلاً.

import { prisma } from "@/lib/prisma";
import { getConnectedPlatforms } from "@/lib/connectionState";

export interface SetupStep {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  done: boolean;
  ctaHref: string;
  ctaAr: string;
  ctaEn: string;
}

export interface SetupProgress {
  steps: SetupStep[];
  completedCount: number;
  total: number;
  allDone: boolean;
  nextStep: SetupStep | null;
}

export async function getSetupProgress(workspaceId: string, userId: string): Promise<SetupProgress> {
  const [connections, campaignCount, snapshotCount, syncedOk, verifiedAgg, valueConfig, appliedActions, storeCount, productCount] = await Promise.all([
    // عبر المصدر الموحّد لا استعلاماً مباشراً: المساحة التجريبية مربوطة
    // بحكم كونها تجريبية، وإلا وقف الديمو المليء بالبيانات على خطوة
    // «اربط حساباً» إلى الأبد.
    getConnectedPlatforms(workspaceId, userId).then((s) => s.size),
    prisma.campaignLink.count({ where: { workspaceId } }),
    prisma.metricSnapshot.count({ where: { workspaceId } }),
    prisma.syncRun.count({ where: { workspaceId, status: "SUCCESS" } }),
    prisma.metricSnapshot.aggregate({ where: { workspaceId }, _sum: { verifiedConversions: true } }),
    prisma.conversionValueConfig.findUnique({ where: { workspaceId }, select: { workspaceId: true } }),
    prisma.actionFeedItem.count({ where: { workspaceId, status: "APPLIED" } }),
    prisma.ecommerceConnection.count({ where: { workspaceId, active: true } }),
    prisma.product.count({ where: { workspaceId } }),
  ]);

  const steps: SetupStep[] = [
    {
      id: "connect",
      titleAr: "اربط حساباً إعلانياً",
      titleEn: "Connect an ad account",
      descAr: "اربط Google أو Meta أو TikTok لنبدأ سحب بياناتك تلقائياً.",
      descEn: "Connect Google, Meta or TikTok so we can pull your data automatically.",
      done: connections > 0,
      ctaHref: "/dashboard",
      ctaAr: "ربط حساب",
      ctaEn: "Connect",
    },
    {
      id: "campaigns",
      titleAr: "اختر الحملات التي تتابعها",
      titleEn: "Choose campaigns to track",
      descAr: "نتابع الحملات التي تختارها فقط — أوضح وأقل ضجيجاً.",
      descEn: "We track only the campaigns you pick — clearer and less noise.",
      done: campaignCount > 0,
      ctaHref: "/dashboard/integrations",
      ctaAr: "اختيار الحملات",
      ctaEn: "Select campaigns",
    },
    {
      id: "data",
      titleAr: "شغّل أول مزامنة",
      titleEn: "Run your first sync",
      descAr: "تجري المزامنة يومياً تلقائياً. شغّلها الآن لترى أرقامك فوراً.",
      descEn: "Sync runs daily automatically. Run it now to see your numbers straight away.",
      // تكتمل بنجاح المزامنة لا بوصول صفوف: حساب جديد قد يُزامَن بنجاح
      // ويُرجع صفراً لأن حملاته لم تُنتج أرقاماً بعد، وربطها بالصفوف كان
      // يُبقي المستخدم عالقاً على خطوة أدّاها بالفعل.
      done: snapshotCount > 0 || syncedOk > 0,
      ctaHref: "/dashboard/integrations",
      ctaAr: "مزامنة الآن",
      ctaEn: "Sync now",
    },
    {
      id: "tracking",
      titleAr: "فعّل التحقق من التحويلات",
      titleEn: "Turn on conversion verification",
      descAr: "أضف وسم التتبع واربط واتساب/ماسنجر لتظهر التحويلات المحقّقة — جوهر AdLoop.",
      descEn: "Add the tracking tag and link WhatsApp/Messenger to see verified conversions — the core of AdLoop.",
      done: (verifiedAgg._sum.verifiedConversions ?? 0) > 0,
      ctaHref: "/dashboard/diagnostics/tracking-coverage",
      ctaAr: "إعداد التتبع",
      ctaEn: "Set up tracking",
    },
    {
      id: "value",
      titleAr: "اضبط قيمة العميل",
      titleEn: "Set your customer value",
      descAr: "متوسط قيمة العميل ونسبة التحويل — أساس حساب الربحية والقرارات.",
      descEn: "Average customer value and close rate — the basis for profitability decisions.",
      done: !!valueConfig,
      ctaHref: "/dashboard/diagnostics",
      ctaAr: "ضبط القيمة",
      ctaEn: "Set value",
    },
    {
      id: "store",
      titleAr: "اربط متجرك الإلكتروني",
      titleEn: "Connect your online store",
      descAr: "سلة أو شوبيفاي أو زد أو ووكومرس أو إيزي أوردرز — لتصل الطلبات والمرتجعات والمخزون تلقائياً.",
      descEn: "Salla, Shopify, Zid, WooCommerce or EasyOrders — so orders, returns and stock arrive automatically.",
      // خطوة اختيارية بطبيعتها: من لا يبيع منتجات لا تعنيه. تُعتبر
      // مكتملة أيضاً لمن لا يستخدم منتجات إطلاقاً حتى لا تعلق القائمة.
      done: storeCount > 0 || productCount === 0,
      ctaHref: "/dashboard/integrations",
      ctaAr: "ربط المتجر",
      ctaEn: "Connect store",
    },
    {
      id: "action",
      titleAr: "نفّذ أول قرار",
      titleEn: "Apply your first decision",
      descAr: "راجع القرارات المقترحة ونفّذ أحدها — هنا تتحول الأرقام إلى نتيجة.",
      descEn: "Review suggested decisions and apply one — where numbers turn into results.",
      done: appliedActions > 0,
      ctaHref: "/dashboard/actions",
      ctaAr: "عرض القرارات",
      ctaEn: "View decisions",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  return {
    steps,
    completedCount,
    total: steps.length,
    allDone: completedCount === steps.length,
    nextStep: steps.find((s) => !s.done) ?? null,
  };
}
