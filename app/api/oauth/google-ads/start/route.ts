import { getAppUrl } from "@/lib/appUrl";
// app/api/oauth/google-ads/start/route.ts
//
// يضغط المستخدم "اربط Google Ads" في صفحة ربط المنصات فيصل إلى هنا،
// ومن هنا يُحوَّل إلى صفحة الموافقة الرسمية لدى جوجل.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createOAuthState } from "@/lib/oauthState";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // النيّة تُقرأ هنا وتُوقَّع داخل `state`: أهذه **منحة إضافية** لحساب عميل
  // آخر، أم **تجديدٌ** لمنحةٍ بعينها انتهت صلاحيتها؟ ردّ المنصّة واحدٌ في
  // الحالتين، والفرق في من ضغط الزرّ - فلا سبيل لمعرفته إلّا بحمله معه.
  //
  // وحملُها موقَّعةً لا في `?query` الـ callback يمنع تحويل «جدِّد منحتي»
  // إلى «أنشئ منحة» بالتلاعب في الرابط، ويمنع الإشارة إلى منحة غير مالكها.
  const { searchParams } = new URL(req.url);
  const state = createOAuthState(user.id, {
    connectionId: searchParams.get("reconnect") ?? undefined,
    addNew: searchParams.get("add") === "1",
  });
  const redirectUri = `${getAppUrl()}/api/oauth/google-ads/callback`;

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
