import { getAppUrl } from "@/lib/appUrl";
// app/api/oauth/login-google/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { verifyLoginOAuthState } from "@/lib/loginOAuthState";
import { createSessionToken } from "@/lib/auth";
import { generateCsrfToken, CSRF_COOKIE_NAME } from "@/lib/csrf";

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

  const redirectUri = `${getAppUrl()}/api/oauth/login-google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_LOGIN_CLIENT_ID!,
        client_secret: process.env.GOOGLE_LOGIN_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return NextResponse.redirect(`${loginUrl}?oauth=error`);
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profile.sub || !profile.email) {
      return NextResponse.redirect(`${loginUrl}?oauth=error`);
    }

    // 🔴 **الربط بالبريد بلا التحقّق من ملكيته عند المزوّد.**
    //
    // حين لا يطابق `googleLoginId` أحداً، كان الحساب القائم يُربَط بهذا
    // المزوّد لمجرّد تطابق البريد. وجوجل تعيد `email_verified` لسببٍ
    // وجيه: البريد في ملفٍّ عند مزوّدٍ ليس دليلاً على ملكيته. فمن يضع
    // بريد الضحية على حسابٍ غير متحقَّق ثمّ يدخل، يُربَط بحسابها ويملكه.
    //
    // ولا يُفتَح الباب إلّا لبريدٍ أثبت المزوّدُ نفسه ملكيّته.
    const emailVerifiedAtProvider = profile.email_verified === true;

    let user = await prisma.user.findUnique({ where: { googleLoginId: profile.sub } });

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });
      if (existingByEmail) {
        if (!emailVerifiedAtProvider) {
          return NextResponse.redirect(`${loginUrl}?oauth=unverified`);
        }
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleLoginId: profile.sub,
            avatarUrl: existingByEmail.avatarUrl ?? profile.picture ?? null,
            name: existingByEmail.name ?? profile.name ?? null,
          },
        });
      } else if (!emailVerifiedAtProvider) {
        // حسابٌ جديدٌ ببريدٍ غير متحقَّق يحجز عنواناً ليس لصاحبه.
        return NextResponse.redirect(`${loginUrl}?oauth=unverified`);
      } else {
        user = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name ?? null,
            avatarUrl: profile.picture ?? null,
            googleLoginId: profile.sub,
            emailVerified: true,
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
    console.error("فشل تسجيل الدخول بجوجل:", err);
    return NextResponse.redirect(`${loginUrl}?oauth=error`);
  }
}
