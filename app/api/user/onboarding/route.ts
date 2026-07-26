// app/api/user/onboarding/route.ts
//
// حالة الأونبوردينج للمستخدم الحالي. يُستخدم لتسجيل التخطي الصريح حتى لا
// تُعاد الشاشة الإجبارية في كل دخول.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const data: { onboardingDismissed?: boolean; onboardingCompleted?: boolean; onboardingStep?: number } = {};
  if (typeof body.dismissed === "boolean") data.onboardingDismissed = body.dismissed;
  if (typeof body.completed === "boolean") data.onboardingCompleted = body.completed;
  if (typeof body.step === "number" && body.step >= 0 && body.step < 50) data.onboardingStep = body.step;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no valid fields" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true });
}
