// app/api/mcp/oauth/approve/route.ts
//
// ما بعد ضغطة «أوافق»: تُصدَر الشفرة ويُعاد التوجيه إلى العميل.
//
// **ويُعاد التحقّق من كلّ شيء هنا من جديد** - العميل، وعنوان العودة، وملكية
// المساحة. الحقول القادمة من النموذج قابلةٌ للتعديل بيد مَن يفتح أدوات
// المتصفّح، فصلاحيتُها في الشاشة السابقة لا تُغني عن فحصها هنا.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findClient, redirectUriAllowed, issueAuthCode } from "@/lib/mcp/oauth";
import { workspaceAccess } from "@/lib/workspaceAccess";

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromCookies();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const get = (k: string): string => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };

  const clientId = get("client_id");
  const redirectUri = get("redirect_uri");
  const challenge = get("code_challenge");
  const method = get("code_challenge_method") || "S256";
  const state = get("state");
  const workspaceId = get("workspace_id");

  const client = await findClient(clientId);
  if (!client || !redirectUriAllowed(client.redirectUris, redirectUri)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!challenge || method !== "S256") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // الرفض يعود إلى العميل بخطأ المواصفة، لا بصفحةٍ عمياء - فيعرف أنّ
  // المستخدم رفض، لا أنّ الشبكة انقطعت.
  const target = new URL(redirectUri);
  if (get("decision") !== "approve") {
    target.searchParams.set("error", "access_denied");
    if (state) target.searchParams.set("state", state);
    return NextResponse.redirect(target, { status: 303 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ...workspaceAccess(user.id) },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const code = await issueAuthCode({
    clientId,
    workspaceId: workspace.id,
    userId: user.id,
    redirectUri,
    codeChallenge: challenge,
    codeChallengeMethod: method,
  });

  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  return NextResponse.redirect(target, { status: 303 });
}
