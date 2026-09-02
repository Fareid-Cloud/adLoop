// app/api/admin/channels/route.ts
//
// ربطُ قناةِ مراسلة وفكُّها.
//
// **`elevated` مطلوب:** التوكن ده بيقدر يبعت رسائل باسم البيزنس لأيّ حدّ
// كلّمه. حدٌّ ماسك جلسةً مسروقة بيقدر يربط رقمَه هو ويستقبل محادثات
// عملائك - فده فعلٌ يستاهل إثباتاً طازجاً بقدر أيّ فعلٍ ماليّ.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { validateOrError } from "@/lib/validation/schemas";
import { encryptToken } from "@/lib/encryption";
import { logAdminAction } from "@/lib/adminAudit";

const createSchema = z.object({
  channel: z.enum(["WHATSAPP", "MESSENGER"]),
  externalId: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(80),
  accessToken: z.string().trim().min(20),
  appSecret: z.string().trim().min(8),
  verifyToken: z.string().trim().min(8).max(128),
});

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req, {
    capability: "flags.manage",
    mutating: true,
    elevated: true,
  });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(createSchema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const d = validation.data;

  // 🔴 السرّان مشفَّران قبل ما يلمسوا القاعدة - نفس آلية توكنات المنصّات.
  // وبيتكتبوا بـ`upsert` فإعادةُ الربط بتوكنٍ متجدّد بتحدّث الصفّ بدل ما
  // تفشل على المفتاح الفريد، وده بالظبط اللي بيحصل كلّ تجديد.
  await prisma.channelConnection.upsert({
    where: { channel_externalId: { channel: d.channel, externalId: d.externalId } },
    create: {
      channel: d.channel,
      externalId: d.externalId,
      label: d.label,
      accessToken: encryptToken(d.accessToken),
      appSecret: encryptToken(d.appSecret),
      verifyToken: d.verifyToken,
      active: true,
    },
    update: {
      label: d.label,
      accessToken: encryptToken(d.accessToken),
      appSecret: encryptToken(d.appSecret),
      verifyToken: d.verifyToken,
      active: true,
    },
  });

  // بلا أيّ جزءٍ من السرّ في السجلّ - السجلّ بيقول "مين ربط إيه"، مش
  // بيحتفظ بنسخةٍ تانية من المفتاح.
  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "CHANNEL_CONNECTED",
    details: `${d.channel} · ${d.label}`,
  });

  return NextResponse.json({ ok: true });
}

const patchSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req, {
    capability: "flags.manage",
    mutating: true,
    elevated: true,
  });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(patchSchema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  // إيقافٌ لا حذف: الحذفُ بيخلّي الرسائل الواردة تفتح محادثاتٍ بلا طريقِ
  // ردّ - والإيقاف بيوقف الاستقبال والإرسال معاً.
  const updated = await prisma.channelConnection.updateMany({
    where: { id: validation.data.id },
    data: { active: validation.data.active },
  });
  if (updated.count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: validation.data.active ? "CHANNEL_ENABLED" : "CHANNEL_DISABLED",
    details: validation.data.id,
  });

  return NextResponse.json({ ok: true });
}
