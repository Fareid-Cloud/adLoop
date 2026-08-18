// app/.well-known/oauth-protected-resource/route.ts
//
// بيانات المورد المحميّ (RFC 9728) - إلزاميّة في مواصفة تفويض MCP.
//
// 🔴 **كانت ترويسة `WWW-Authenticate` في مسار MCP تشير إلى هذا العنوان
// وهو غير موجود.** العميل الذي يتبع الإشارة كما تأمره المواصفة يجد ٤٠٤،
// فيقف عند أوّل خطوةٍ في الاكتشاف - ولا يشكو أحد، لأنّ من يربط بالمفتاح
// يدوياً لا يمرّ من هنا أصلاً.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return NextResponse.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      scopes_supported: ["mcp:read"],
      bearer_methods_supported: ["header"],
      resource_documentation: `${base}/dashboard/mcp`,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
