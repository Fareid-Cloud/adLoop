// app/api/support/rating/route.ts - العميل بيقيّم الخدمة
//
// **بيتنده أكتر من مرّة للتقييم الواحد عن قصد**: دوسةُ الدرجة بتبعت
// الدرجة لوحدها، وكلُّ سببٍ بيتدوس بيبعت لوحده، والتعليقُ لمّا يُرسَل.
// الاستمارةُ اللي بتستنّى «إرسال» بتضيّع كلَّ حاجة لو العميل قفل - وأهمّ
// حاجة فيها (الرقم) بتبقى موجودةً من أوّل دوسة.
//
// الرحلةُ وقواعدُ السؤال كلُّها موصوفةٌ في `lib/supportRating.ts`.

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isValidScore, isRatingReason } from "@/lib/supportRating";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.triggerMessageId !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // 🔴 **الملكيّة تُتحقَّق من الرسالة لا من المحادثة المُرسَلة.**
  //
  // الطلبُ بيحمل معرَّفَ رسالة، والمحادثةُ بتتقري **منها** - فمعرَّفٌ
  // لرسالةٍ في محادثةِ عميلٍ تاني مالوش أيُّ طريق يوصل: الفلترُ بيربط
  // الاتنين في استعلامٍ واحد بدل ما يثق في اللي جه من العميل.
  const message = await prisma.supportMessage.findFirst({
    where: {
      id: body.triggerMessageId,
      fromSupport: true,
      thread: { userId: user.id, deletedAt: null },
    },
    select: {
      id: true,
      authorAdminId: true,
      thread: { select: { id: true, assignedToId: true } },
    },
  });
  if (!message) return NextResponse.json({ error: "not found" }, { status: 404 });

  const dismissed = body.dismissed === true;

  const score = isValidScore(body.score) ? body.score : undefined;
  if (!dismissed && score === undefined && body.score !== undefined) {
    return NextResponse.json({ error: "invalid score" }, { status: 400 });
  }

  const reasons: string[] | undefined = Array.isArray(body.reasons)
    ? [...new Set((body.reasons as unknown[]).filter(isRatingReason))].slice(0, 6)
    : undefined;

  const comment =
    typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) || null : undefined;

  // **المسؤولُ بيتحفظ لحظةَ التقييم.** المحادثةُ بتتنقل بين الموظّفين
  // بعد كده، وقراءةُ المسؤول الحاليّ وقتَ التقرير كانت هتنسب رأيَ العميل
  // لحدّ مالوش علاقة بالخدمة اللي قيّمها. والأولويّةُ لمَن **ردّ** فعلاً،
  // والتعيينُ بديلٌ لمّا الردّ يكون قديماً بلا مؤلِّف.
  const agentId = message.authorAdminId ?? message.thread.assignedToId ?? null;

  const row = await prisma.supportRating.upsert({
    where: {
      threadId_triggerMessageId: {
        threadId: message.thread.id,
        triggerMessageId: message.id,
      },
    },
    create: {
      threadId: message.thread.id,
      triggerMessageId: message.id,
      agentId,
      score: score ?? null,
      reasons: reasons ?? [],
      comment: comment ?? null,
      dismissedAt: dismissed ? new Date() : null,
    },
    // التحديثُ جزئيّ: كلُّ نداءٍ بيكتب اللي جه فيه وبس، فبعتةُ التعليق
    // مابتمسحش الدرجة اللي اتحفظت قبلها بدقيقة.
    update: {
      ...(score !== undefined ? { score } : {}),
      ...(reasons !== undefined ? { reasons } : {}),
      ...(comment !== undefined ? { comment } : {}),
      ...(dismissed ? { dismissedAt: new Date() } : {}),
      // درجةٌ بعد رفضٍ سابق بتلغي الرفض: غيّر رأيه، والصفُّ لازم يعبّر عن ده.
      ...(score !== undefined && !dismissed ? { dismissedAt: null } : {}),
      ...(agentId ? { agentId } : {}),
    } satisfies Prisma.SupportRatingUncheckedUpdateInput,
    select: { score: true, reasons: true, comment: true, dismissedAt: true },
  });

  return NextResponse.json({ ok: true, rating: row });
}
