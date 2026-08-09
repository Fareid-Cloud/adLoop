// app/api/auth/verify-email/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n/dictionary";
import { localeOfRequest } from "@/lib/apiLocale";

export async function POST(req: NextRequest) {
  // لا جلسة بعد في هذا المسار، فاللغة من ترويسة المتصفّح
  const locale = localeOfRequest(req);
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: t(locale, "apiErr.tokenRequired") }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { verificationToken: token } });

  if (!user) {
    return NextResponse.json({ error: t(locale, "apiErr.verifyLinkInvalid") }, { status: 400 });
  }

  if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: t(locale, "apiErr.verifyLinkExpired") }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null, verificationTokenExpiresAt: null },
  });

  return NextResponse.json({ success: true });
}
