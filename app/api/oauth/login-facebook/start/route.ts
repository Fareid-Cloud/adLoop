// app/api/oauth/login-facebook/start/route.ts
//
// "تسجيل الدخول بفيسبوك" - منفصل تماماً عن ربط حساب Meta Ads (نطاق
// صلاحيات مختلف: email/public_profile بس، مش ads_management).

import { NextRequest, NextResponse } from "next/server";
import { createLoginOAuthState } from "@/lib/loginOAuthState";

const META_API_VERSION = "v25.0"; // ثابت بالتحديد - نفس النسخة المستخدمة في باقي المشروع

export async function GET(req: NextRequest) {
  const state = createLoginOAuthState();
  const redirectUri = `${process.env.APP_URL}/api/oauth/login-facebook/callback`;

  const params = new URLSearchParams({
    client_id: process.env.META_LOGIN_APP_ID!,
    redirect_uri: redirectUri,
    scope: "email,public_profile",
    response_type: "code",
    state,
  });

  const authUrl = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
