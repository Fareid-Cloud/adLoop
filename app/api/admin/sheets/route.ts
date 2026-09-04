// app/api/admin/sheets/route.ts - إنشاء رابط تغذية شيت وإلغاؤه
//
// **للمالك وحده** (`customers.export`): الرابط الواحد يخرج بقاعدة العملاء
// كلّها إلى ملفٍّ لا يحرسه أحد، وهو النوع الذي يتسرّب فعلاً - نفس منطق
// تصدير العملاء بالضبط.

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { validateOrError } from "@/lib/validation/schemas";
import { SHEET_DATASETS } from "@/lib/sheetFeed";

const createSchema = z.object({
  label: z.string().min(1).max(80),
  dataset: z.enum(SHEET_DATASETS),
});

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req, { capability: "customers.export", mutating: true, elevated: true });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(createSchema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const { label, dataset } = validation.data;

  // الرمزُ يُعرض مرّةً واحدة - المخزَّن هاشُه. الرابطُ سيعيش في خليّةٍ
  // داخل الشيت، فمكانُه هناك لا عندنا.
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  await prisma.sheetFeed.create({
    data: { label: label.trim(), dataset, tokenHash, createdById: guard.admin.id },
  });

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "SHEET_FEED_CREATE",
    details: `${guard.admin.email} created a ${dataset} sheet feed: ${label.trim()}`,
  });

  return NextResponse.json({ ok: true, token });
}

const revokeSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req, { capability: "customers.export", mutating: true });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(revokeSchema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  // إلغاءٌ لا حذف: الصفُّ يبقى ليُعرَف أنّ رابطاً كان موجوداً، وكم قُرئ،
  // ومتى أُغلق - وهي الأسئلة الثلاثة التي تُسأل بعد أيّ تسريب.
  const feed = await prisma.sheetFeed.update({
    where: { id: validation.data.id },
    data: { revokedAt: new Date() },
    select: { label: true, dataset: true },
  }).catch(() => null);
  if (!feed) return NextResponse.json({ error: "not found" }, { status: 404 });

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "SHEET_FEED_REVOKE",
    details: `${guard.admin.email} revoked the ${feed.dataset} sheet feed: ${feed.label}`,
  });

  return NextResponse.json({ ok: true });
}
