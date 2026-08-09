// app/api/workspaces/active/route.ts
//
// اختيار مساحة العمل النشطة. تُحفظ في كوكي لأنها تفضيل عرض يخصّ الجلسة،
// وكل الصفحات تقرأها من مكان واحد بدل أن تفترض كل صفحة "أول مساحة".

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

// ملفات route في Next.js لا تسمح بتصدير أي شيء غير معالِجات HTTP -
// التصدير هنا كان يُفشل البناء. الثابت محلي، ويُقرأ في مكانه بالاسم نفسه.
const ACTIVE_WORKSPACE_COOKIE = "adloop_workspace";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const body = await req.json().catch(() => null);
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) return NextResponse.json({ error: t(locale, "apiErr.workspaceIdRequired") }, { status: 400 });

  // الملكية تُتحقّق دائماً: بدونها يمكن تمرير معرّف مساحة عمل لمستخدم آخر
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true });
}
