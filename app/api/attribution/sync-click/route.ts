// app/api/attribution/sync-click/route.ts
//
// كل ما كليك جديد يتسجل في wa-conversion-tracker، بننده هنا فوراً
// (async، مش بلوكينج) عشان يبقى موجود كـ"مرشح" جاهز لمحرك الإسناد لو
// المحادثة اللي بعده جت من غير كود Ref واضح.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalServiceAuth } from "@/lib/internalServiceAuth";

export async function POST(req: NextRequest) {
  if (!verifyInternalServiceAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { workspaceId, platform, code, gclid, phoneHint, ipAddress, userAgent, clickedAt } = body;

  if (!workspaceId || !platform || !code || !clickedAt) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  await prisma.unmatchedClick.create({
    data: {
      workspaceId,
      platform,
      code,
      gclid: gclid ?? null,
      phoneHint: phoneHint ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      clickedAt: new Date(clickedAt),
    },
  });

  return NextResponse.json({ ok: true });
}
