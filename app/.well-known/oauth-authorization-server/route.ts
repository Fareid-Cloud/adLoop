// app/.well-known/oauth-authorization-server/route.ts
//
// بيانات خادم التصريح (RFC 8414). نحن خادمُ التصريح لأنفسنا.
//
// **ولا طرفَ ثالث:** إدخالُ خادمٍ خارجيّ يعني أنّ تعطّله تعطّلٌ لنا، وأنّ
// جلسات مشتركينا تمرّ به. والمشروع يملك جلساتٍ وتوكناتٍ موقَّعة أصلاً.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return NextResponse.json(
    {
      issuer: base,
      // شاشةٌ لا مسار API: التفويض يمرّ بموافقةٍ بشرية صريحة، فوجهتُه صفحة
      authorization_endpoint: `${base}/mcp/authorize`,
      token_endpoint: `${base}/api/mcp/oauth/token`,
      registration_endpoint: `${base}/api/mcp/oauth/register`,
      scopes_supported: ["mcp:read"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      // 🔴 `S256` وحدها. OAuth 2.1 يمنع `plain`، وإعلانُها يدعو عميلاً
      // إلى استعمال الأضعف حين يجد الخيار.
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
