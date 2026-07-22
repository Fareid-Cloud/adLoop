// app/api/auth/mfa/verify-setup/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyMfaCode, encryptMfaSecret } from "@/lib/mfa";
import { validateOrError } from "@/lib/validation/schemas";
import { verifyCsrfToken } from "@/lib/csrf";

const schema = z.object({
  secret: z.string().min(1),
  code: z.string().length(6, "الكود 6 أرقام"),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const rawBody = await req.json();
  const validation = validateOrError(schema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { secret, code } = validation.data;

  const isValid = await verifyMfaCode(secret, code);
  if (!isValid) {
    return NextResponse.json({ error: "الكود غير صحيح - تأكد من الوقت في تطبيق المصادقة" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: encryptMfaSecret(secret), mfaEnabled: true },
  });

  return NextResponse.json({ success: true });
}
