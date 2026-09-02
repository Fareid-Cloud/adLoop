// lib/channels/outbound.ts
//
// **الردّ يخرج من حيث دخل السؤال.**
//
// ردٌّ على رسالة واتساب بيتكتب في قاعدتنا وبيوصل صاحبه على واتساب - لا
// في صندوقٍ مالوش خبر بيه. والفصلُ هنا (`lib/inbox.ts` بيكتب،
// والملفّ ده بيوصّل) مقصود: الكتابة لازم تنجح حتى لو التوصيل فشل، وإلا
// ردُّ الدعم بيضيع من التاريخ لأنّ شبكةَ ميتا كانت واقعة لحظتها.
//
// ⚠️ **حدٌّ من ميتا لا منّا:** واتساب بيقفل نافذةَ الردّ المجّاني بعد ٢٤
// ساعة من آخر رسالةٍ للعميل. بعدها لازم قالبٌ معتمَد، وإرسالُ نصٍّ حرّ
// بيترفض. الحالة دي بتترجع كـ`window_closed` عشان الواجهة تقولها لصاحبها
// بدل ما الردّ يفشل بلا سبب مفهوم.

import { decryptToken } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

export type DeliveryResult =
  | { ok: true; externalId: string | null }
  | { ok: false; reason: "not_configured" | "window_closed" | "failed"; detail?: string };

/** نافذةُ الردّ المجّاني عند واتساب - قاعدةُ ميتا لا اختيارُنا. */
const FREE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * إعدادُ قناةٍ لمساحة العمل. **مفكوكُ التشفير هنا وهنا فقط** - نفس قاعدة
 * توكنات المنصّات الإعلانية: لا يُخزَّن سرٌّ بنصٍّ صريح ولا يُقرأ خام.
 */
async function channelConfig(channel: "WHATSAPP" | "MESSENGER") {
  const row = await prisma.channelConnection.findFirst({
    where: { channel, active: true },
    select: { accessToken: true, externalId: true },
  });
  if (!row) return null;
  return { token: decryptToken(row.accessToken), externalId: row.externalId };
}

export async function deliverReply(params: {
  channel: string;
  /** رقمُ الواتساب أو PSID - معرّفُ المحادثة عند المنصّة */
  externalThreadId: string | null;
  /** آخر رسالةٍ واردة من العميل - أساسُ حساب نافذة الأربع وعشرين ساعة */
  lastInboundAt: Date | null;
  body: string;
}): Promise<DeliveryResult> {
  // شات الموقع مالوش توصيلٌ خارجيّ: العميل بيقرا من نفس قاعدة البيانات،
  // فالكتابةُ هي التوصيل.
  if (params.channel === "WEB") return { ok: true, externalId: null };
  if (!params.externalThreadId) return { ok: false, reason: "failed", detail: "no external id" };

  if (params.channel === "WHATSAPP") return deliverWhatsApp(params.externalThreadId, params.body, params.lastInboundAt);
  if (params.channel === "MESSENGER") return deliverMessenger(params.externalThreadId, params.body);
  return { ok: false, reason: "failed", detail: `unknown channel ${params.channel}` };
}

async function deliverWhatsApp(
  to: string,
  body: string,
  lastInboundAt: Date | null
): Promise<DeliveryResult> {
  const cfg = await channelConfig("WHATSAPP");
  if (!cfg) return { ok: false, reason: "not_configured" };

  // الفحصُ عندنا قبل النداء: ميتا بترفض بخطأٍ عامّ، والتفرقة بين "النافذة
  // قفلت" و"الإعداد غلط" هي الفرق بين إرشادٍ مفيد وحيرة.
  if (!lastInboundAt || Date.now() - lastInboundAt.getTime() > FREE_WINDOW_MS) {
    return { ok: false, reason: "window_closed" };
  }

  const res = await fetch(`https://graph.facebook.com/v23.0/${cfg.externalId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body },
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!res?.ok) {
    const detail = res ? await res.text().catch(() => "") : "network";
    return { ok: false, reason: "failed", detail: detail.slice(0, 300) };
  }
  const json = (await res.json().catch(() => null)) as { messages?: Array<{ id?: string }> } | null;
  return { ok: true, externalId: json?.messages?.[0]?.id ?? null };
}

async function deliverMessenger(psid: string, body: string): Promise<DeliveryResult> {
  const cfg = await channelConfig("MESSENGER");
  if (!cfg) return { ok: false, reason: "not_configured" };

  const res = await fetch(`https://graph.facebook.com/v23.0/me/messages?access_token=${encodeURIComponent(cfg.token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      // `RESPONSE` بيقول لميتا إنّ ده ردٌّ على رسالةٍ من العميل - وهو
      // التصنيف الوحيد المسموح خارج القوالب، وبيخضع لنفس نافذة الـ٢٤ ساعة.
      messaging_type: "RESPONSE",
      message: { text: body },
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!res?.ok) {
    const detail = res ? await res.text().catch(() => "") : "network";
    // ميتا بترجّع ٥٥١/١٠ لمّا النافذة تقفل - نميّزها عشان الرسالة تبقى مفيدة.
    const closed = /outside.*24|message.*window|\b551\b/i.test(detail);
    return { ok: false, reason: closed ? "window_closed" : "failed", detail: detail.slice(0, 300) };
  }
  const json = (await res.json().catch(() => null)) as { message_id?: string } | null;
  return { ok: true, externalId: json?.message_id ?? null };
}
