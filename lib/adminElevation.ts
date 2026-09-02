// lib/adminElevation.ts
//
// تأكيد بخطوة إضافية (step-up re-authentication) للإجراءات الخطيرة في
// لوحة المالك - Gift/Extend، تسعير مخصّص، تغيير صلاحيات، انتحال حساب
// (Impersonate)، تعليق حساب. جلسة أدمن مفتوحة من زمان (حتى لو مسروقة)
// مش كافية لتنفيذ أي منها - لازم إثبات هوية طازج في نفس اللحظة.
//
// نفس نمط `createMfaPendingToken`/`verifyMfaPendingToken` في lib/auth.ts
// بالظبط، لكن بعد الدخول لا قبله: توكن قصير العمر جداً، ومربوط بالمستخدم
// نفسه، مخزّن في كوكي httpOnly منفصل - صفر تخزين جديد في قاعدة البيانات.

import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

export const ADMIN_ELEVATED_COOKIE = "adloop_admin_elevated";

/** عشر دقائق: تكفي لإتمام إجراء واحد واعٍ، ولا تكفي لتُنسى مفتوحة في تبويب. */
export const ELEVATION_MINUTES = 10;

export function createElevationToken(userId: string): string {
  return jwt.sign({ userId, elevated: true }, process.env.JWT_SECRET!, {
    expiresIn: `${ELEVATION_MINUTES}m`,
  });
}

/** يتحقّق أن الطلب يحمل رفعة صالحة **ولهذا المستخدم تحديداً** - رفعة
 *  أدمن آخر لا تفتح إجراء أدمن غيره. */
export function hasValidElevation(req: NextRequest, userId: string): boolean {
  return verifyToken(req.cookies.get(ADMIN_ELEVATED_COOKIE)?.value, userId, "elevated");
}

// ══════════════════════════════════════════════════════════════════════
// قفل دخول اللوحة - **غير الرفعة، وعن قصد**
// ══════════════════════════════════════════════════════════════════════
//
// 🔴 كانت اللوحة بتتفتح بجلسة صالحة وحدها. يعني حساب أدمن سايب تبويبه
// مفتوح - أو جلسة مسروقة - بيوصل لشاشة بتوقف حسابات وتغيّر أسعار **بدوسة
// واحدة**، من غير ما يثبت إنّه هو. الرفعة كانت موجودة لكن على الأفعال بس،
// فالقراءة كلّها (بيانات كل عميل، كل رقم مالي) كانت مفتوحة بلا إثبات.
//
// **وليه قفلان لا واحد:**
//   • قفل الدخول أطول (ساعة) لأنّه بيتسأل مرّة عند الدخول، وتقصيره معناه
//     إعادة كتابة كلمة السر كل عشر دقايق وانت بتتصفّح - إزعاج بيدفع صاحبه
//     يدوّر على طريقة يعطّله بيها، فيرجع الوضع أسوأ من الأول.
//   • ورفعة الفعل تفضل عشر دقايق زي ما هي، لأنّ سؤالها مختلف: مش "انت
//     مين؟" بل "انت متأكّد **دلوقتي**؟" قبل فعل لا يرجع.
//
// توحيدهما في مدّة واحدة كان بيضحّي بواحد منهما حتماً.

export const ADMIN_UNLOCK_COOKIE = "adloop_admin_unlocked";

/** ساعة: تكفي جلسة عمل على اللوحة، ولا تكفي لتُنسى مفتوحة ليوم. */
export const UNLOCK_MINUTES = 60;

export function createUnlockToken(userId: string): string {
  return jwt.sign({ userId, unlocked: true }, process.env.JWT_SECRET!, {
    expiresIn: `${UNLOCK_MINUTES}m`,
  });
}

/**
 * يتحقّق من قفل الدخول بقيمة الكوكي مباشرةً لا بـ`NextRequest`.
 *
 * السبب إنّ الفاحص الأهمّ هو `app/admin/layout.tsx` - مكوّن خادم بيقرا
 * بـ`cookies()` من `next/headers` ومعندوش `NextRequest` أصلاً. تمرير
 * القيمة بيخلّي الدالة تشتغل في المكانين بلا نسختين من نفس المنطق.
 */
export function hasValidUnlockToken(token: string | undefined, userId: string): boolean {
  return verifyToken(token, userId, "unlocked");
}

/** التحقّق المشترك: التوقيع، والحقل، وأنّ التوكن **لهذا المستخدم**. */
function verifyToken(
  token: string | undefined,
  userId: string,
  claim: "elevated" | "unlocked"
): boolean {
  if (!token) return false;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as {
      userId: string;
      elevated?: boolean;
      unlocked?: boolean;
    };
    // ربط التوكن بصاحبه مقصود: توكن أدمن لا يفتح لوحة أدمن آخر، حتى لو
    // كان الاتنين صالحين. والفصل بين الحقلين يمنع أن يُستعمل قفل الدخول
    // الطويل مكان رفعة الفعل القصيرة - وهي الثغرة الوحيدة في وجود الاتنين.
    return payload[claim] === true && payload.userId === userId;
  } catch {
    return false;
  }
}
