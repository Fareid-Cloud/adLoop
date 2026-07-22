import { getAppUrl } from "@/lib/appUrl";
// app/api/oauth/google-ads/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState } from "@/lib/oauthState";
import { encryptToken } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const settingsUrl = `${getAppUrl()}/dashboard/settings`;

  // المستخدم رفض الموافقة من عند جوجل - رجّعه بشكل طبيعي، مش خطأ
  if (error) {
    return NextResponse.redirect(`${settingsUrl}?connection=cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?connection=error`);
  }

  const verified = verifyOAuthState(state);
  if (!verified) {
    // state مش صالح - ممكن يكون منتهي أو محاولة اختراق. أيضاً نرفض بهدوء
    return NextResponse.redirect(`${settingsUrl}?connection=error`);
  }

  const redirectUri = `${getAppUrl()}/api/oauth/google-ads/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("فشل تبادل كود Google Ads OAuth:", await tokenRes.text());
    return NextResponse.redirect(`${settingsUrl}?connection=error`);
  }

  const tokens = await tokenRes.json();
  // { access_token, refresh_token, expires_in, ... }

  if (!tokens.refresh_token) {
    // لو المستخدم وافق قبل كده والـ prompt=consent مشتغلش لأي سبب، جوجل
    // ممكن ميرجعش refresh_token تاني - من غيره منقدرش نجدد الوصول لاحقاً
    console.error("جوجل مرجعش refresh_token - محتاجين المستخدم يعيد الموافقة");
    return NextResponse.redirect(`${settingsUrl}?connection=missing_refresh_token`);
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.connectedPlatform.upsert({
    where: { userId_platform: { userId: verified.userId, platform: "GOOGLE_ADS" } },
    create: {
      userId: verified.userId,
      platform: "GOOGLE_ADS",
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expiresAt,
    },
    update: {
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined, // جوجل مش دائماً بترجع refresh_token جديد - منمسحش القديم لو مفيش جديد
      expiresAt,
    },
  });

  return NextResponse.redirect(`${settingsUrl}?connection=success&platform=google_ads`);
}
