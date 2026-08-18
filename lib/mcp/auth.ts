// lib/mcp/auth.ts
//
// مَن يقف خلف المفتاح، وهل يحقّ له.
//
// **الفحص عند كلّ نداءٍ لا عند التوليد.** المفتاح لا يحمل صلاحيّته في
// نفسه: يُسأل عنه في كلّ مرّة - أقائمٌ؟ أَلِمساحةٍ ما زالت موجودة؟ أَلِباقةٍ
// ما زالت تُتيح هذا؟ فمشتركٌ توقّف اشتراكه لا يحصل على بياناتٍ حيّة ولو
// كان مفتاحه صالحاً. ولهذا لا معنى لربط مدّة المفتاح بالفوترة.

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getEntitlements } from "@/lib/entitlements";

/** تسعون يوماً بلا استعمال. المفتاح المنسيّ هو خطر التسريب الفعليّ - لا
 *  المفتاح العامل - فالخمول هو ما يُنهيه، لا ساعةٌ تدقّ على العامل أيضاً. */
export const IDLE_REVOKE_DAYS = 90;

const PREFIX = "adl_mcp_";

export function generateToken(): { token: string; hash: string; lastFour: string } {
  const token = PREFIX + randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token), lastFour: token.slice(-4) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type AuthFailure =
  | "missing"
  | "unknown"
  | "revoked"
  | "expired"
  | "idle"
  | "plan"
  | "subscription";

export interface AuthOk {
  ok: true;
  workspaceId: string;
  tokenId: string;
}
export interface AuthNo {
  ok: false;
  reason: AuthFailure;
  /** يُرسَل إلى العميل نصّاً - فيقوله ذكاءُ المشترك له بدل ٤٠١ صامتة */
  message: string;
}

function bearerFrom(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

export async function authenticate(authHeader: string | null): Promise<AuthOk | AuthNo> {
  const token = bearerFrom(authHeader);
  if (!token) {
    return { ok: false, reason: "missing", message: "No AdLoop key was sent. Add it as an Authorization: Bearer header." };
  }

  const hash = hashToken(token);
  const record = await prisma.mcpToken.findUnique({
    where: { tokenHash: hash },
    select: {
      id: true,
      workspaceId: true,
      revokedAt: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
      workspace: { select: { id: true, userId: true } },
    },
  });

  // مقارنةٌ ثابتة الزمن على البصمة: البحث بالفهرس يُسرّب فارقاً زمنياً
  // ضئيلاً، وهذه تُغلقه بلا كلفة تُذكَر.
  if (!record || !timingSafeEqual(Buffer.from(hash), Buffer.from(hashToken(token)))) {
    return { ok: false, reason: "unknown", message: "This AdLoop key is not recognised. It may have been revoked." };
  }
  if (record.revokedAt) {
    return { ok: false, reason: "revoked", message: "This AdLoop key was revoked. Generate a new one in AdLoop under Integrations." };
  }
  if (record.expiresAt && record.expiresAt < new Date()) {
    return { ok: false, reason: "expired", message: "This AdLoop key has expired. Generate a new one in AdLoop under Integrations." };
  }

  const idleSince = record.lastUsedAt ?? record.createdAt;
  const idleDays = (Date.now() - idleSince.getTime()) / 86_400_000;
  if (idleDays > IDLE_REVOKE_DAYS) {
    await prisma.mcpToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    return {
      ok: false,
      reason: "idle",
      message: `This AdLoop key went unused for more than ${IDLE_REVOKE_DAYS} days and was retired. Generate a new one in AdLoop under Integrations.`,
    };
  }

  // الباقة: تُقرأ الآن لا وقت التوليد.
  const ent = await getEntitlements(record.workspace.userId);
  if (!ent.limits.mcp) {
    return {
      ok: false,
      reason: "plan",
      message: "The AdLoop plan on this account does not include the AI connection. It is available from Starter upwards.",
    };
  }

  await prisma.mcpToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return { ok: true, workspaceId: record.workspaceId, tokenId: record.id };
}
