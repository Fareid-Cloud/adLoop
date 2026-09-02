// app/api/admin/agent/[id]/review/route.ts
//
// حكمُ المراجِع على إجابةٍ واحدة.
//
// **مش `elevated`** بقرار: المراجعة فعلٌ بيتكرّر عشرات المرّات في الجلسة
// الواحدة، وطلبُ كلمة السر مع كلّ حكم بيحوّل المراجعة لعذاب فتتوقف - وهي
// كتابةٌ على صفٍّ داخليّ ما بتمسّش حساب عميل ولا فلوس ولا صلاحية. قفلُ
// دخول اللوحة (`guardAdmin`) هو الحارس المناسب هنا.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { validateOrError } from "@/lib/validation/schemas";
import { VERDICTS } from "@/lib/admin/agentReview";

const schema = z.object({
  verdict: z.enum(VERDICTS.map((v) => v.key) as [string, ...string[]]),
  note: z.string().max(2000).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const guard = await guardAdmin(req, { capability: "agent.review", mutating: true });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  // رسالةُ المساعد وحدها تُحكَم عليها - حكمٌ على سؤال المستخدم بلا معنى.
  const message = await prisma.agentMessage.findFirst({
    where: { id, role: "assistant" },
    select: { id: true },
  });
  if (!message) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.agentMessage.update({
    where: { id },
    data: {
      verdict: validation.data.verdict,
      reviewNote: validation.data.note ?? null,
      reviewedById: guard.admin.id,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, verdict: validation.data.verdict });
}
