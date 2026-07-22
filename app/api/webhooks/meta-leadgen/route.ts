// app/api/webhooks/meta-leadgen/route.ts
//
// "جودة العملاء من فورم ميتا الداخلي (Instant Forms) مقارنة بفورم موقعي؟"
// - ميتا بتبعت إشعار خفيف بس (leadgen_id) لما حد يملأ الفورم، وبعدين
// لازم نجيب البيانات الكاملة بطلب منفصل. نفس نمط webhook واتساب بالظبط:
// توقيع HMAC (X-Hub-Signature-256، بادئة "sha256=")، وحماية من التكرار.
//
// ملاحظة نشر: لازم GET handler منفصل لتحقق الاشتراك الأولي بتاع ميتا
// (hub.challenge) - غير مبني هنا، هيتضاف وقت التفعيل الفعلي في
// activation-checklist.md مع باقي خطوات صلاحيات ماسنجر.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyHmacSignature, markEventAsProcessed } from "@/lib/webhookSecurity";
import { decryptToken } from "@/lib/encryption";

const META_API_VERSION = "v25.0";

// ميتا بتبعت GET مرة واحدة وقت تفعيل الاشتراك في الويب هوك، للتأكد إننا
// فعلاً السيرفر اللي بيتحكم في الرابط ده - لازم نرجّع "hub.challenge"
// بالظبط لو "hub.verify_token" مطابق للي ضبطناه احنا
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const signatureHeader = req.headers.get("x-hub-signature-256");
  const secret = process.env.META_APP_SECRET;

  if (!secret) {
    console.error("META_APP_SECRET غير مضبوط - رافضين كل الطلبات لحد ما يتظبط");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  // ميتا بتحط بادئة "sha256=" قبل التوقيع نفسه، لازم نشيلها الأول
  const signature = signatureHeader?.replace("sha256=", "") ?? null;
  if (!verifyHmacSignature(rawBody, signature, secret)) {
    console.warn("توقيع ويب هوك ميتا (leadgen) غير صحيح - الطلب مرفوض");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;

      const { leadgen_id, form_id, ad_id } = change.value ?? {};
      if (!leadgen_id) continue;

      const isNew = await markEventAsProcessed("meta-leadgen", String(leadgen_id));
      if (!isNew) continue; // اتعالج قبل كده، مش هنكرر

      // بنلاقي الـ Workspace المرتبط بالإعلان ده عن طريق CampaignLink
      const link = ad_id
        ? await prisma.campaignLink.findFirst({
            where: { platform: "META_ADS", externalCampaignId: String(ad_id) },
          })
        : null;

      if (!link) {
        console.warn(`لقينا ليد ميتا (${leadgen_id}) بس مش قادرين نربطه بأي Workspace معروف`);
        continue;
      }

      const workspace = await prisma.workspace.findUnique({ where: { id: link.workspaceId } });
      if (!workspace) continue;

      // محتاجين accessToken بصلاحية Page (مش حساب الإعلانات العادي) -
      // التفاصيل الكاملة موثّقة في activation-checklist.md قسم 4ب
      const connection = await prisma.connectedPlatform.findFirst({
        where: { userId: workspace.userId, platform: "META_ADS" },
      });
      if (!connection) continue;

      try {
        const leadRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${leadgen_id}?access_token=${decryptToken(connection.accessToken)}`
        );
        const leadData = await leadRes.json();

        if (leadRes.ok) {
          await prisma.leadFormSubmission.create({
            data: {
              workspaceId: link.workspaceId,
              leadgenId: String(leadgen_id),
              formId: String(form_id ?? ""),
              adId: ad_id ? String(ad_id) : null,
              campaignId: link.externalCampaignId,
              submittedAt: new Date(),
              fieldData: JSON.stringify(leadData.field_data ?? []),
            },
          });
        }
      } catch (err) {
        console.error(`فشل جلب تفاصيل ليد ميتا ${leadgen_id}:`, err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
