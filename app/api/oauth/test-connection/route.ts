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

interface Step {
  key: string;
  labelAr: string;
  ok: boolean | null; // null = لم يُنفَّذ لأن ما قبله فشل
  detailAr?: string;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const platform = body?.platform;
  if (!["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"].includes(platform)) {
    return NextResponse.json({ error: "منصة غير معروفة." }, { status: 400 });
  }

  const steps: Step[] = [];
  const add = (s: Step) => steps.push(s);

  // 1) الربط موجود؟
  const connection = await prisma.connectedPlatform.findUnique({
    where: { userId_platform: { userId: user.id, platform } },
  });

  if (!connection) {
    add({ key: "linked", labelAr: "الحساب مربوط", ok: false, detailAr: "لم يُربط هذا الحساب بعد. اضغط «ربط» لبدء الموافقة." });
    return NextResponse.json({ steps, verdictAr: "الحساب غير مربوط." });
  }
  add({ key: "linked", labelAr: "الحساب مربوط", ok: true });

  // 2) توكن التجديد موجود؟ (جوجل وحدها تحتاجه للوصول طويل الأمد)
  if (platform === "GOOGLE_ADS") {
    if (!connection.refreshToken) {
      add({ key: "token", labelAr: "صلاحية الوصول سارية", ok: false,
        detailAr: "لا يوجد توكن تجديد. أعد الربط مع الموافقة على كل الصلاحيات المطلوبة." });
      return NextResponse.json({ steps, verdictAr: "صلاحية الوصول ناقصة - أعد الربط." });
    }
    add({ key: "token", labelAr: "صلاحية الوصول سارية", ok: true });
  } else {
    const expired = connection.expiresAt && connection.expiresAt < new Date();
    add({ key: "token", labelAr: "صلاحية الوصول سارية", ok: !expired,
      detailAr: expired ? "انتهت صلاحية التوكن. أعد ربط الحساب." : undefined });
    if (expired) return NextResponse.json({ steps, verdictAr: "انتهت صلاحية الربط - أعد الربط." });
  }

  // 3) متغيّرات البيئة المطلوبة موجودة؟ سبب صامت شائع جداً
  const missingEnv: string[] = [];
  if (platform === "GOOGLE_ADS") {
    for (const k of ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"]) {
      if (!process.env[k]) missingEnv.push(k);
    }
  }
  if (missingEnv.length > 0) {
    add({ key: "config", labelAr: "إعدادات الخادم مكتملة", ok: false,
      detailAr: `متغيّرات مفقودة في الخادم: ${missingEnv.join("، ")}. هذه إعدادات تخصّنا نحن لا حسابك.` });
    return NextResponse.json({ steps, verdictAr: "إعداد ناقص من جهتنا - تواصل مع الدعم." });
  }
  add({ key: "config", labelAr: "إعدادات الخادم مكتملة", ok: true });

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

      add({ key: "accounts", labelAr: "الوصول إلى الحسابات", ok: ids.length > 0,
        detailAr: ids.length > 0
          ? `${ids.length} حساباً متاحاً.`
          : "التوكن سليم لكنه لا يملك صلاحية على أي حساب إعلاني. تأكد أنك ربطت الحساب الذي يملك الحملات." });

      if (ids.length === 0) return NextResponse.json({ steps, verdictAr: "لا توجد حسابات إعلانية متاحة لهذا التوكن." });

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
          firstError = firstError ?? (e?.errors?.[0]?.message ?? e?.message ?? "غير معروف");
        }
      }

      add({ key: "campaigns", labelAr: "قراءة الحملات", ok: campaignCount > 0,
        detailAr: campaignCount > 0
          ? `${campaignCount} حملة متاحة للاختيار.`
          : firstError
          ? `تعذّرت قراءة الحملات: ${firstError}`
          : "الحسابات متاحة لكن لا توجد بها حملات (غير محذوفة)." });

      return NextResponse.json({
        steps,
        verdictAr: campaignCount > 0
          ? `الاتصال سليم — ${campaignCount} حملة جاهزة للاختيار.`
          : "الاتصال سليم لكن لم نجد حملات.",
      });
    }

    if (platform === "META_ADS") {
      const token = decryptToken(connection.accessToken);
      const res = await fetch(`https://graph.facebook.com/v25.0/me/adaccounts?fields=name&access_token=${token}`);
      const data = await res.json();
      const n = (data.data ?? []).length;
      add({ key: "accounts", labelAr: "الوصول إلى الحسابات", ok: res.ok && n > 0,
        detailAr: !res.ok ? data.error?.message ?? "تعذّر الوصول" : n > 0 ? `${n} حساباً متاحاً.` : "لا توجد حسابات إعلانية متاحة." });
      return NextResponse.json({ steps, verdictAr: res.ok && n > 0 ? "الاتصال سليم." : "تعذّر الوصول إلى حسابات ميتا." });
    }

    // تيك توك
    const token = decryptToken(connection.accessToken);
    const res = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/?app_id=${process.env.TIKTOK_APP_ID}&secret=${process.env.TIKTOK_APP_SECRET}&access_token=${token}`
    );
    const data = await res.json();
    const n = (data.data?.list ?? []).length;
    add({ key: "accounts", labelAr: "الوصول إلى الحسابات", ok: data.code === 0 && n > 0,
      detailAr: data.code !== 0 ? data.message ?? "تعذّر الوصول" : `${n} حساباً متاحاً.` });
    return NextResponse.json({ steps, verdictAr: data.code === 0 && n > 0 ? "الاتصال سليم." : "تعذّر الوصول إلى حسابات تيك توك." });
  } catch (err: any) {
    const detail = err?.errors?.[0]?.message ?? err?.message ?? "خطأ غير معروف";
    add({ key: "accounts", labelAr: "الوصول إلى الحسابات", ok: false, detailAr: detail });
    return NextResponse.json({ steps, verdictAr: `فشل الاتصال: ${detail}` });
  }
}
