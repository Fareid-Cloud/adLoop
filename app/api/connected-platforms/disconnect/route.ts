// app/api/connected-platforms/disconnect/route.ts
//
// سياسة جوجل بتطلب صراحة: العميل لازم يقدر يفصل حسابه في أقل من 3 أيام
// عمل. الزرار ده بيمسح التوكن فوراً - العميل مش محتاج يستنى حتى دقيقة.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { platform } = await req.json();
  if (!platform) return NextResponse.json({ error: "platform مطلوبة" }, { status: 400 });

  await prisma.connectedPlatform.deleteMany({
    where: { userId: user.id, platform },
  });

  return NextResponse.json({ success: true });
}
