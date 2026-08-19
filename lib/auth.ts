// lib/auth.ts
//
// نسخة مبسطة للـ MVP - بتستخدم JWT في كوكيز الجلسة.
// في مرحلة لاحقة يُفضّل استخدام NextAuth.js لتغطية Google/Meta OAuth
// بشكل موحد مع نفس نظام الجلسات.

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

// المنطق الأساسي - بياخد التوكن كنص مباشرة، بيتستخدم من الاتنين تحت
async function getUserFromToken(token: string | undefined) {
  if (!token) return null;

  try {
    // إصلاح C من الاختبار العدائي: تثبيت الخوارزمية صراحة (HS256) -
    // دفاع إضافي حتى لو مش قابل للاستغلال المباشر في إعدادنا الحالي
    // (مفتاح متماثل بس)، أفضل الممارسات تتطلبه صراحة مش بافتراض المكتبة
    const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as {
      userId: string;
      mfaPending?: boolean;
      iat?: number;
    };

    // فحص أمان حرج: توكن "في انتظار MFA" (mfaPending) ميقدرش يُستخدم
    // كجلسة كاملة أبداً - لو منعملناش الفحص ده، أي حد يقدر يتجاوز خطوة
    // MFA بالكامل عن طريق استخدام التوكن المؤقت كأنه جلسة عادية
    if (payload.mfaPending) return null;

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return null;

    // إصلاح B من الاختبار العدائي: لو المستخدم عمل تسجيل خروج (أو أي
    // إبطال جلسات) بعد ما التوكن ده اتصدر، نرفضه حتى لو لسه صالح تقنياً -
    // بيقفل نافذة "توكن مسروق يفضل شغال بعد تسجيل الخروج"
    if (user.sessionInvalidatedAt && payload.iat) {
      const tokenIssuedAt = payload.iat * 1000; // JWT iat بالثواني، Date بالميلي ثانية
      if (user.sessionInvalidatedAt.getTime() > tokenIssuedAt) return null;
    }

    // 🔴 **التعليق كان بيتفحص عند تسجيل الدخول وبس.** يعني حساب معلَّق
    // ومعاه جلسة مفتوحة بيفضل شغّال بكامل صلاحياته لحد ما التوكن ينتهي -
    // تلاتين يوم. وهو بالظبط عكس الغرض من التعليق: بيتعمل عشان الحساب
    // يقف **دلوقتي**، مش الشهر الجاي.
    //
    // مسار التعليق في اللوحة بيضبط `sessionInvalidatedAt` كمان، لكن
    // الفحص هنا هو الضمان: تعليق اتعمل بأي طريق تانية (تعديل مباشر في
    // قاعدة البيانات مثلاً) بيسري فوراً من غير ما يعتمد على إنّ اللي
    // عمله فاكر يضبط حقل تاني معاه.
    if (user.isSuspended) return null;

    return user;
  } catch {
    return null;
  }
}

// للاستخدام جوه Route Handlers (app/api/**/route.ts)
export async function getSessionUser(req: NextRequest) {
  return getUserFromToken(req.cookies.get("session")?.value);
}

// للاستخدام جوه Server Components (app/**/page.tsx) - مفيش NextRequest
// متاح هناك، الطريقة الرسمية في Next.js هي cookies() من next/headers
export async function getSessionUserFromCookies() {
  const cookieStore = await cookies();
  return getUserFromToken(cookieStore.get("session")?.value);
}

export function createSessionToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "30d" });
}

// توكن مؤقت جداً (5 دقايق) - بيتاح فقط بعد نجاح كلمة السر، وقبل التأكد
// من كود MFA. مقصود انتهاؤه السريع عشان يقلل نافذة أي سوء استخدام لو اتسرب
export function createMfaPendingToken(userId: string): string {
  return jwt.sign({ userId, mfaPending: true }, process.env.JWT_SECRET!, { expiresIn: "5m" });
}

export function verifyMfaPendingToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as {
      userId: string;
      mfaPending?: boolean;
    };
    return payload.mfaPending ? payload.userId : null;
  } catch {
    return null;
  }
}

// 🔴 **ثغرة أمنية حقيقية اتصلحت هنا:** كوكي "impersonating_by" كانت بتتخزن
// كمعرّف خام (admin.id نص صريح)، ومسار stop-impersonating كان بياخدها
// وينده createSessionToken(adminId) عليها من غير أي توقيع أو فحص - يعني
// أي حد يعرف معرّف مستخدم (حتى معرّفه هو) يقدر يبعت
// Cookie: impersonating_by=<أي معرّف> ويطلع بجلسة صالحة كاملة لصاحبه،
// بلا تسجيل دخول خالص. httpOnly مش حماية هنا لأنها بتمنع JS من قراءة
// الكوكي، مش بتمنع إرسال ترويسة Cookie يدوياً.
//
// الحل: توكن موقّع خاص بالانتحال، منفصل عن createSessionToken العادي -
// لو استُخدم توكن الجلسة الكامل هنا، سرقة كوكي "impersonating_by" كانت
// هتديك جلسة أدمن صالحة 30 يوم، مش مجرد إمكانية الرجوع لحسابك. عمر أقصر
// (4 ساعات، نفس مدة صلاحية جلسة الانتحال نفسها) وclaim مخصّص يمنع إعادة
// استخدامه كتوكن جلسة عادي.
export function createImpersonatorToken(adminId: string): string {
  return jwt.sign({ adminId, impersonating: true }, process.env.JWT_SECRET!, { expiresIn: "4h" });
}

export function verifyImpersonatorToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as {
      adminId: string;
      impersonating?: boolean;
    };
    return payload.impersonating ? payload.adminId : null;
  } catch {
    return null;
  }
}
