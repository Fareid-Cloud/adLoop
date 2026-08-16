import { getAppUrl } from "@/lib/appUrl";
// app/api/oauth/meta/callback/route.ts
//
// ميتا مختلفة عن جوجل في نقطة مهمة: مفيش refresh_token دائم. اللي بيحصل:
// 1) الكود بيتبادل بـ short-lived token (ساعة صلاحية تقريباً)
// 2) الـ short-lived token ده بيتبادل بـ long-lived token (~60 يوم)
// بعد الـ 60 يوم، لازم المستخدم يعيد الموافقة تاني (مفيش تجديد صامت
// زي جوجل) - ده قيد حقيقي من ميتا نفسها، مش قصور في الكود.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState } from "@/lib/oauthState";
import { encryptToken } from "@/lib/encryption";
import { checkPlatformLimit, checkGrantLimit } from "@/lib/entitlements";
import { resolveGrantTarget } from "@/lib/oauthGrant";

const META_API_VERSION = "v25.0";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // العودة إلى صفحة ربط المنصات لا إلى الإعدادات: الربط لا يمرّ بالإعدادات
  // في أي خطوة، وإرجاع المستخدم إليها بعد الموافقة يضيّعه في صفحة لا تخصّه.
  const returnUrl = `${getAppUrl()}/dashboard/integrations`;

  if (error) {
    return NextResponse.redirect(`${returnUrl}?connection=cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${returnUrl}?connection=error`);
  }

  const verified = verifyOAuthState(state);
  if (!verified) {
    return NextResponse.redirect(`${returnUrl}?connection=error`);
  }

  const redirectUri = `${getAppUrl()}/api/oauth/meta/callback`;

  // الخطوة 1: تبادل الكود بتوكن قصير الأجل
  const shortTokenParams = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  });

  const shortTokenRes = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?${shortTokenParams.toString()}`
  );

  if (!shortTokenRes.ok) {
    console.error("فشل تبادل كود Meta OAuth:", await shortTokenRes.text());
    return NextResponse.redirect(`${returnUrl}?connection=error`);
  }

  const { access_token: shortLivedToken } = await shortTokenRes.json();

  // الخطوة 2: تمديد التوكن لـ long-lived (~60 يوم) - خطوة إضافية خاصة بميتا
  // مفيش عندها في جوجل، لازم متتنساش عشان الاتصال يفضل شغال أكتر من ساعة
  const longTokenParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  });

  const longTokenRes = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?${longTokenParams.toString()}`
  );

  if (!longTokenRes.ok) {
    console.error("فشل تمديد توكن Meta:", await longTokenRes.text());
    return NextResponse.redirect(`${returnUrl}?connection=error`);
  }

  const longTokenData = await longTokenRes.json();
  // { access_token, token_type, expires_in } - expires_in بالثواني (~60 يوم)

  const expiresAt = new Date(Date.now() + (longTokenData.expires_in ?? 5184000) * 1000);
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
    platform: "META_ADS",
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
      where: { userId: verified.userId, platform: "META_ADS" },
      select: { id: true },
    });
    if (!hasPlatform) {
      const platCheck = await checkPlatformLimit(verified.userId);
      if (!platCheck.allowed) {
        return NextResponse.redirect(`${returnUrl}?connection=plan_limit&limit=${platCheck.limit}`);
      }
    } else {
      // منصّةٌ مربوطة بالفعل وهذه منحةٌ إضافية لها - يحكمها سقف المنح.
      const grantCheck = await checkGrantLimit(verified.userId, "META_ADS");
      if (!grantCheck.allowed) {
        return NextResponse.redirect(
          `${returnUrl}?connection=account_limit&limit=${grantCheck.limit}&platform=META_ADS`
        );
      }
    }
  }

  if (target.mode === "update") {
    await prisma.connectedPlatform.update({
      where: { id: target.id },
      data: {
        accessToken: encryptToken(longTokenData.access_token),
        expiresAt,
      },
    });
  } else {
    await prisma.connectedPlatform.create({
      data: {
        userId: verified.userId,
        platform: "META_ADS",
        accessToken: encryptToken(longTokenData.access_token),
        refreshToken: null, // ميتا معندهاش refresh token - التوكن نفسه بينتهي ويحتاج إعادة موافقة
        expiresAt,
      },
    });
  }

  return NextResponse.redirect(`${getAppUrl()}/dashboard?connection=success&platform=meta`);
}
