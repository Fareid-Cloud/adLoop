// app/api/site-scan/deep/route.ts
//
// الفحص العميق بطيء (صورة + تحليل AI بصري + أداء + احتمال منافسين) -
// ممكن ياخد نص دقيقة أو أكتر. بنرجّع فوراً بـ ID للمتابعة، والشغل
// الفعلي بيحصل في الخلفية عن طريق after() (نفس نمط استرجاع البيانات
// التاريخية اللي بنيناه قبل كده) - الخادم بيفضل شغال لحد ما يخلص، من
// غير ما نأخّر رد المستخدم أو نصطدم بحد وقت استجابة السيرفر.

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { runDeepSiteScan } from "@/lib/siteScanOrchestrator";
import { checkAndConsumeSiteScanQuota, refundSiteScanQuota, isAiConfigured } from "@/lib/aiRateLimit";
import { blockAiInDemo } from "@/lib/demo";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const { workspaceId, url, competitorUrls } = await req.json();
  if (!workspaceId || !url) {
    return NextResponse.json({ error: t(locale, "apiErr.scanFields") }, { status: 400 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ...workspaceAccess(user.id) },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  // نداء ذكاء اصطناعي حقيقيّ يُصرَف من مساحة عرض: يشتري رأياً في
  // بيانات مخترعة ويخصم من رصيد المشترك.
  const demoBlock = await blockAiInDemo(workspace.id, (user.preferredLocale as "ar" | "en") ?? "ar");
  if (demoBlock) return demoBlock;

  // 🔴 **الخصم آخر خطوة، لا أوّلها.**
  //
  // كان الخصم يسبق كلّ شيء: قبل التحقّق من الحقول، وقبل التأكّد من أنّ
  // مساحة العمل مِلكُ صاحب الطلب، وقبل حارس مساحة العرض. فكانت الطلبات
  // التي تُرفض بعد ذلك **تُنقص رصيداً مدفوعاً مقابل لا شيء**: معرّف مساحة
  // خاطئ، أو حقلٌ ناقص، أو ضغطة من مساحة تجريبية - كلّها تحرق فحصاً من
  // خمسة قبل أن يبدأ أيّ عمل.
  //
  // القاعدة الآن في كلّ مسار مدفوع: هويّة ← تحقّق ← ملكيّة ← حارس العرض
  // ← **ثمّ** الخصم. لا يُخصَم إلّا ما سيُنفَّذ فعلاً.
  // خدمةٌ غير مضبوطة لا تُخصَم مقابلها
  if (!isAiConfigured()) {
    return NextResponse.json({ error: t(locale, "apiErr.aiUnavailable") }, { status: 503 });
  }

  const quota = await checkAndConsumeSiteScanQuota(user.id);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error:
          quota.reason === "hourly_exhausted"
            ? t(locale, "apiErr.scanQuotaHourly", { n: quota.retryAfterMinutes ?? 60 })
            : t(locale, "apiErr.scanQuotaMonthly"),
        // الرفض يحمل مخرجه: باقةٌ نفد رصيدها تُرقَّى، لا تُشرَح فحسب.
        upgradeUrl: quota.reason === "monthly_exhausted" ? "/dashboard/billing" : undefined,
      },
      { status: 429 }
    );
  }

  const scan = await prisma.siteScanResult.create({
    data: {
      workspaceId,
      url,
      competitorUrls: Array.isArray(competitorUrls) ? competitorUrls.slice(0, 2) : [],
      status: "PENDING",
    },
  });

  after(async () => {
    try {
      await prisma.siteScanResult.update({ where: { id: scan.id }, data: { status: "RUNNING" } });

      const result = await runDeepSiteScan(
        url,
        Array.isArray(competitorUrls) ? competitorUrls : [],
        workspace.industryVertical,
        "ar"
      );

      await prisma.siteScanResult.update({
        where: { id: scan.id },
        data: {
          status: "COMPLETED",
          overallScore: result.primary.overallScore,
          technicalSEOScore: result.primary.technicalSEO.score,
          domainTrustScore: result.primary.domainTrust.score,
          performanceScore: result.primary.performance?.performanceScore ?? null,
          visualScore: result.primary.visual
            ? Math.round(
                (result.primary.visual.designTrust.score + result.primary.visual.cta.score +
                  result.primary.visual.valueClarity.score) / 3
              )
            : null,
          fullReport: result as any,
          completedAt: new Date(),
        },
      });

      // إشعار "خلص فحص الموقع" - بالظبط الحالة اللي المستخدم ممكن يكون
      // خرج من الصفحة وسايبه يشتغل بمفرده في الخلفية (الفحص بياخد نص دقيقة+)
      const { pushToActionFeed } = await import("@/lib/actionFeed");
      await pushToActionFeed({
        workspaceId,
        type: "ACCOUNT",
        severity: "LOW",
        title: "فحص الموقع خلص",
        description: `النتيجة الإجمالية: ${result.primary.overallScore}/100`,
        linkUrl: `/dashboard/site-scan`,
      });
    } catch (err) {
      console.error(`فشل الفحص العميق للرابط ${url}:`, err);
      // 🔴 الفحص خُصِم عند البدء، وفشل لسببٍ ليس من صنع المستخدم (خدمة
      // خارجية، رصيد مزوّد نفد، رابط لا يستجيب). تركُ الخصم قائماً يعني
      // أنّه دفع من رصيده ثمن عطلٍ عندنا. يُردّ.
      await refundSiteScanQuota(user.id);
      await prisma.siteScanResult.update({
        where: { id: scan.id },
        data: {
          status: "FAILED",
          // رسالة المنصّة أو المتصفّح إن وُجدت؛ وإلّا يبقى الحقل فارغاً
          // فتكتب الواجهة بديلها بلغة قارئها بدل جملةٍ عربية محفوظة.
          errorMessage: err instanceof Error ? err.message : null,
          completedAt: new Date(),
        },
      });
    }
  });

  return NextResponse.json({ scanId: scan.id, status: "PENDING" }, { status: 202 });
}
