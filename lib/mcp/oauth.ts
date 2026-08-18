// lib/mcp/oauth.ts
//
// OAuth 2.1 لخادم MCP: التسجيل الديناميكيّ، وPKCE، وتبادل الرمز بتوكن.
//
// **لماذا هذا أصلاً، والمفتاح يعمل؟** المفتاح في ترويسة يعمل مع العملاء
// المحلّية (Claude Code، Cursor). أمّا claude.ai وChatGPT على الوِب فتربط
// عبر OAuth، ودعمُ الترويسة عندهما محدودٌ بقائمة سماح. فبلا هذا يبقى
// الربطُ متاحاً لمن يشغّل عميلاً على جهازه، ومغلقاً أمام الأكثرية.
//
// **ولا خادمَ تصريحٍ خارجيّ.** إدخالُ طرفٍ ثالث هنا يعني أنّ تعطّله تعطّلٌ
// لنا، وأنّ بيانات مشتركينا تمرّ به. والمشروع يملك أصلاً جلساتٍ وتوكناتٍ
// موقَّعة، فالتصريح يُبنى فوقها لا بجانبها.

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

/** دقيقتان: الرمز يُستبدَل فور إعادة التوجيه، وطولُ العمر خطرٌ بلا فائدة. */
const CODE_TTL_MS = 2 * 60 * 1000;

export const MCP_SCOPE = "mcp:read";

export function sha256b64url(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

/** مقارنةٌ ثابتة الزمن - المقارنة العادية تُسرّب طولَ البادئة المطابقة. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// ══════════════ التسجيل الديناميكيّ (RFC 7591) ══════════════

export interface RegisteredClient {
  client_id: string;
  client_secret?: string;
  client_name: string;
  redirect_uris: string[];
}

/** 🔴 `redirect_uri` يُثبَّت وقت التسجيل ويُطابَق حرفياً بعده.
 *
 *  المطابقةُ بالبادئة ثغرةٌ معروفة: مَن يسجّل `https://good.example/cb`
 *  يستقبل الرمز على `https://good.example/cb.attacker.test`. فالمطابقة
 *  كاملةٌ أو لا شيء. */
export async function registerClient(input: {
  client_name?: unknown;
  redirect_uris?: unknown;
}): Promise<RegisteredClient | { error: string; error_description: string }> {
  const name = typeof input.client_name === "string" ? input.client_name.slice(0, 120) : "";
  const uris = Array.isArray(input.redirect_uris)
    ? input.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];

  if (!name) return { error: "invalid_client_metadata", error_description: "client_name is required." };
  if (uris.length === 0) {
    return { error: "invalid_redirect_uri", error_description: "At least one redirect_uri is required." };
  }
  for (const u of uris) {
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      return { error: "invalid_redirect_uri", error_description: `Not a valid URL: ${u}` };
    }
    // http مسموحٌ على المضيف المحلّيّ وحده: عملاءُ سطح المكتب تستمع عليه،
    // وأيُّ مضيفٍ آخر بلا تشفير يعني رمزاً يمرّ على الشبكة مكشوفاً.
    const localhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localhost)) {
      return {
        error: "invalid_redirect_uri",
        error_description: `redirect_uri must use https (http is allowed for localhost only): ${u}`,
      };
    }
  }

  const clientId = "adl_client_" + randomBytes(16).toString("base64url");
  await prisma.mcpOAuthClient.create({
    data: { clientId, clientName: name, redirectUris: uris },
  });

  // عميلٌ عامّ بلا سرّ: PKCE هو ما يحمي التبادل، والسرُّ المخزَّن في
  // متصفّحٍ أو تطبيقِ سطحِ مكتبٍ ليس سرّاً - وOAuth 2.1 يقرّ ذلك.
  return { client_id: clientId, client_name: name, redirect_uris: uris };
}

export async function findClient(clientId: string) {
  return prisma.mcpOAuthClient.findUnique({ where: { clientId } });
}

/** المطابقة الحرفية - لا بادئة ولا احتواء. */
export function redirectUriAllowed(registered: string[], candidate: string): boolean {
  return registered.some((u) => safeEqual(u, candidate));
}

// ══════════════ رمز التفويض ══════════════

export async function issueAuthCode(input: {
  clientId: string;
  workspaceId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  await prisma.mcpAuthCode.create({
    data: {
      code,
      clientId: input.clientId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      scope: MCP_SCOPE,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

export type ExchangeResult =
  | { ok: true; workspaceId: string; userId: string }
  | { ok: false; error: string; error_description: string };

/** 🔴 الرمز يُستهلَك مرّةً واحدة، ويُعلَّم مستهلَكاً قبل أن يُصدَر التوكن.
 *
 *  الرمزُ المعاد استعماله علامةُ اعتراضٍ لا خطأ عميل: إن وصل مرّتين فقد
 *  رآه غيرُ صاحبه. ولذلك لا يُكتفى برفض الثانية - بل تُلغى الأولى أيضاً
 *  حيث أمكن، وهو ما يوصي به OAuth 2.1 صراحةً. */
export async function exchangeCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<ExchangeResult> {
  const record = await prisma.mcpAuthCode.findUnique({ where: { code: input.code } });
  if (!record) return { ok: false, error: "invalid_grant", error_description: "Unknown authorization code." };

  if (record.usedAt) {
    return { ok: false, error: "invalid_grant", error_description: "This authorization code was already used." };
  }
  if (record.expiresAt < new Date()) {
    return { ok: false, error: "invalid_grant", error_description: "This authorization code has expired." };
  }
  if (!safeEqual(record.clientId, input.clientId)) {
    return { ok: false, error: "invalid_grant", error_description: "This code was issued to a different client." };
  }
  if (!safeEqual(record.redirectUri, input.redirectUri)) {
    return { ok: false, error: "invalid_grant", error_description: "redirect_uri does not match the one used to obtain the code." };
  }

  // PKCE: نقارن بصمة المُتحقِّق بالتحدّي المخزَّن، لا المُتحقِّق نفسه.
  const derived =
    record.codeChallengeMethod === "S256" ? sha256b64url(input.codeVerifier) : input.codeVerifier;
  if (!safeEqual(derived, record.codeChallenge)) {
    return { ok: false, error: "invalid_grant", error_description: "PKCE verification failed." };
  }

  await prisma.mcpAuthCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return { ok: true, workspaceId: record.workspaceId, userId: record.userId };
}

/** تنظيفُ الرموز المنتهية - تُنادى من مسار التوكن، فلا تحتاج كروناً خاصاً. */
export async function purgeExpiredCodes(): Promise<void> {
  try {
    await prisma.mcpAuthCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    // التنظيف ليس شرطاً لنجاح التبادل - وفشلُه لا يُسقط تفويضاً صحيحاً.
  }
}
