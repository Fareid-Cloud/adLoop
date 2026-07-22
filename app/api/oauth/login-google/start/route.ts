import { getAppUrl } from "@/lib/appUrl";
// app/api/oauth/login-google/start/route.ts
//
// "تسجيل الدخول بجوجل" - منفصل تماماً عن ربط حساب Google Ads (نطاق
// صلاحيات مختلف: openid/email/profile بس، مش adwords).

import { NextRequest, NextResponse } from "next/server";
import { createLoginOAuthState } from "@/lib/loginOAuthState";

export async function GET(req: NextRequest) {
  const state = createLoginOAuthState();
  const redirectUri = `${getAppUrl()}/api/oauth/login-google/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_LOGIN_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
