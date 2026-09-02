// app/api/ai/messages/[id]/rate/route.ts
//
// تقييم صاحب الحساب لإجابةٍ واحدة: 👍 أو 👎 أو سحبُ التقييم.
//
// **الملكيّةُ تُتحقَّق على المستخدم لا على المساحة**: المحادثة مربوطة
// بصاحبها (`AgentChat.userId`)، وفحصُ المساحة وحدَها كان بيخلّي أيّ حدّ
// في نفس المساحة يقيّم محادثةً مش بتاعته - ودي مش مسألة إذن، دي تلويثُ
// إشارةٍ بنبني عليها قراراتِ تحسين.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { verifyCsrfToken } from "@/lib/csrf";
import { validateOrError } from "@/lib/validation/schemas";

const schema = z.object({
  // `null` = سحبُ التقييم. رأيٌ اتغيّر لازم يقدر يترجع، وإلا الرقم
  // بيحتفظ بانطباعٍ صاحبُه تخلّى عنه.
  rating: z.union([z.literal(1), z.literal(-1), z.null()]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  // رسالةُ المساعد وحدها تُقيَّم - تقييمُ سؤالِ المستخدم نفسه بلا معنى،
  // وقبولُه بيدخل صفوفاً بتلخبط أيّ عدّ.
  const message = await prisma.agentMessage.findFirst({
    where: { id, role: "assistant", chat: { userId: user.id } },
    select: { id: true },
  });
  if (!message) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.agentMessage.update({
    where: { id },
    data: { rating: validation.data.rating },
  });

  return NextResponse.json({ ok: true, rating: validation.data.rating });
}
