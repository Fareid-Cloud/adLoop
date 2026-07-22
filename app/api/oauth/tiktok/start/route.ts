import { getAppUrl } from "@/lib/appUrl";
// app/api/oauth/tiktok/start/route.ts
//
// المستخدم بيدوس "اربط حساب تيك توك" في الإعدادات، وده بيودّيه هنا.
//
// ملاحظة تقنية مهمة (اتأكدنا منها بالبحث): تيك توك عندها نظامين OAuth
// مختلفين تماماً - "Login Kit" العام (لتسجيل دخول مستخدمين عاديين)
// و"Business API" (للإعلانات، اللي احنا محتاجينه). ده الأخير - عنوان
// المصادقة عنده business-api.tiktok.com، مش open.tiktokapis.com.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createOAuthState } from "@/lib/oauthState";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const state = createOAuthState(user.id);
  const redirectUri = `${getAppUrl()}/api/oauth/tiktok/callback`;

  const params = new URLSearchParams({
    app_id: process.env.TIKTOK_APP_ID!,
    state,
    redirect_uri: redirectUri,
  });

  const authUrl = `https://business-api.tiktok.com/portal/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
