import { getAppUrl } from "@/lib/appUrl";
// app/api/oauth/login-facebook/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLoginOAuthState } from "@/lib/loginOAuthState";
import { createSessionToken } from "@/lib/auth";
import { generateCsrfToken, CSRF_COOKIE_NAME } from "@/lib/csrf";

const META_API_VERSION = "v25.0";

export async function GET(req: NextRequest) {
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
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            facebookLoginId: profile.id,
            avatarUrl: existingByEmail.avatarUrl ?? avatarUrl,
            name: existingByEmail.name ?? profile.name ?? null,
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name ?? null,
            avatarUrl,
            facebookLoginId: profile.id,
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
    console.error("فشل تسجيل الدخول بفيسبوك:", err);
    return NextResponse.redirect(`${loginUrl}?oauth=error`);
  }
}
