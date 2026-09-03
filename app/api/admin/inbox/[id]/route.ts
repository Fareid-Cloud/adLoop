// app/api/admin/inbox/[id]/route.ts
//
// تعديلاتُ المحادثة: تثبيت، تعيين، وسوم، حالة، مقروء، حذف ناعم.
//
// **مسارٌ واحد لكلّها بـ`PATCH` لا ستّة مسارات.** الأفعالُ دي كلها كتابةٌ
// على نفس الصفّ بنفس الحارس ونفس فحص الوجود، وتفريقُها كان بيكرّر
// التلاتة ستّ مرّات - وأوّل واحدة تُنسى فيها خطوة تبقى هي الثغرة.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { isOwnerRole } from "@/lib/adminRole";
import { validateOrError } from "@/lib/validation/schemas";

const schema = z.object({
  pinned: z.boolean().optional(),
  // `null` = رفعُ التعيين. الفرق بينه وبين الغياب مقصود: الغيابُ "ماتلمسش"،
  // و`null` "شيل المعيَّن".
  assignedToId: z.string().min(1).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
  status: z.enum(["OPEN", "ANSWERED", "CLOSED", "ARCHIVED"]).optional(),
  /** علامةُ «غير مقروء» اليدوية - عكسُ `markRead`. */
  markUnread: z.boolean().optional(),
  /** فتحُ المحادثة بيعلّمها مقروءة - الوقت من الخادم لا من العميل. */
  markRead: z.boolean().optional(),
  deleted: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const guard = await guardAdmin(req, { capability: "support.handle", mutating: true });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const body = validation.data;

  const thread = await prisma.supportThread.findUnique({ where: { id }, select: { id: true } });
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });

  // المعيَّنُ لازم يكون حساباً إدارياً فعلاً: تعيينُ محادثةٍ لعميل بيخفيها
  // من كلّ فلتر بيتفرّج عليه الفريق، فتضيع بصمت.
  if (body.assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: { id: body.assignedToId, isAdmin: true },
      select: { id: true },
    });
    if (!assignee) {
      return NextResponse.json({ error: "that account cannot be assigned conversations" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (body.pinned !== undefined) data.pinned = body.pinned;
  if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId;
  if (body.tags !== undefined) {
    // تطبيعٌ عند الكتابة لا عند القراءة: وسمان يختلفان في حرفٍ كبير
    // بيبقوا وسمين في الفلتر، وده بيفتّت التنظيم اللي الوسوم موجودة عشانه.
    data.tags = [...new Set(body.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  }
  if (body.status !== undefined) {
    data.status = body.status;
    data.closedAt = body.status === "CLOSED" || body.status === "ARCHIVED" ? new Date() : null;
    // وقتُ الأرشفة هو بدايةُ عدّاد الحذف التلقائيّ - يُضبط مرّةً عند
    // الدخول للأرشيف، ويُمسح عند الخروج منه فالعدّادُ بيقف.
    data.archivedAt = body.status === "ARCHIVED" ? new Date() : null;
  }
  if (body.markRead) data.readByAdminAt = new Date();
  // `null` بيرجّعها غير مقروءة: الحالةُ مشتقّةٌ من المقارنة بـ`lastMessageAt`،
  // فمسحُ الوقت بيخلّي أيّ رسالةٍ فيها أحدثَ منه - وهي كلُّها.
  if (body.markUnread) data.readByAdminAt = null;

  // 🔴 **الحذفُ النهائيّ للمالك وحده.** الدعمُ بيأرشف، والأرشيفُ بيتحذف
  // لوحده بعد شهر. أمّا مسحُ شكوى عميلٍ فوراً فقرارُ صاحب المنتج - وحارسُ
  // `support.handle` وحده كان بيدّي الدعمَ نفس القدرة.
  if (body.deleted !== undefined) {
    if (!isOwnerRole(guard.admin)) {
      return NextResponse.json({ error: "only the owner can delete a conversation" }, { status: 403 });
    }
    data.deletedAt = body.deleted ? new Date() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing to change" }, { status: 400 });
  }

  await prisma.supportThread.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
