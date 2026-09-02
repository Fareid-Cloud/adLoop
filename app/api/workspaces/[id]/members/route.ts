// app/api/workspaces/[id]/members/route.ts
//
// المقاعد: دعوةُ عضو، تغييرُ دوره، إزالتُه.
//
// **المالك وحده يدير المقاعد** - لا العضو ولو كان OPERATOR. مقعدُ تنفيذٍ
// بيقدر يوقف حملة، ولو قدر يدعو كمان يبقى يقدر يوسّع الوصول لنفسه بحدّ
// تاني، والحدُّ اللي الباقة بتبيعه بيبقى بلا معنى.

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { verifyCsrfToken } from "@/lib/csrf";
import { validateOrError } from "@/lib/validation/schemas";
import { getEntitlements } from "@/lib/entitlements";
import { workspaceOwnerFilter } from "@/lib/workspaceAccess";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

const inviteSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(["VIEWER", "OPERATOR"]),
});

/** أسبوع: أطول من كده الرابط بيتنسى في بريدٍ قديم ويفضل صالحاً. */
const INVITE_DAYS = 7;

/**
 * أعضاءُ المساحة ودعواتُها المعلَّقة وحدودُ الباقة.
 *
 * **للمالك وحده**: القائمة دي فيها بريدُ كلّ زميل ودورُه، وعضوٌ عادي
 * مالوش أن يعرف تركيبةَ الفريق كاملةً - ولا أن يشوف الحدود اللي هي
 * معلومةُ فوترةٍ لصاحب الحساب.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({
    where: { id, ...workspaceOwnerFilter(user.id) },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [members, invites, ent] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: id },
      orderBy: { createdAt: "asc" },
      select: { userId: true, role: true, user: { select: { name: true, email: true } } },
    }),
    // المعلَّقة وحدها: المقبولة بقت عضوية، وعرضُها مرّتين بيخلّي العدّ
    // المعروض يخالف العدّ المفروض.
    prisma.workspaceInvite.findMany({
      where: { workspaceId: id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
    getEntitlements(user.id),
  ]);

  return NextResponse.json({
    members: members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
    invites,
    seats: { viewer: ent.limits.seatsViewer, operator: ent.limits.seatsOperator },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  // المالكُ فقط: فلترُ الوصول بيشمل الأعضاء، وهو بالظبط اللي مايصحّش هنا.
  const workspace = await prisma.workspace.findFirst({
    where: { id, ...workspaceOwnerFilter(user.id) },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const validation = validateOrError(inviteSchema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const { email, role } = validation.data;
  const normalised = email.trim().toLowerCase();

  // 🔴 **الحدُّ يُفحص هنا، وإلّا فالباقة بتبيع رقماً بلا معنى.**
  // المدعوّون المعلَّقون بيتحسبوا: من غيرهم عشر دعوات لباقةٍ فيها مقعدان
  // بتتحوّل لعشر أعضاء أوّل ما يقبلوا.
  const ent = await getEntitlements(user.id);
  const cap = role === "OPERATOR" ? ent.limits.seatsOperator : ent.limits.seatsViewer;

  if (cap === 0) {
    return NextResponse.json({ error: t(locale, "seats.notOnPlan") }, { status: 403 });
  }
  if (cap > 0) {
    const [members, invites] = await Promise.all([
      prisma.workspaceMember.count({ where: { workspaceId: id, role } }),
      prisma.workspaceInvite.count({ where: { workspaceId: id, role, acceptedAt: null } }),
    ]);
    if (members + invites >= cap) {
      return NextResponse.json({ error: t(locale, "seats.limitReached") }, { status: 403 });
    }
  }

  // الرمزُ الخام بيرجع مرّة واحدة في الرد، والمخزَّن هاشُه: تسريبُ قاعدة
  // البيانات مايدّيش حدّ رابطَ دعوةٍ صالحاً.
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);

  await prisma.workspaceInvite.upsert({
    where: { workspaceId_email: { workspaceId: id, email: normalised } },
    create: { workspaceId: id, email: normalised, role, tokenHash, invitedById: user.id, expiresAt },
    // إعادةُ الدعوة بتجدّد الرمز: الدعوةُ المنتهية لازم يبقى ليها طريقُ
    // إحياءٍ غير الحذف واليدوي.
    update: { role, tokenHash, expiresAt, acceptedAt: null, invitedById: user.id },
  });

  return NextResponse.json({ ok: true, token, expiresAt });
}

const patchSchema = z.object({
  userId: z.string().min(1),
  // `null` = إزالة العضو.
  role: z.enum(["VIEWER", "OPERATOR"]).nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id, ...workspaceOwnerFilter(user.id) },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const validation = validateOrError(patchSchema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const { userId, role } = validation.data;

  if (role === null) {
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: id, userId } });
    return NextResponse.json({ ok: true, removed: true });
  }

  // الترقيةُ لـOPERATOR بتستهلك مقعدَ تنفيذ - فتُفحص زيّ الدعوة بالظبط،
  // وإلّا الحدُّ بيتخطّى بالترقية بدل الدعوة.
  if (role === "OPERATOR") {
    const ent = await getEntitlements(user.id);
    if (ent.limits.seatsOperator === 0) {
      return NextResponse.json({ error: t(localeOf(user), "seats.notOnPlan") }, { status: 403 });
    }
    if (ent.limits.seatsOperator > 0) {
      const current = await prisma.workspaceMember.count({
        where: { workspaceId: id, role: "OPERATOR", userId: { not: userId } },
      });
      if (current >= ent.limits.seatsOperator) {
        return NextResponse.json({ error: t(localeOf(user), "seats.limitReached") }, { status: 403 });
      }
    }
  }

  const updated = await prisma.workspaceMember.updateMany({
    where: { workspaceId: id, userId },
    data: { role },
  });
  if (updated.count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ ok: true, role });
}
