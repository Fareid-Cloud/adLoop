// app/api/webhooks/messaging/route.ts
//
// ويب هوك واحد لواتساب بيزنس وماسنجر - **ميتا بتبعت الاتنين بنفس الشكل**
// (`entry[].changes[]` أو `entry[].messaging[]`)، فمساران منفصلان كانا
// هيكرّروا التحقّق من التوقيع ومنطقَ الدفعات، وأوّل واحد يُنسى فيه إصلاح
// يبقى هو الثغرة.
//
// 🔴 **الدفعاتُ مقروءةٌ كاملة.** ميتا بتجمّع: `entry` مصفوفة، وجوّاها
// مصفوفة، وجوّاها رسائل. قراءةُ الأولى وحدها معناها إنّ اتنين بعتوا في
// نفس الثانية → التاني بيتقفل عليه بـ٢٠٠ ومايتعالجش. (نفس العطب اتصلح في
// متتبّع واتساب - ومكتوب هنا كي لا يُعاد.)

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";
import { after } from "next/server";
import { ingestInboundMessage, notifyTeamOfInbound } from "@/lib/inbox";

export const dynamic = "force-dynamic";

// ── التحقّق وقت الربط عند ميتا ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token = sp.get("hub.verify_token");
  if (sp.get("hub.mode") !== "subscribe" || !token) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // الرمزُ بيتقارن بالمخزَّن لكلّ قناة: رمزٌ من متغيّر بيئة كان معناه
  // إنّ ربطَ رقمٍ تاني يتطلّب نشرة.
  const match = await prisma.channelConnection.findFirst({
    where: { verifyToken: token, active: true },
    select: { id: true },
  });
  if (!match) return new NextResponse("Forbidden", { status: 403 });

  return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // ── التوقيع أوّلاً، وقبل أيّ تحليل ───────────────────────────────────
  //
  // بيتفحص ضدّ **كلّ** قناة نشطة: الطلب مابيقولش هو لأنهي ربط قبل ما
  // نحلّله، وتحليلُه قبل التحقّق هو بالظبط اللي التوقيع موجود عشان يمنعه.
  const signature = req.headers.get("x-hub-signature-256");
  const connections = await prisma.channelConnection.findMany({
    where: { active: true, appSecret: { not: null } },
    select: { id: true, channel: true, appSecret: true },
  });

  const matched = connections.find((c) => verifySignature(raw, signature, decryptToken(c.appSecret!)));
  if (!matched) {
    console.warn("[messaging] توقيع غير صالح - الطلب مرفوض");
    return new NextResponse("Forbidden", { status: 403 });
  }

  let body: MetaPayload;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  let processed = 0;
  for (const entry of body.entry ?? []) {
    // واتساب: changes[].value.messages[]
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const profileName = value?.contacts?.[0]?.profile?.name ?? null;
      for (const m of value?.messages ?? []) {
        try {
          const saved = await ingestInboundMessage({
            channel: "WHATSAPP",
            externalThreadId: m.from,
            externalMessageId: m.id,
            body: textOf(m),
            senderName: profileName,
            phone: m.from,
            receivedAt: m.timestamp ? new Date(Number(m.timestamp) * 1000) : undefined,
          });
          if (saved) {
            processed++;
            notifyLater(saved.threadId);
          }
        } catch (err) {
          // رسالةٌ واحدة بايظة مابتاخدش باقي الدفعة معاها.
          console.error("[messaging] فشلت رسالة واتساب:", m?.id, err);
        }
      }
    }

    // ماسنجر: messaging[]
    for (const ev of entry.messaging ?? []) {
      if (!ev.message?.text && !ev.message?.mid) continue;
      // الصدى: ميتا بتبعت لنا ردَّنا نفسه. تسجيلُه بيكرّره في المحادثة.
      if (ev.message?.is_echo) continue;
      try {
        const saved = await ingestInboundMessage({
          channel: "MESSENGER",
          externalThreadId: ev.sender?.id ?? "",
          externalMessageId: ev.message?.mid ?? null,
          body: ev.message?.text ?? "",
          receivedAt: ev.timestamp ? new Date(ev.timestamp) : undefined,
        });
        if (saved) {
          processed++;
          notifyLater(saved.threadId);
        }
      } catch (err) {
        console.error("[messaging] فشلت رسالة ماسنجر:", ev.message?.mid, err);
      }
    }
  }

  // دليلُ إنّ الربط شغّال فعلاً - الواجهة بتقرا منه بدل ما تقول "متحفوظ".
  await prisma.channelConnection
    .update({ where: { id: matched.id }, data: { lastEventAt: new Date() } })
    .catch(() => {});

  return NextResponse.json({ ok: true, processed });
}

/**
 * الإشعار بعد ما الردّ يمشي.
 *
 * ميتا بتعيد إرسال الويب هوك لو ماردّيناش بسرعة، فحطُّ نداءِ الدفع في
 * طريق الردّ بيخلّي بطءَ خدمةِ الدفع سبباً في **تكرار الرسالة**. و`after()`
 * بيضمن إنّه بيتنفّذ فعلاً بدل `void` اللي بتموت لمّا الرد يمشي.
 */
function notifyLater(threadId: string) {
  try {
    after(() => notifyTeamOfInbound(threadId).catch(() => {}));
  } catch {
    void notifyTeamOfInbound(threadId).catch(() => {});
  }
}

function verifySignature(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const received = header.replace("sha256=", "");
  const computed = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  // الطولُ يُفحَص أوّلاً: `timingSafeEqual` بترمي على أطوالٍ مختلفة.
  if (computed.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(received));
}

/** نصُّ الرسالة مهما كان نوعها - الصورةُ بلا تعليقٍ بتدي سطراً واضحاً. */
function textOf(m: WaMessage): string {
  if (m.text?.body) return m.text.body;
  if (m.image?.caption) return m.image.caption;
  if (m.type) return `[${m.type}]`;
  return "";
}

// أنواعُ الحمولة - جزئية عن قصد: بنقرا اللي نحتاجه، وميتا بتضيف حقولاً
// باستمرار فوصفُها كاملةً دَينٌ يتقادم مع كلّ إصدار.
interface WaMessage {
  id?: string;
  from: string;
  type?: string;
  timestamp?: string;
  text?: { body?: string };
  image?: { caption?: string };
}

interface MetaPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ profile?: { name?: string } }>;
        messages?: WaMessage[];
      };
    }>;
    messaging?: Array<{
      sender?: { id?: string };
      timestamp?: number;
      message?: { mid?: string; text?: string; is_echo?: boolean };
    }>;
  }>;
}
