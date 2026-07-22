// app/api/oauth/login-google/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLoginOAuthState } from "@/lib/loginOAuthState";
import { createSessionToken } from "@/lib/auth";
import { generateCsrfToken, CSRF_COOKIE_NAME } from "@/lib/csrf";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const loginUrl = `${process.env.APP_URL}/login`;

  if (error) {
    return NextResponse.redirect(`${loginUrl}?oauth=cancelled`);
  }
  if (!code || !state || !verifyLoginOAuthState(state)) {
    return NextResponse.redirect(`${loginUrl}?oauth=error`);
  }

  const redirectUri = `${process.env.APP_URL}/api/oauth/login-google/callback`;

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

    let user = await prisma.user.findUnique({ where: { googleLoginId: profile.sub } });

    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });
      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleLoginId: profile.sub,
            avatarUrl: existingByEmail.avatarUrl ?? profile.picture ?? null,
            name: existingByEmail.name ?? profile.name ?? null,
          },
        });
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
    const response = NextResponse.redirect(`${process.env.APP_URL}/dashboard`);

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
