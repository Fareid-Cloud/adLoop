// app/api/demo/route.ts
//
// يُنشئ مساحة العرض التجريبية **ويفعّلها**.
//
// **التفعيل جزء من العملية لا خطوة تالية:** تمرير `?ws=` في الرابط كان
// بلا أثر، لأن المساحة النشطة تُقرأ من كوكي `adloop_workspace` وحده -
// فتُنشأ المساحة ولا يراها المستخدم أبداً.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { seedDemoWorkspace } from "@/lib/demo";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const ACTIVE_WORKSPACE_COOKIE = "adloop_workspace";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { allowed } = await checkRateLimit(getClientIp(req), `demo:${user.id}`, 5, 10);
  if (!allowed) return NextResponse.json({ error: "too many requests" }, { status: 429 });

  const locale = (user.preferredLocale as "ar" | "en") ?? "ar";
  const workspaceId = await seedDemoWorkspace(user.id, locale);

  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, workspaceId });
}
