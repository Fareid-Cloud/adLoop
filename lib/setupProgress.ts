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
  /** 🔴 **«لا تعنيك» ليست «أنجزتَها».**
   *
   *  خطوةُ ربط المتجر كانت تُعلَّم `done` لمن لا منتجات لديه، بنيّةٍ صحيحة
   *  (ألّا تعلق القائمة عند من لا يبيع شيئاً) ونتيجةٍ خاطئة: مستخدمٌ جديد
   *  يرى «مكتملة» أمام شيءٍ لم يفعله - فيصدّق أنّ متجره موصول، أو يظنّ
   *  المنتج يكذب عليه. وكلاهما أسوأ من خطوةٍ معلّقة.
   *
   *  الحالتان منفصلتان الآن: `done` إنجازٌ حقيقيّ، و`notApplicable` إعفاءٌ
   *  يُقال بلفظه. ولا تُحسَب في المُنجَز حتى لا يرتفع «جاهزٌ ٪» بلا سبب. */
  notApplicable?: boolean;
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
    getConnectedPlatforms(workspaceId, userId).then(async (set) => {
      // 🔴 **التفويض ليس حساباً إعلانياً.** كانت الخطوة تكتمل بمجرّد وجود
      // منح OAuth، فيقرأ المالك «اربط حساباً إعلانياً: مكتمل» بينما
      // «صحّة الحساب» تحته تقول «في انتظار ربط الحسابات» - والثانية هي
      // الصادقة: منحُ جوجل قائم وليس تحته حساب إعلانيّ واحد. والخطوة
      // تقول ما تقوله بلفظها، فلا تكتمل حتى يُختار حساب فعليّ.
      if (set.size === 0) return 0;
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { isDemo: true },
      });
      if (ws?.isDemo) return set.size;
      return prisma.connectedAccount.count({ where: { connection: { userId } } });
    }),
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
      // 🔴 **خطوةٌ ناقصة فوق خطوتين مكتملتين تحتها.**
      //
      // كان الشرط عدَّ `connectedAccount` وحده، فظهر على مساحةٍ حقيقية:
      // «١ اربط حساباً - جارية» ثمّ «٢ اختر الحملات - مكتملة» و«٣ أوّل
      // مزامنة - مكتملة». وهو ترتيبٌ مستحيل يقرؤه صاحبه عطباً في العدّاد.
      //
      // و**الحملات المرتبطة برهانٌ أقوى من الصفّ نفسه**: لا تُختار حملةٌ
      // إلّا من حسابٍ إعلانيٍّ متّصل فعلاً. فمن وصل إلى الثانية فقد أتمّ
      // الأولى بحكم الواقع، وإن غاب صفُّها لسببٍ في بياناتٍ قديمة.
      done: connections > 0 || campaignCount > 0,
      // 🔴 كانت `/dashboard` - أي الصفحة نفسها التي تُعرض فيها البطاقة.
      // فيضغط المستخدم «أكمل الإعداد» على الرئيسية فلا يحدث شيء إطلاقاً:
      // رابطٌ إلى المكان الذي هو فيه. الخطوة تحيل الآن إلى صفحة ربط
      // المنصّات حيث يُربط الحساب فعلاً.
      ctaHref: "/dashboard/integrations",
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
      // الربط الحقيقيّ وحده إنجاز. ومن لا منتجات لديه تُعفى عنه الخطوة
      // بلفظها، لا بادّعاء أنّه أنجزها.
      done: storeCount > 0,
      notApplicable: storeCount === 0 && productCount === 0,
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

  const applicable = steps.filter((s) => !s.notApplicable);
  const completedCount = applicable.filter((s) => s.done).length;
  return {
    steps,
    completedCount,
    // المقام هو المطبَّق عليه وحده - وإلّا بقي «جاهزٌ ٪» دون المئة أبداً
    // لمن أعفته خطوةٌ لا تعنيه.
    total: applicable.length,
    allDone: completedCount === applicable.length,
    nextStep: applicable.find((s) => !s.done) ?? null,
  };
}
