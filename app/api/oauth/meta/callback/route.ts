// app/api/oauth/meta/callback/route.ts
//
// ميتا مختلفة عن جوجل في نقطة مهمة: مفيش refresh_token دائم. اللي بيحصل:
// 1) الكود بيتبادل بـ short-lived token (ساعة صلاحية تقريباً)
// 2) الـ short-lived token ده بيتبادل بـ long-lived token (~60 يوم)
// بعد الـ 60 يوم، لازم المستخدم يعيد الموافقة تاني (مفيش تجديد صامت
// زي جوجل) - ده قيد حقيقي من ميتا نفسها، مش قصور في الكود.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState } from "@/lib/oauthState";
import { encryptToken } from "@/lib/encryption";

const META_API_VERSION = "v25.0";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const settingsUrl = `${process.env.APP_URL}/dashboard/settings`;

  if (error) {
    return NextResponse.redirect(`${settingsUrl}?connection=cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?connection=error`);
  }

  const verified = verifyOAuthState(state);
  if (!verified) {
    return NextResponse.redirect(`${settingsUrl}?connection=error`);
  }

  const redirectUri = `${process.env.APP_URL}/api/oauth/meta/callback`;

  // الخطوة 1: تبادل الكود بتوكن قصير الأجل
  const shortTokenParams = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  });

  const shortTokenRes = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?${shortTokenParams.toString()}`
  );

  if (!shortTokenRes.ok) {
    console.error("فشل تبادل كود Meta OAuth:", await shortTokenRes.text());
    return NextResponse.redirect(`${settingsUrl}?connection=error`);
  }

  const { access_token: shortLivedToken } = await shortTokenRes.json();

  // الخطوة 2: تمديد التوكن لـ long-lived (~60 يوم) - خطوة إضافية خاصة بميتا
  // مفيش عندها في جوجل، لازم متتنساش عشان الاتصال يفضل شغال أكتر من ساعة
  const longTokenParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  });

  const longTokenRes = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?${longTokenParams.toString()}`
  );

  if (!longTokenRes.ok) {
    console.error("فشل تمديد توكن Meta:", await longTokenRes.text());
    return NextResponse.redirect(`${settingsUrl}?connection=error`);
  }

  const longTokenData = await longTokenRes.json();
  // { access_token, token_type, expires_in } - expires_in بالثواني (~60 يوم)

  const expiresAt = new Date(Date.now() + (longTokenData.expires_in ?? 5184000) * 1000);

  await prisma.connectedPlatform.upsert({
    where: { userId_platform: { userId: verified.userId, platform: "META_ADS" } },
    create: {
      userId: verified.userId,
      platform: "META_ADS",
      accessToken: encryptToken(longTokenData.access_token),
      refreshToken: null, // ميتا معندهاش refresh token - التوكن نفسه بينتهي ويحتاج إعادة موافقة
      expiresAt,
    },
    update: {
      accessToken: encryptToken(longTokenData.access_token),
      expiresAt,
    },
  });

  return NextResponse.redirect(`${settingsUrl}?connection=success&platform=meta_ads`);
}
