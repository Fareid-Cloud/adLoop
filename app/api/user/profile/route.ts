// app/api/user/profile/route.ts
//
// نقطة واحدة لتحديث كل إعدادات المستخدم الشخصية (الملف الشخصي + التفضيلات) -
// بدل ما يكون فيه route منفصل لكل حقل، عشان يفضل بسيط ومتسق.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const ALLOWED_FIELDS = [
  "name",
  "avatarIcon",
  "avatarImageUrl",
  "preferredLocale",
  "themeColor",
  "themeMode",
  "timezone",
  "businessScale",
] as const;

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();

  // بنسمح بس بالحقول المحددة مقدماً - حماية من إن حد يحاول يعدل حقول
  // حساسة (زي passwordHash أو email) عن طريق نفس الـ endpoint ده
  const data: Record<string, any> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) data[field] = body[field];
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
  });

  return NextResponse.json({
    user: {
      name: updated.name,
      avatarIcon: updated.avatarIcon,
      avatarImageUrl: updated.avatarImageUrl,
      preferredLocale: updated.preferredLocale,
      themeColor: updated.themeColor,
      themeMode: updated.themeMode,
      timezone: updated.timezone,
      businessScale: updated.businessScale,
    },
  });
}
