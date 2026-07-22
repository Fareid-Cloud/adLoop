// app/api/oauth/google-ads/start/route.ts
//
// المستخدم بيدوس "اربط حساب Google Ads" في الإعدادات، وده بيودّيه هنا،
// وده بيحوّله لصفحة موافقة جوجل الرسمية.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createOAuthState } from "@/lib/oauthState";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const state = createOAuthState(user.id);
  const redirectUri = `${process.env.APP_URL}/api/oauth/google-ads/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    // النطاق الرسمي الوحيد لـ Google Ads API - موثّق من جوجل نفسها
    scope: "https://www.googleapis.com/auth/adwords",
    // offline عشان ناخد refresh_token (محتاجينه نجدد الوصول من غير ما
    // المستخدم يسجل دخول تاني كل شوية) - وprompt=consent بيضمن جوجل
    // ترجع refresh_token فعلاً (مش بترجعه تاني لو المستخدم وافق قبل كده
    // من غير الإجبار ده)
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
