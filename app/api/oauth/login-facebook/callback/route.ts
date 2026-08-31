import { getAppUrl } from "@/lib/appUrl";
// app/api/oauth/login-facebook/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { verifyLoginOAuthState } from "@/lib/loginOAuthState";
import { createSessionToken } from "@/lib/auth";
import { generateCsrfToken, CSRF_COOKIE_NAME } from "@/lib/csrf";

const META_API_VERSION = "v25.0";

export async function GET(req: NextRequest) {
  // 🔴 **المسار الأضعف كان هو غير المحروس.** الدخول بالبريد وكلمة المرور
  // عليه حدُّ معدّل، وردُّ المزوّد الخارجيّ عليه صفر - وهو نداءٌ يفتح جلسةً
  // كاملة ويُنشئ حسابات. الحدُّ هنا بنفس أداة الدخول العاديّ.
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "oauth-callback", 20, 15);
  if (!allowed) {
    return NextResponse.redirect(`${getAppUrl()}/login?oauth=error`);
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const loginUrl = `${getAppUrl()}/login`;

  if (error) {
    return NextResponse.redirect(`${loginUrl}?oauth=cancelled`);
  }
  if (!code || !state || !verifyLoginOAuthState(state)) {
    return NextResponse.redirect(`${loginUrl}?oauth=error`);
  }

  const redirectUri = `${getAppUrl()}/api/oauth/login-facebook/callback`;

  try {
    const tokenParams = new URLSearchParams({
      client_id: process.env.META_LOGIN_APP_ID!,
      client_secret: process.env.META_LOGIN_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
    });
    const tokenRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?${tokenParams.toString()}`
    );
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.redirect(`${loginUrl}?oauth=error`);
    }

    const profileRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me?fields=id,name,email,picture&access_token=${tokenData.access_token}`
    );
    const profile = await profileRes.json();
    if (!profile.id) {
      return NextResponse.redirect(`${loginUrl}?oauth=error`);
    }

    if (!profile.email) {
      return NextResponse.redirect(`${loginUrl}?oauth=no_email`);
    }

    const avatarUrl = profile.picture?.data?.url ?? null;

    let user = await prisma.user.findUnique({ where: { facebookLoginId: profile.id } });

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });
      if (existingByEmail) {
        // 🔴 **حسابٌ قائم كان يُربَط بفيسبوك لمجرّد تطابق البريد.**
        //
        // وفيسبوك - بخلاف جوجل - **لا يُعيد أيّ إشارةٍ إلى التحقّق من
        // البريد** في `/me?fields=email`؛ فلا سبيل إلى معرفة أنّ صاحب هذا
        // الحساب يملك ذلك العنوان أصلاً. فمن يضع بريد الضحية على حساب
        // فيسبوك ثمّ يدخل به، كان يُربَط بحسابها هنا ويملكه كاملاً.
        //
        // ولا يُغلَق الباب على صاحبه: يدخل بكلمة مروره ثمّ يربط فيسبوك من
        // حسابه - وهي الموافقة الصريحة التي كان الربط التلقائيّ يتخطّاها.
        return NextResponse.redirect(`${loginUrl}?oauth=link_signin_first`);
      } else {
        user = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name ?? null,
            avatarUrl,
            facebookLoginId: profile.id,
            // فيسبوك لا يشهد بملكية البريد، فلا نُسجّلها تحقّقاً منّا.
            emailVerified: false,
          },
        });
      }
    }

    if (user.isSuspended) {
      return NextResponse.redirect(`${loginUrl}?oauth=suspended`);
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = createSessionToken(user.id);
    const response = NextResponse.redirect(`${getAppUrl()}/dashboard`);

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    response.cookies.set(CSRF_COOKIE_NAME, generateCsrfToken(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("فشل تسجيل الدخول بفيسبوك:", err);
    return NextResponse.redirect(`${loginUrl}?oauth=error`);
  }
}
