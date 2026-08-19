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
  const token = req.cookies.get(ADMIN_ELEVATED_COOKIE)?.value;
  if (!token) return false;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as {
      userId: string;
      elevated?: boolean;
    };
    return !!payload.elevated && payload.userId === userId;
  } catch {
    return false;
  }
}
