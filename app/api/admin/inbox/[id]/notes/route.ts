// app/api/admin/inbox/[id]/notes/route.ts
//
// الملاحظات الداخلية على محادثة.
//
// **مسارٌ منفصل عن `reply` عن قصد.** لو الاتنين مسارٌ واحد بعلامة
// `internal: true`، فأوّل خطأ في الواجهة أو في تحقّقٍ ناقص بيبعت ملاحظةً
// داخلية للعميل - وده فعلٌ مالوش تراجع. الفصلُ في المسار وفي الجدول
// بيخلّي الغلط ده **مستحيل بالبنية** لا ممنوعاً بشرط.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { validateOrError } from "@/lib/validation/schemas";

const schema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const guard = await guardAdmin(req, { capability: "support.handle", mutating: true });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const thread = await prisma.supportThread.findUnique({ where: { id }, select: { id: true } });
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });

  const note = await prisma.supportNote.create({
    data: { threadId: id, authorId: guard.admin.id, body: validation.data.body },
    select: {
      id: true, body: true, createdAt: true,
      author: { select: { name: true, email: true } },
    },
  });

  // **بلا لمس `lastMessageAt`**: الملاحظة مش رسالة، وترتيبُ "الأحدث فوق"
  // بيوصف وصولَ رسائل العملاء. رفعُ محادثةٍ لأنّ حدّ كتب لنفسه ملاحظة
  // بيخلّي الترتيب يوصف نشاطَنا لا نشاطَهم.
  return NextResponse.json({ note });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const guard = await guardAdmin(req, { capability: "support.handle", mutating: true });
  if (!guard.ok) return guard.response;

  const noteId = req.nextUrl.searchParams.get("noteId");
  if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 });

  // الشرط بيشمل `threadId` كمان: معرّفُ ملاحظةٍ من محادثةٍ تانية مايمسحش
  // من هنا، حتى لو صاحبُه أدمن - المسار بيتكلّم عن محادثةٍ بعينها.
  const deleted = await prisma.supportNote.deleteMany({ where: { id: noteId, threadId: id } });
  if (deleted.count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
