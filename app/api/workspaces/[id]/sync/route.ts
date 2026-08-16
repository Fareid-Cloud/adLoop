// app/api/workspaces/[id]/sync/route.ts
//
// مزامنة فورية بطلب المستخدم. لم يكن هناك أي وسيلة لتشغيل المزامنة يدوياً:
// خطوة "استقبل أول بيانات" كانت تُحيل إلى الإعدادات حيث لا يوجد زر مزامنة
// أصلاً، فيبقى المستخدم ينتظر دورة الكرون اليومية دون أن يعرف ذلك.
//
// نزامن المنصات المرتبطة فقط، وكل منصة على حدة: فشل واحدة لا يمنع الأخرى.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getUsageState } from "@/lib/usageCaps";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

export const maxDuration = 60;

interface SyncOutcome {
  platform: string;
  ok: boolean;
  error?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const workspace = await prisma.workspace.findFirst({ where: { id, userId: user.id } });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const links = await prisma.campaignLink.findMany({
    where: { workspaceId: id },
    select: { platform: true },
    distinct: ["platform"],
  });

  if (links.length === 0) {
    return NextResponse.json(
      { error: t(locale, "apiErr.noCampaignsLinked") },
      { status: 400 }
    );
  }

  // 🛑 السقف يسري على الزرّ اليدويّ كما يسري على الكرون. بدون هذا يصير
  // «الزرّ» بابَ التفافٍ يُبطل الحدّ كلّه: من بلغ سقفه يضغط مزامنة فتعمل.
  //
  // الرسالة تقول ما توقّف والرقم الذي أوقفه وما الذي يعيده، وترافقها وجهةٌ
  // جاهزة - القاعدة الحاكمة: نقطةٌ تمنع المستخدم تحمل معها الحلّ.
  const usage = await getUsageState(user.id);
  if (usage.blocked) {
    const locale = (user.preferredLocale as "ar" | "en") ?? "ar";
    return NextResponse.json(
      {
        error: t(
          locale,
          usage.reason === "spend" ? "alerts.usageBlockedSpendBody" : "alerts.usageBlockedConvBody",
          {
            spend: usage.spendUsd.toLocaleString("en-US"),
            spendLimit: usage.spendLimitUsd.toLocaleString("en-US"),
            conv: usage.verifiedConversions.toLocaleString("en-US"),
            convLimit: usage.verifiedLimit.toLocaleString("en-US"),
          }
        ),
        limit: "usage",
        upgradeUrl: "/dashboard/billing",
      },
      { status: 402 }
    );
  }

  const results: SyncOutcome[] = [];
  const linked = new Set(links.map((l) => l.platform));

  const { startSyncRun, finishSyncRun } = await import("@/lib/integrationsStatus");

  // كل تشغيل يُسجَّل بنتيجته - هو المصدر الوحيد لـ"آخر مزامنة" وسجلّ النشاط
  // وصحّة التكامل في قسم التكاملات. من دونه تصبح تلك الأرقام مُختلَقة.
  async function runSync(platform: string, fn: () => Promise<unknown>) {
    const before = await prisma.metricSnapshot.count({ where: { workspaceId: id, platform: platform as never } });
    const runId = await startSyncRun(id, platform, "MANUAL");
    try {
      await fn();
      const after = await prisma.metricSnapshot.count({ where: { workspaceId: id, platform: platform as never } });
      await finishSyncRun(runId, { ok: true, recordsWritten: Math.max(0, after - before) });
      results.push({ platform, ok: true });
    } catch (err) {
      await finishSyncRun(runId, { ok: false, error: msg(err) });
      results.push({ platform, ok: false, error: msg(err) });
    }
  }

  if (linked.has("GOOGLE_ADS")) {
    await runSync("GOOGLE_ADS", async () => {
      const { syncGoogleAdsForWorkspace } = await import("@/lib/syncGoogleAds");
      await syncGoogleAdsForWorkspace(id);
    });
  }

  if (linked.has("META_ADS")) {
    await runSync("META_ADS", async () => {
      const { syncMetaAdsForWorkspace } = await import("@/lib/syncMetaAds");
      await syncMetaAdsForWorkspace(id);
    });
  }

  if (linked.has("TIKTOK_ADS")) {
    await runSync("TIKTOK_ADS", async () => {
      const { syncTikTokAdsForWorkspace } = await import("@/lib/syncTikTokAds");
      await syncTikTokAdsForWorkspace(id);
    });
  }

  const snapshotCount = await prisma.metricSnapshot.count({ where: { workspaceId: id } });
  const succeeded = results.filter((r) => r.ok).length;

  return NextResponse.json({
    ok: succeeded > 0,
    results,
    snapshotCount,
    // رسالة واحدة واضحة بدل ترك الواجهة تخمّن ما حدث
    summaryAr:
      succeeded === 0
        ? "تعذّرت المزامنة من كل المنصات المرتبطة."
        : snapshotCount === 0
        ? "تمت المزامنة، لكن المنصة لم تُرجع أي بيانات بعد. الحملات الجديدة قد تحتاج يوماً حتى تتوفّر أرقامها."
        : `تمت المزامنة بنجاح من ${succeeded} ${succeeded === 1 ? "منصة" : "منصات"}.`,
  });
}

// 🔴 **الفشل المجهول يُخزَّن غياباً لا جملةً عربية.**
//
// كان يُكتب «خطأ غير معروف» في `SyncRun.errorMessage`، وهو حقلٌ يُعرَض
// كما هو في سجلّ النشاط - فتظهر الجملة بالعربية داخل واجهةٍ إنجليزية
// عند مَن لغته الإنجليزية. ورسالة المنصّة نفسها (حين توجد) تُخزَّن كما
// جاءت: نصٌّ أجنبيّ ننقله لا نؤلّفه. وحين لا رسالة، يُترك الحقل فارغاً
// وتكتب الواجهة بديلها بلغة قارئها - وهي تفعل ذلك أصلاً.
function msg(err: unknown): string | undefined {
  if (err instanceof Error) return err.message.slice(0, 200);
  return undefined;
}
