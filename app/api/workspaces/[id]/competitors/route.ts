// app/api/workspaces/[id]/competitors/route.ts

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const MAX_COMPETITORS = 40;

async function authorize(req: NextRequest, workspaceId: string) {
  const user = await getSessionUser(req);
  if (!user) return false;
  const ws = await prisma.workspace.findFirst({
    where: { id: workspaceId, ...workspaceAccess(user.id) },
    select: { id: true },
  });
  return !!ws;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await authorize(req, id))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const count = await prisma.competitor.count({ where: { workspaceId: id } });
  if (count >= MAX_COMPETITORS) return NextResponse.json({ error: "limit reached" }, { status: 400 });

  const competitor = await prisma.competitor.create({
    data: {
      workspaceId: id,
      name,
      pageUrl: safeUrl(body?.pageUrl),
      country: typeof body?.country === "string" ? body.country.slice(0, 4) : "EG",
      notes: typeof body?.notes === "string" ? body.notes.slice(0, 500) : null,
    },
  });
  return NextResponse.json({ competitor });
}

/** روابط فقط بمخطّط http(s) - نصّ حرّ في href يفتح باب javascript: */
function safeUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    const u = new URL(v.trim().startsWith("http") ? v.trim() : `https://${v.trim()}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}
