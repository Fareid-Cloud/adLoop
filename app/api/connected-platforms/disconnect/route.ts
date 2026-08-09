// app/api/connected-platforms/disconnect/route.ts
//
// سياسة جوجل بتطلب صراحة: العميل لازم يقدر يفصل حسابه في أقل من 3 أيام
// عمل. الزرار ده بيمسح التوكن فوراً - العميل مش محتاج يستنى حتى دقيقة.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const { platform } = await req.json();
  if (!platform) return NextResponse.json({ error: t(locale, "apiErr.platformRequired") }, { status: 400 });

  await prisma.connectedPlatform.deleteMany({
    where: { userId: user.id, platform },
  });

  return NextResponse.json({ success: true });
}
