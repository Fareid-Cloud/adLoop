// app/api/mcp/oauth/token/route.ts
//
// تبادلُ رمز التفويض بتوكن وصول.
//
// التوكن الصادر هنا **هو نفسه توكن MCP** المخزَّن مُجزَّأً في `McpToken`،
// لا نوعٌ ثانٍ بجانبه. ولو أصدرتُ نوعاً آخر لصار للمصادقة مساران يفترقان:
// أحدهما يُلغى عند الخمول ويُفحَص ضدّ الباقة، والآخر ينساه أحدُنا يوماً.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCode, purgeExpiredCodes, MCP_SCOPE } from "@/lib/mcp/oauth";
import { generateToken } from "@/lib/mcp/auth";

/** ساعةٌ واحدة على توكن الوصول - التجديد يمرّ بالتفويض من جديد. */
const ACCESS_TTL_SEC = 60 * 60;

function bad(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status });
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return bad("invalid_request", "Body must be application/x-www-form-urlencoded.");

  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };

  if (get("grant_type") !== "authorization_code") {
    return bad("unsupported_grant_type", "Only authorization_code is supported.");
  }

  const code = get("code");
  const clientId = get("client_id");
  const redirectUri = get("redirect_uri");
  const codeVerifier = get("code_verifier");
  if (!code || !clientId || !redirectUri || !codeVerifier) {
    return bad("invalid_request", "code, client_id, redirect_uri and code_verifier are all required.");
  }

  const result = await exchangeCode({ code, clientId, redirectUri, codeVerifier });
  if (!result.ok) return bad(result.error, result.error_description);

  const { token, hash, lastFour } = generateToken();
  const expiresAt = new Date(Date.now() + ACCESS_TTL_SEC * 1000);
  await prisma.mcpToken.create({
    data: {
      workspaceId: result.workspaceId,
      tokenHash: hash,
      lastFour,
      label: "OAuth connection",
      expiresAt,
    },
  });

  void purgeExpiredCodes();

  return NextResponse.json(
    { access_token: token, token_type: "Bearer", expires_in: ACCESS_TTL_SEC, scope: MCP_SCOPE },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } }
  );
}
