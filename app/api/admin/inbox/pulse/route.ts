// app/api/admin/inbox/pulse/route.ts - «فيه جديد؟» في استعلامٍ واحد رخيص
//
// 🔴 **الصندوق كان بيعيد رسم الصفحة كلّها كلّ عشر ثوانٍ.**
//
// `router.refresh()` بيرجّع تصييرَ مكوّن الخادم من أوّله: قائمةُ الستّين
// محادثة برسائلها، وتلاتُ عمليّاتِ تجميعٍ للعدّادات، وقائمةُ الفريق،
// و**خمسمئة صفٍّ من الوسوم**، والمحادثةُ المفتوحة بكلّ رسائلها، وتاريخُها،
// والصور. عشرةُ استعلامات كلّ عشر ثوانٍ لكلّ تبويبٍ مفتوح - وأغلبُها
// بيرجّع نفس البايتات بالظبط اللي رجعها قبلها بعشر ثوانٍ.
//
// وتبويبٌ متروكٌ مفتوح يومَ شغلٍ كامل بيعمل لوحده ~٢٩ ألف استعلام. ده
// اللي بيولّع حدَّ نقل البيانات في قاعدة البيانات بلا ما حدٌّ يفتح صفحة.
//
// النبضةُ دي بديلُه: رقمان بيوصفوا حالةَ الصندوق - عددُ المحادثات وأحدثُ
// لحظةِ رسالة. لو الاتنين زيّ ما هما، مافيش حاجة اتغيّرت، والتصييرُ
// الكامل مابيحصلش أصلاً. ولمّا يتغيّر أيُّ واحدٍ فيهم، ساعتها بس بنطلب
// الصفحة تاني.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req, { capability: "support.handle" });
  if (!guard.ok) return guard.response;

  // تجميعةٌ واحدة، بلا صفوف: العدّ وأحدثُ لحظة من فهرسٍ موجود أصلاً.
  const agg = await prisma.supportThread.aggregate({
    where: { deletedAt: null },
    _count: { _all: true },
    _max: { lastMessageAt: true, updatedAt: true },
  });

  return NextResponse.json({
    n: agg._count._all,
    // `updatedAt` جنب `lastMessageAt`: التاني بيتحرّك بالرسائل وحدها،
    // والأوّل بيلتقط التعيين والوسم والإغلاق من زميلٍ تاني - وهي تغييراتٌ
    // المفروض تبان كمان، بس بلا تصييرٍ دائم.
    t: Math.max(
      agg._max.lastMessageAt?.getTime() ?? 0,
      agg._max.updatedAt?.getTime() ?? 0
    ),
  });
}
