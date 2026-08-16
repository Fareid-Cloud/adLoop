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
  const redirectUri = `${getAppUrl()}/api/oauth/tiktok/callback`;

  const params = new URLSearchParams({
    app_id: process.env.TIKTOK_APP_ID!,
    state,
    redirect_uri: redirectUri,
  });

  const authUrl = `https://business-api.tiktok.com/portal/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
