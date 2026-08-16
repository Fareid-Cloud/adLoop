import { getAppUrl } from "@/lib/appUrl";
// app/api/oauth/google-ads/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState } from "@/lib/oauthState";
import { encryptToken } from "@/lib/encryption";
import { checkPlatformLimit, checkGrantLimit } from "@/lib/entitlements";
import { resolveGrantTarget } from "@/lib/oauthGrant";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // العودة إلى صفحة ربط المنصات لا إلى الإعدادات: الربط لا يمرّ بالإعدادات
  // في أي خطوة، وإرجاع المستخدم إليها بعد الموافقة يضيّعه في صفحة لا تخصّه.
  const returnUrl = `${getAppUrl()}/dashboard/integrations`;

  // المستخدم رفض الموافقة من عند جوجل - رجّعه بشكل طبيعي، مش خطأ
  if (error) {
    return NextResponse.redirect(`${returnUrl}?connection=cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${returnUrl}?connection=error`);
  }

  const verified = verifyOAuthState(state);
  if (!verified) {
    // state مش صالح - ممكن يكون منتهي أو محاولة اختراق. أيضاً نرفض بهدوء
    return NextResponse.redirect(`${returnUrl}?connection=error`);
  }

  const redirectUri = `${getAppUrl()}/api/oauth/google-ads/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("فشل تبادل كود Google Ads OAuth:", await tokenRes.text());
    return NextResponse.redirect(`${returnUrl}?connection=error`);
  }

  const tokens = await tokenRes.json();
  // { access_token, refresh_token, expires_in, ... }

  if (!tokens.refresh_token) {
    // لو المستخدم وافق قبل كده والـ prompt=consent مشتغلش لأي سبب، جوجل
    // ممكن ميرجعش refresh_token تاني - من غيره منقدرش نجدد الوصول لاحقاً
    console.error("جوجل لم تُرجع refresh_token - يلزم أن يعيد المستخدم الموافقة");
    return NextResponse.redirect(`${returnUrl}?connection=missing_refresh_token`);
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  // 🔴 حدّ المنصّات كان معروضاً في جدول الباقات وغير مطبَّق هنا: الباقة
  // المجّانية تَعِد بمنصّة واحدة، وكان المستخدم يربط الثلاث. الفحص قبل
  // الحفظ لا بعده - بعده يكون الربط قد تمّ ولا معنى للمنع.
  //
  // إعادة ربط منصّة موجودة تمرّ: `checkPlatformLimit` يَعُدّ المنصّات
  // الفريدة، فتجديد ربطٍ منتهٍ لا يُحسَب منصّةً جديدة.
  // **أيّ صفٍّ نكتب فيه؟** جوابٌ لم يكن يُسأل حين كان لكلّ منصّة صفٌّ
  // واحد: الموافقة الجديدة تكتب فوقه وكفى. وبعد أن صار للمشترك أكثر من
  // تسجيل دخول، صارت الكتابة العمياء **تمحو منحة عميلٍ بتوكن عميلٍ آخر**.
  const target = await resolveGrantTarget({
    userId: verified.userId,
    platform: "GOOGLE_ADS",
    connectionId: verified.connectionId,
    addNew: verified.addNew,
  });

  // 🔴 حدّ المنصّات كان معروضاً في جدول الباقات وغير مطبَّق هنا: الباقة
  // المجّانية تَعِد بمنصّة واحدة، وكان المستخدم يربط الثلاث. الفحص قبل
  // الحفظ لا بعده - بعده يكون الربط قد تمّ ولا معنى للمنع.
  //
  // ولا يُسأل إلّا عند إنشاء منحةٍ جديدة: تجديد منحةٍ قائمة ليس منصّةً
  // جديدة، ومنعُه يقفل على المشترك ربطاً يملكه بالفعل.
  if (target.mode === "create") {
    const hasPlatform = await prisma.connectedPlatform.findFirst({
      where: { userId: verified.userId, platform: "GOOGLE_ADS" },
      select: { id: true },
    });
    if (!hasPlatform) {
      const platCheck = await checkPlatformLimit(verified.userId);
      if (!platCheck.allowed) {
        return NextResponse.redirect(`${returnUrl}?connection=plan_limit&limit=${platCheck.limit}`);
      }
    } else {
      // منصّةٌ مربوطة بالفعل وهذه منحةٌ إضافية لها - يحكمها سقف المنح.
      const grantCheck = await checkGrantLimit(verified.userId, "GOOGLE_ADS");
      if (!grantCheck.allowed) {
        return NextResponse.redirect(
          `${returnUrl}?connection=account_limit&limit=${grantCheck.limit}&platform=GOOGLE_ADS`
        );
      }
    }
  }

  if (target.mode === "update") {
    await prisma.connectedPlatform.update({
      where: { id: target.id },
      data: {
        accessToken: encryptToken(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined, // جوجل مش دائماً بترجع refresh_token جديد - منمسحش القديم لو مفيش جديد
        expiresAt,
      },
    });
  } else {
    await prisma.connectedPlatform.create({
      data: {
        userId: verified.userId,
        platform: "GOOGLE_ADS",
        accessToken: encryptToken(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        expiresAt,
      },
    });
  }

  return NextResponse.redirect(`${getAppUrl()}/dashboard?connection=success&platform=google_ads`);
}
