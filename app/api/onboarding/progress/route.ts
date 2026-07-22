// app/api/onboarding/progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { step, completed, dismissed } = await req.json();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(step !== undefined ? { onboardingStep: step } : {}),
      ...(completed !== undefined ? { onboardingCompleted: completed } : {}),
      ...(dismissed !== undefined ? { onboardingDismissed: dismissed } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
