// app/api/feedback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { feedbackSchema, validateOrError } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rawBody = await req.json();
  const validation = validateOrError(feedbackSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { message, category } = validation.data;

  await prisma.feedback.create({
    data: { userId: user.id, message: message.trim(), category: category || null },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
