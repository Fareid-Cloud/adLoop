// app/api/mcp/route.ts
//
// خادم MCP البعيد. يتكلّم JSON-RPC 2.0 فوق HTTP، وهو ما يتوقّعه كلّ عميلٍ
// يدّعي دعم MCP - فلا شيء هنا خاصٌّ بنموذجٍ بعينه.
//
// المدعوم: `initialize` · `tools/list` · `tools/call` · `ping`.
// وإشعارات العميل (`notifications/*`) تُقبَل بـ202 بلا جسم، كما تقتضي
// JSON-RPC: الإشعار لا جواب له.

import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/mcp/auth";
import { MCP_TOOLS, TOOL_BY_NAME } from "@/lib/mcp/tools";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2025-06-18";

/** أكواد JSON-RPC القياسية - لا نخترع أرقاماً */
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

function rpcError(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });
}

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

/**
 * 🔴 **رفضُ المصادقة يقول سببه.**
 *
 * ٤٠١ فارغة تصل إلى المشترك عبر تطبيقٍ آخر - Claude Desktop أو Cursor -
 * فيرى «فشل الاتصال» ولا يعرف أنّ اشتراكه انتهى أو أنّ مفتاحه أُلغي.
 * والنصّ هنا هو ما سيقرؤه ذكاؤه له، فيكون التشخيص عنده لا عندنا.
 *
 * و`WWW-Authenticate` بصيغة RFC 9728 تدلّ العميل على بيانات المورد
 * المحميّ - وهي ما تلتقطه العملاء التي تعمل بـOAuth حين نبنيها.
 */
function unauthorized(message: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message } },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer realm="AdLoop", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      },
    }
  );
}

export async function POST(req: NextRequest) {
  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return rpcError(null, PARSE_ERROR, "Request body is not valid JSON.");
  }

  const { id, method, params } = body ?? {};
  if (!method || typeof method !== "string") {
    return rpcError(id, INVALID_REQUEST, "Missing method.");
  }

  // إشعارٌ لا جواب له
  if (method.startsWith("notifications/")) {
    return new NextResponse(null, { status: 202 });
  }

  const auth = await authenticate(req.headers.get("authorization"));
  if (!auth.ok) return unauthorized(auth.message);

  // سقفٌ على المفتاح لا على المستخدم: كلّ نداءٍ استعلاماتُ قاعدة بيانات،
  // رخيصةٌ لا مجّانية. والمفتاح هو وحدة الاستعمال هنا.
  const limited = await checkRateLimit(auth.tokenId, "mcp", 120, 1);
  if (!limited.allowed) {
    return rpcError(id, INTERNAL_ERROR, "Too many requests. Slow down and try again in a minute.", 429);
  }

  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "AdLoop", version: "1.0.0" },
          // يُعرَض للمستخدم في بعض العملاء - فيقول ما يصحّ أن يُسأل عنه
          instructions:
            "AdLoop exposes verified advertising and store numbers for one workspace, read-only. " +
            "Prefer verified conversions over reported ones when answering. " +
            "For questions about how to do something in AdLoop, call search_help rather than answering from general knowledge.",
        });

      case "ping":
        return rpcResult(id, {});

      case "tools/list":
        return rpcResult(id, {
          tools: MCP_TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        });

      case "tools/call": {
        const name = typeof params?.name === "string" ? params.name : "";
        const tool = TOOL_BY_NAME.get(name);
        if (!tool) return rpcError(id, METHOD_NOT_FOUND, `No tool named "${name}".`);

        const args = (params?.arguments ?? {}) as Record<string, unknown>;
        try {
          const data = await tool.run(auth.workspaceId, args);
          return rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          });
        } catch (err) {
          // 🔴 **خطأُ أداةٍ ليس خطأ بروتوكول.** المواصفة تريده داخل النتيجة
          // بعلَم `isError`، فيراه النموذج ويصحّح نداءه - أمّا خطأ JSON-RPC
          // فيقطع الجلسة عند بعض العملاء.
          console.error(`MCP tool ${name} failed:`, err);
          return rpcResult(id, {
            isError: true,
            content: [
              {
                type: "text",
                text: `Tool "${name}" failed: ${err instanceof Error ? err.message : "unknown error"}`,
              },
            ],
          });
        }
      }

      default:
        return rpcError(id, METHOD_NOT_FOUND, `Method "${method}" is not supported.`);
    }
  } catch (err) {
    console.error("MCP request failed:", err);
    return rpcError(id, INTERNAL_ERROR, "Internal error.");
  }
}

/** بعض العملاء يستطلع الخادم بـGET قبل الاتّصال. لا تدفّق أحداثٍ هنا،
 *  فيُردّ بـ405 صريحة بدل أن يُفهَم الصمت عطلاً. */
export async function GET() {
  return NextResponse.json(
    { error: "This MCP endpoint accepts POST with JSON-RPC only." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
