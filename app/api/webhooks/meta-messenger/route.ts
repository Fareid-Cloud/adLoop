// app/api/webhooks/meta-messenger/route.ts
//
// وصلة تحقق حقيقية جديدة - نفس مبدأ ويب هوك الواتساب، لكن لماسنجر.
// اتأكدنا رسمياً (توثيق ميتا للمطورين): أول رسالة من إعلان Click-to-
// Messenger بتوصل معاها referral.ad_id مباشرة - نفس دور ctwa_clid
// للواتساب.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";
import { connectionsForPlatform } from "@/lib/platformConnections";

const META_API_VERSION = "v21.0";

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!signatureHeader || !appSecret) return false;

  const receivedHash = signatureHeader.replace("sha256=", "");
  const computedHash = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  if (computedHash.length !== receivedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(receivedHash));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_MESSENGER_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  try {
    for (const entry of body.entry ?? []) {
      const pageId = entry.id;

      const workspace = await prisma.workspace.findUnique({
        where: { facebookPageId: pageId },
        include: { user: { include: { connectedPlatforms: true } } },
      });
      if (!workspace) continue;

      for (const event of entry.messaging ?? []) {
        if (event.message?.is_echo) continue;
        const psid = event.sender?.id;
        if (!psid) continue;

        const adId = event.message?.referral?.ad_id ?? event.referral?.ad_id ?? null;
        const now = new Date(event.timestamp ?? Date.now());

        const existing = await prisma.messengerConversation.findUnique({
          where: { workspaceId_psid: { workspaceId: workspace.id, psid } },
        });

        if (!existing) {
          const campaignId = adId
            ? await resolveCampaignIdFromAd(adId, workspace.user.connectedPlatforms)
            : null;

          await prisma.messengerConversation.create({
            data: {
              workspaceId: workspace.id, psid, adId, campaignId,
              firstMessageAt: now, lastMessageAt: now, messageCount: 1,
            },
          });
        } else {
          await prisma.messengerConversation.update({
            where: { id: existing.id },
            data: { lastMessageAt: now, messageCount: { increment: 1 } },
          });
        }
      }
    }
  } catch (err) {
    console.error("خطأ في معالجة ويب هوك ماسنجر:", err);
  }

  return NextResponse.json({ ok: true });
}

async function resolveCampaignIdFromAd(adId: string, connectedPlatforms: any[]): Promise<string | null> {
  // الويب هوك يحمل معرّف الإعلان ولا يحمل الحساب، فلا سبيل إلى معرفة المنحة
  // مقدَّماً. ومع منحةٍ واحدة لا أثر لذلك؛ فإذا تعدّدت، صار أخذُ أولاها
  // يُعيد `null` لكلّ إعلان عميلٍ ثانٍ - فتُسجَّل محادثته **بلا حملة**،
  // أي تحوّلٌ متحقَّقٌ لا يُنسَب إلى ما جاء به. وهو صمتٌ تامّ: لا خطأ
  // يُرفع ولا رقم ينقص ظاهرياً.
  //
  // فتُجرَّب المنح حتى تُجيب إحداها. وهذه قراءةٌ لا كتابة، فالمحاولة
  // الفاشلة بلا أثر أصلاً.
  for (const connection of connectionsForPlatform(connectedPlatforms, "META_ADS")) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${adId}?fields=campaign_id&access_token=${decryptToken(connection.accessToken)}`
      );
      const data = await res.json();
      if (data.campaign_id) return data.campaign_id;
    } catch {
      continue;
    }
  }
  return null;
}
