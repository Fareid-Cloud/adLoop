// app/api/creatives/quality-check/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { auditAdImageQuality } from "@/lib/imageQualityAudit";
import { checkAndConsumeImageQualityQuota } from "@/lib/aiRateLimit";
import { blockAiInDemo } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const { imageUrl, platform, workspaceId } = await req.json();
  if (!imageUrl || !platform || !workspaceId) {
    return NextResponse.json({ error: t(locale, "apiErr.qualityCheckFields") }, { status: 400 });
  }

  // ملكيّة المساحة تُتحقَّق قبل أيّ نداء: المعرّف يصل من العميل، فقبوله كما
  // ورد يعني أنّ أيّ حساب يصرف من حصّة غيره.
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  // نداء ذكاء اصطناعي حقيقيّ يُصرَف من مساحة عرض: يشتري رأياً في صورة مثال.
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
  const quota = await checkAndConsumeImageQualityQuota(user.id);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error:
          quota.reason === "hourly_exhausted"
            ? t(locale, "apiErr.imgQuotaHourly", { n: quota.retryAfterMinutes ?? 60 })
            : t(locale, "apiErr.imgQuotaMonthly"),
        upgradeUrl: quota.reason === "monthly_exhausted" ? "/dashboard/billing" : undefined,
      },
      { status: 429 }
    );
  }

  const result = await auditAdImageQuality(imageUrl, platform, (user.preferredLocale as "ar" | "en") ?? "ar");
  if (!result) {
    return NextResponse.json({ error: t(locale, "apiErr.imageUnreadable") }, { status: 422 });
  }

  return NextResponse.json(result);
}
