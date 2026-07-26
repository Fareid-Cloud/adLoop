// lib/setupProgress.ts
//
// تقدّم الإعداد الحقيقي: كل خطوة تُعتبر مكتملة **فقط** إذا تحقّقت فعلياً في
// قاعدة البيانات (حساب مربوط، حملات مختارة، بيانات وصلت، تتبع يعمل...).
// هذا بديل "الجولة" التي كان يُضغط فيها Next دون إنجاز شيء - هنا لا تكتمل
// الخطوة إلا بالفعل الحقيقي.

import { prisma } from "@/lib/prisma";

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
  const [connections, campaignCount, snapshotCount, verifiedAgg, valueConfig, appliedActions] = await Promise.all([
    prisma.connectedPlatform.count({ where: { userId } }),
    prisma.campaignLink.count({ where: { workspaceId } }),
    prisma.metricSnapshot.count({ where: { workspaceId } }),
    prisma.metricSnapshot.aggregate({ where: { workspaceId }, _sum: { verifiedConversions: true } }),
    prisma.conversionValueConfig.findUnique({ where: { workspaceId }, select: { workspaceId: true } }),
    prisma.actionFeedItem.count({ where: { workspaceId, status: "APPLIED" } }),
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
      ctaHref: "/dashboard/settings?tab=workspace",
      ctaAr: "اختيار الحملات",
      ctaEn: "Select campaigns",
    },
    {
      id: "data",
      titleAr: "استقبل أول بيانات",
      titleEn: "Receive your first data",
      descAr: "تجري المزامنة يومياً تلقائياً. بعدها تظهر أرقامك في اللوحة.",
      descEn: "Sync runs daily automatically. Your numbers appear right after.",
      done: snapshotCount > 0,
      ctaHref: "/dashboard/settings?tab=workspace",
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
      ctaHref: "/dashboard/settings?tab=workspace",
      ctaAr: "ضبط القيمة",
      ctaEn: "Set value",
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
