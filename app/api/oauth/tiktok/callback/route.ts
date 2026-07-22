// app/api/oauth/tiktok/callback/route.ts
//
// ملاحظة مهمة اتأكدنا منها بالبحث: تيك توك بتستخدم اسم باراميتر "auth_code"
// (مش "code" زي جوجل/ميتا)، والتوكن **مبينتهيش افتراضياً** إلا لو اتلغى
// يدوياً - عكس جوجل (refresh token) وميتا (60 يوم). فمفيش expiresAt هنا،
// وده بيخلي فحص "قرب انتهاء الاتصال" الموجود عندنا يتجاهل تيك توك تلقائياً
// (بيفحص بس الاتصالات اللي عندها expiresAt فعلي) - سلوك صحيح، مش سهو.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState } from "@/lib/oauthState";
import { encryptToken } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const authCode = searchParams.get("auth_code");
  const state = searchParams.get("state");

  const settingsUrl = `${process.env.APP_URL}/dashboard/settings`;

  if (!authCode || !state) {
    return NextResponse.redirect(`${settingsUrl}?connection=cancelled`);
  }

  const verified = verifyOAuthState(state);
  if (!verified) {
    return NextResponse.redirect(`${settingsUrl}?connection=error`);
  }

  const tokenRes = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: process.env.TIKTOK_APP_ID,
      secret: process.env.TIKTOK_APP_SECRET,
      auth_code: authCode,
    }),
  });

  if (!tokenRes.ok) {
    console.error("فشل تبادل auth_code تيك توك:", await tokenRes.text());
    return NextResponse.redirect(`${settingsUrl}?connection=error`);
  }

  const tokenData = await tokenRes.json();
  // { code: 0, message: "OK", data: { access_token, scope, advertiser_ids } }

  if (tokenData.code !== 0 || !tokenData.data?.access_token) {
    console.error("رد تيك توك غير متوقع وقت تبادل التوكن:", tokenData);
    return NextResponse.redirect(`${settingsUrl}?connection=error`);
  }

  await prisma.connectedPlatform.upsert({
    where: { userId_platform: { userId: verified.userId, platform: "TIKTOK_ADS" } },
    create: {
      userId: verified.userId,
      platform: "TIKTOK_ADS",
      accessToken: encryptToken(tokenData.data.access_token),
      refreshToken: null, // تيك توك مفيهاش refresh token منفصل زي جوجل - نفس access_token بيفضل شغال
      expiresAt: null, // مش بينتهي افتراضياً - راجع الملاحظة أعلى الملف
    },
    update: {
      accessToken: encryptToken(tokenData.data.access_token),
      expiresAt: null,
    },
  });

  return NextResponse.redirect(`${settingsUrl}?connection=success&platform=tiktok_ads`);
}
