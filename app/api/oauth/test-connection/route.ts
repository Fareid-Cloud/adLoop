// app/api/oauth/test-connection/route.ts
//
// فحص اتصال المنصة خطوة بخطوة، وإرجاع **أين توقّف بالضبط**.
//
// السبب: "لا توجد حملات" رسالة عديمة الفائدة - قد تعني عدم الربط، أو
// توكناً منتهياً، أو نقص صلاحية، أو حساباً بلا حملات فعلاً. كل حالة لها
// حلٌّ مختلف تماماً، فبدون تحديد الخطوة الفاشلة يبقى المستخدم عالقاً.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { decryptToken } from "@/lib/encryption";

/**
 * خطوة فحص. **مفاتيح لا نصوص:** المحرّك يعمل في الخادم ولا يعرف لغة
 * الواجهة، فإرجاع جملة مكتملة يقفل اللغة عند لحظة الحساب.
 */
interface Step {
  key: string;
  labelKey: string;
  ok: boolean | null; // null = لم يُنفَّذ لأن ما قبله فشل
  detailKey?: string;
  detailVars?: Record<string, string | number>;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const platform = body?.platform;
  if (!["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"].includes(platform)) {
    return NextResponse.json({ errorKey: "unknownPlatform" }, { status: 400 });
  }

  const steps: Step[] = [];
  const add = (s: Step) => steps.push(s);

  // 1) الربط موجود؟
  //
  // `connectionId` اختياريّ: تمرّره الواجهة حين تختبر **منحةً بعينها** من
  // بين منحٍ عدّة لمنصّةٍ واحدة. وبدونه تُختبر الأقدم - وهو السلوك نفسه
  // الذي كان حين لم تكن هناك إلّا واحدة.
  const connection = await prisma.connectedPlatform.findFirst({
    where: {
      userId: user.id,
      platform,
      ...(typeof body?.connectionId === "string" ? { id: body.connectionId } : {}),
    },
    orderBy: { connectedAt: "asc" },
  });

  if (!connection) {
    add({ key: "linked", labelKey: "sLinked", ok: false, detailKey: "dNotLinked" });
    return NextResponse.json({ steps, verdictKey: "vNotLinked" });
  }
  add({ key: "linked", labelKey: "sLinked", ok: true });

  // 2) توكن التجديد موجود؟ (جوجل وحدها تحتاجه للوصول طويل الأمد)
  if (platform === "GOOGLE_ADS") {
    if (!connection.refreshToken) {
      add({ key: "token", labelKey: "sToken", ok: false, detailKey: "dNoRefresh" });
      return NextResponse.json({ steps, verdictKey: "vTokenMissing" });
    }
    add({ key: "token", labelKey: "sToken", ok: true });
  } else {
    const expired = connection.expiresAt && connection.expiresAt < new Date();
    add({ key: "token", labelKey: "sToken", ok: !expired, detailKey: expired ? "dExpired" : undefined });
    if (expired) return NextResponse.json({ steps, verdictKey: "vTokenExpired" });
  }

  // 3) متغيّرات البيئة المطلوبة موجودة؟ سبب صامت شائع جداً
  const missingEnv: string[] = [];
  if (platform === "GOOGLE_ADS") {
    for (const k of ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"]) {
      if (!process.env[k]) missingEnv.push(k);
    }
  }
  if (missingEnv.length > 0) {
    add({ key: "config", labelKey: "sConfig", ok: false, detailKey: "dMissingEnv", detailVars: { vars: missingEnv.join(", ") } });
    return NextResponse.json({ steps, verdictKey: "vServerConfig" });
  }
  add({ key: "config", labelKey: "sConfig", ok: true });

  // 4) هل نصل إلى الحسابات فعلياً؟
  try {
    if (platform === "GOOGLE_ADS") {
      const { GoogleAdsApi } = await import("google-ads-api");
      const client = new GoogleAdsApi({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      });
      const refreshToken = decryptToken(connection.refreshToken!);
      const accessible = await client.listAccessibleCustomers(refreshToken);
      const ids = (accessible.resource_names ?? []).map((r: string) => r.split("/")[1]);

      add({ key: "accounts", labelKey: "sAccounts", ok: ids.length > 0,
        detailKey: ids.length > 0 ? "dAccountsFound" : "dNoAccountAccess",
        detailVars: ids.length > 0 ? { n: ids.length } : undefined });

      if (ids.length === 0) return NextResponse.json({ steps, verdictKey: "vNoAccounts" });

      // 5) هل يوجد حملات فعلاً؟
      let campaignCount = 0;
      let firstError: string | null = null;
      for (const accountId of ids.slice(0, 5)) {
        try {
          const customer = client.Customer({ customer_id: accountId, refresh_token: refreshToken });
          const rows = await customer.query(
            `SELECT campaign.id FROM campaign WHERE campaign.status != 'REMOVED' LIMIT 50`
          );
          campaignCount += rows.length;
        } catch (e: any) {
          firstError = firstError ?? (e?.errors?.[0]?.message ?? e?.message ?? null);
        }
      }

      add({ key: "campaigns", labelKey: "sCampaigns", ok: campaignCount > 0,
        detailKey: campaignCount > 0 ? "dCampaignsFound" : firstError ? "dCampaignsFailed" : "dNoCampaigns",
        detailVars: campaignCount > 0 ? { n: campaignCount } : firstError ? { error: firstError } : undefined });

      return NextResponse.json({
        steps,
        verdictKey: campaignCount > 0 ? "vHealthy" : "vHealthyNoCampaigns",
        verdictVars: campaignCount > 0 ? { n: campaignCount } : undefined,
      });
    }

    if (platform === "META_ADS") {
      const token = decryptToken(connection.accessToken);
      const res = await fetch(`https://graph.facebook.com/v25.0/me/adaccounts?fields=name&access_token=${token}`);
      const data = await res.json();
      const n = (data.data ?? []).length;
      add({ key: "accounts", labelKey: "sAccounts", ok: res.ok && n > 0,
        detailKey: !res.ok ? "dCampaignsFailed" : n > 0 ? "dAccountsFound" : "dNoAccounts",
        detailVars: !res.ok ? { error: data.error?.message ?? "" } : n > 0 ? { n } : undefined });
      return NextResponse.json({ steps, verdictKey: res.ok && n > 0 ? "vOk" : "vMetaFailed" });
    }

    // تيك توك
    const token = decryptToken(connection.accessToken);
    const res = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/?app_id=${process.env.TIKTOK_APP_ID}&secret=${process.env.TIKTOK_APP_SECRET}&access_token=${token}`
    );
    const data = await res.json();
    const n = (data.data?.list ?? []).length;
    add({ key: "accounts", labelKey: "sAccounts", ok: data.code === 0 && n > 0,
      detailKey: data.code !== 0 ? "dCampaignsFailed" : "dAccountsFound",
      detailVars: data.code !== 0 ? { error: data.message ?? "" } : { n } });
    return NextResponse.json({ steps, verdictKey: data.code === 0 && n > 0 ? "vOk" : "vTiktokFailed" });
  } catch (err: any) {
    const detail = err?.errors?.[0]?.message ?? err?.message ?? "";
    add({ key: "accounts", labelKey: "sAccounts", ok: false, detailKey: "dCampaignsFailed", detailVars: { error: detail } });
    return NextResponse.json({ steps, verdictKey: "vFailed", verdictVars: { error: detail } });
  }
}
