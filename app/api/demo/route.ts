// app/api/demo/route.ts
//
// يُنشئ مساحة العرض التجريبية للمستخدم (أو يعيد القائمة إن وُجدت).
//
// **يتطلّب تسجيل دخول:** البذر يكتب مئات الصفوف، فتركه مفتوحاً يجعله
// بوّابة إغراق لقاعدة البيانات. الديمو مفتوح للتصفّح لا للإنشاء.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { seedDemoWorkspace } from "@/lib/demo";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { allowed } = await checkRateLimit(getClientIp(req), `demo:${user.id}`, 5, 10);
  if (!allowed) return NextResponse.json({ error: "too many requests" }, { status: 429 });

  const locale = (user.preferredLocale as "ar" | "en") ?? "ar";
  const workspaceId = await seedDemoWorkspace(user.id, locale);

  return NextResponse.json({ ok: true, workspaceId });
}
