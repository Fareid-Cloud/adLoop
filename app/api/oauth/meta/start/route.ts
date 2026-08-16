import { getAppUrl } from "@/lib/appUrl";
// app/api/oauth/meta/start/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createOAuthState } from "@/lib/oauthState";

const META_API_VERSION = "v25.0"; // ثابت بالتحديد - ميتا بتوقف نسخ قديمة بشكل دوري

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
  const redirectUri = `${getAppUrl()}/api/oauth/meta/callback`;

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri,
    // ads_management + ads_read كافيين للقراءة والتعديل الأساسي.
    // business_management هيتضاف لاحقاً لو احتجنا ندير أكتر من حساب
    // تحت نفس الـ Business Manager
    scope: "ads_management,ads_read",
    response_type: "code",
    state,
  });

  const authUrl = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
