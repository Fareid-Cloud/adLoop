// app/api/sheets/[token]/route.ts - المسار الذي يقرأ منه Google Sheets
//
// **عامٌّ بلا جلسة عن قصد.** دالّة `IMPORTDATA` في الشيت لا ترسل كوكيز ولا
// ترويسة تفويض - ولا يمكن أن ترسل. فالإذن يعيش في الرابط نفسه، وهذا يعني
// أنّ الرابط **كلمةُ سرّ**: من ملكه قرأ.
//
// ولذلك يُخزَّن هاشُه لا نصُّه، ويُلغى بضغطة، وتُسجَّل كلُّ قراءة بوقتها
// وعددها - رابطٌ مسرَّب يبان من قفزةٍ في العدّاد قبل أن يبان من غيرها.
//
// وحدُّ المعدّل هنا ليس ترفاً: مسارٌ عامّ يقرأ خمسة آلاف صفّ من قاعدة
// البيانات، ونداءٌ متكرّر عليه يستهلك نقلَ بياناتٍ حقيقيّاً - وهو ما أوقع
// القاعدة مرّةً في هذا المشروع فعلاً.

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { buildSheetCsv, isSheetDataset } from "@/lib/sheetFeed";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  // الشيت يحدّث نفسه كلّ ساعة تقريباً بلا تدخّل، فستّون قراءةً في الساعة
  // أوسع بكثير من أيّ استعمالٍ حقيقيّ وأضيق بكثير من أيّ سحبٍ آليّ.
  const limit = await checkRateLimit(`sheet:${getClientIp(req)}`, "sheet-feed", 60, 60);
  if (!limit.allowed) {
    return new NextResponse("rate limited", { status: 429 });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const feed = await prisma.sheetFeed.findUnique({
    where: { tokenHash },
    select: { id: true, dataset: true, revokedAt: true },
  });

  // رسالةٌ واحدة للحالتين (غير موجود / ملغى): التفرقة تقول لحاملِ رابطٍ
  // مسروق إن كان صالحاً يوماً ما.
  if (!feed || feed.revokedAt || !isSheetDataset(feed.dataset)) {
    return new NextResponse("not found", { status: 404 });
  }

  const csv = await buildSheetCsv(feed.dataset);

  // التسجيل بعد بناء الردّ لا قبله: قراءةٌ فشلت لا تُحسب قراءة.
  await prisma.sheetFeed
    .update({
      where: { id: feed.id },
      data: { lastReadAt: new Date(), readCount: { increment: 1 } },
    })
    .catch(() => {});

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      // بيانات تواصل عملاء: لا تُخزَّن في أيّ وسيط بين الشيت وبيننا.
      "cache-control": "no-store, private",
      // لا يُفهرَس ولا يُتبَع، لو تسرّب الرابط يوماً إلى صفحةٍ عامة.
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
