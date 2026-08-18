// app/api/workspaces/[id]/mcp-tokens/route.ts
//
// توليدُ مفاتيح الربط وإلغاؤها وسردُها. المفتاح نفسه يُعرَض **مرّةً واحدة**
// في جواب الإنشاء ولا يُسترجَع بعدها - المخزَّن بصمتُه لا هو.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { generateToken } from "@/lib/mcp/auth";

/** أكثر من هذا لا يُدار: مفاتيح لا يعرف صاحبها لِمَ وُلِّدت أخطرُ من قلّتها */
const MAX_TOKENS_PER_WORKSPACE = 10;

async function ownedWorkspace(req: NextRequest, id: string) {
  const user = await getSessionUser(req);
  if (!user) return null;
  const workspace = await prisma.workspace.findFirst({
    where: { id, userId: user.id },
    select: { id: true, userId: true },
  });
  return workspace ? { workspace, userId: user.id } : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownedWorkspace(req, id);
  if (!owned) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tokens = await prisma.mcpToken.findMany({
    where: { workspaceId: id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, lastFour: true, lastUsedAt: true, expiresAt: true, createdAt: true },
  });
  return NextResponse.json({ tokens });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownedWorkspace(req, id);
  if (!owned) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // الباقة تُفحَص هنا أيضاً لا في الواجهة وحدها: إخفاءُ زرٍّ ليس حدّاً.
  const ent = await getEntitlements(owned.userId);
  if (!ent.limits.mcp) return NextResponse.json({ error: "plan" }, { status: 403 });

  const live = await prisma.mcpToken.count({ where: { workspaceId: id, revokedAt: null } });
  if (live >= MAX_TOKENS_PER_WORKSPACE) {
    return NextResponse.json({ error: "tooMany", max: MAX_TOKENS_PER_WORKSPACE }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const label = String(body?.label ?? "").trim().slice(0, 60);
  const days = Number(body?.expiresInDays);
  const expiresAt =
    Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86_400_000) : null;

  const { token, hash, lastFour } = generateToken();
  const created = await prisma.mcpToken.create({
    data: { workspaceId: id, label: label || "AdLoop key", tokenHash: hash, lastFour, expiresAt },
    select: { id: true, label: true, lastFour: true, expiresAt: true, createdAt: true },
  });

  // النصّ الكامل هنا وهنا فقط.
  return NextResponse.json({ ...created, token });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownedWorkspace(req, id);
  if (!owned) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tokenId = String(body?.tokenId ?? "");
  if (!tokenId) return NextResponse.json({ error: "missingToken" }, { status: 400 });

  // المفتاح يُطابَق بمساحته أيضاً - معرّفٌ صحيحٌ لمساحةٍ أخرى لا يُلغى من هنا.
  const result = await prisma.mcpToken.updateMany({
    where: { id: tokenId, workspaceId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ error: "notFound" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
