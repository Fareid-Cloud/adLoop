// lib/supportUnread.ts
//
// 🔴 **رقمٌ واحد، ومسارٌ واحد يحسبه.**
//
// «رسالتان من الدعم» كانت بتفضل على الشاشة بعد ما العميل يقرأهما ويقفل
// ويرجع - وكان السبب إنّ نفس الرقم كان بيتحسب في تلات أماكن **بتلات
// نطاقات مختلفة**:
//
//   • `GET /api/support` بيحسبه على **أحدث محادثة** للعميل - وهي الوحيدة
//     اللي الودجت بتعرضها.
//   • `GET /api/live` (اللي بيرسم الشارة الحمراء) بيحسبه على **كلّ**
//     محادثاته، والمحذوفةَ منها كمان.
//   • `POST /api/support/read` بيعلّم المقروء على **محادثةٍ واحدة** بمعرَّفها.
//
// فأيُّ ردٍّ على محادثةٍ أقدم بيتعدّ في الشارة للأبد: الودجت مابتعرضهوش،
// فمابيتعلّمش مقروءاً، فالشارة مابتنطفيش. وأسوأ من كده: الودجت كانت
// بتبعت `POST /api/support/read` **مع كلّ نبضة استطلاع** وهي بتحاول
// تصفّر رقماً مش بتاعها - طلبٌ كلّ عشر ثوانٍ بلا نهاية.
//
// الحلّ إنّ العدّ والتصفير يتّفقوا على نطاقٍ واحد بحكم البناء لا بحكم
// الانتباه: **يُعدّ اللي العميل يقدر يفتحه**، ويُصفَّر **كلُّ** اللي عنده
// عشان صفٌّ قديمٌ عالق مايقدرش يرجّع الشارة تاني.

import { prisma } from "@/lib/prisma";

/** أحدثُ محادثةٍ حيّة للعميل - **وهي اللي الودجت بتعرضها**.
 *  داخليّةٌ عن قصد: اللي بره محتاج العدّ أو التصفير، مش المعرَّف. */
async function currentSupportThreadId(userId: string): Promise<string | null> {
  const row = await prisma.supportThread.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { lastMessageAt: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * عددُ ردود الدعم اللي لسه ما اتشافتش **في المحادثة المعروضة**.
 *
 * مقصورٌ عليها عن قصد: شارةٌ بتعدّ ردّاً في محادثةٍ مافيش زرّ يوصّل لها
 * بتوعد بحاجةٍ مش موجودة، والعميل بيدوس وبيلاقي نفس الكلام.
 */
export async function supportUnreadCount(userId: string): Promise<number> {
  const threadId = await currentSupportThreadId(userId);
  if (!threadId) return 0;
  return prisma.supportMessage.count({
    where: { threadId, fromSupport: true, readByUser: false },
  });
}

/**
 * تعليمُ ردود الدعم مقروءةً - **على كلّ محادثات العميل الحيّة**.
 *
 * أوسعُ من العدّ عن قصد: أيُّ صفٍّ قديمٍ ما اتعلّمش (من محادثةٍ اتقفلت أو
 * قناةٍ تانية) بيفضل قنبلةً موقوتة تولّع الشارة تاني أوّل ما نطاقُ العدّ
 * يتوسّع لأيّ سبب. التصفيرُ الشامل بيقفل الباب ده نهائياً، ومالوش ضرر:
 * العميل فتح الدعم فعلاً.
 */
export async function markSupportRead(userId: string): Promise<void> {
  await prisma.supportMessage.updateMany({
    where: {
      fromSupport: true,
      readByUser: false,
      thread: { userId, deletedAt: null },
    },
    data: { readByUser: true },
  });
}
