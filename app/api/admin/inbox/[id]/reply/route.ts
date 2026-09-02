// app/api/admin/inbox/[id]/reply/route.ts
//
// ردُّ الدعم - يُكتب عندنا أوّلاً، ويُوصَّل بعدها.
//
// **الترتيب مقصود:** لو التوصيل اتقدّم على الكتابة وفشلت الكتابة، يبقى
// العميل استلم ردّاً مالوش أثرٌ عندنا - فالدعم بيردّ تاني على نفس الشيء
// والتاريخ بيكدب. والعكس (اتكتب وما اتوصّلش) بيسيب أثراً ظاهراً يتصلّح،
// وده أهون. فالفشلُ في التوصيل بيترجع للواجهة كتحذير على ردٍّ **محفوظ**،
// لا كخطأٍ بيرمي كلّ حاجة.

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { validateOrError } from "@/lib/validation/schemas";
import { deliverReply } from "@/lib/channels/outbound";
import { sendPushToUser } from "@/lib/webPush";

const schema = z.object({
  body: z.string().trim().min(1).max(8000),
  imageUrls: z.array(z.string().url()).max(6).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const guard = await guardAdmin(req, { capability: "support.handle", mutating: true });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const thread = await prisma.supportThread.findUnique({
    where: { id },
    select: {
      id: true, channel: true, externalId: true, userId: true,
      messages: {
        where: { fromSupport: false },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });

  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.supportMessage.create({
      data: {
        threadId: id,
        fromSupport: true,
        body: validation.data.body,
        imageUrls: validation.data.imageUrls ?? [],
        readByUser: false,
        authorAdminId: guard.admin.id,
        createdAt: now,
      },
      select: { id: true, createdAt: true },
    });

    await tx.supportThread.update({
      where: { id },
      data: {
        status: "ANSWERED",
        lastMessageAt: now,
        // الردُّ بيعلّمها مقروءة: اللي بيردّ قراها بالتأكيد، وتركُها غير
        // مقروءة بيخلّيها ترجع تطلب انتباهاً اتصرف عليه فعلاً.
        readByAdminAt: now,
      },
    });

    return created;
  });

  const delivery = await deliverReply({
    channel: thread.channel,
    externalThreadId: thread.externalId,
    lastInboundAt: thread.messages[0]?.createdAt ?? null,
    body: validation.data.body,
  });

  if (delivery.ok && delivery.externalId) {
    await prisma.supportMessage
      .update({ where: { id: message.id }, data: { externalId: delivery.externalId } })
      .catch(() => {});
  }

  // إشعارُ العميل المسجَّل - لشات الموقع تحديداً، لأنّ باقي القنوات
  // بتوصّل الإشعار بنفسها. وبعد الردّ عشان الرد مايستنّاش الدفع.
  if (thread.userId && thread.channel === "WEB") {
    const userId = thread.userId;
    const preview = validation.data.body.slice(0, 120);
    try {
      after(() =>
        sendPushToUser(userId, {
          title: "Support replied",
          body: preview,
          url: "/dashboard/support",
        }).catch(() => {})
      );
    } catch {
      // بره سياق الطلب - نادر هنا، والفشل مايستاهلش إسقاط الردّ.
    }
  }

  return NextResponse.json({
    ok: true,
    id: message.id,
    // الردُّ محفوظ في كلّ الحالات؛ ده بيقول هل وصل كمان.
    delivery: delivery.ok ? { ok: true } : { ok: false, reason: delivery.reason },
  });
}
