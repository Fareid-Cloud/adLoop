// lib/adminGuard.ts
//
// **نقطة اختناق واحدة لكل مسار في لوحة المالك.**
//
// اللوحة دي بتقدر تهدي اشتراكات وتغيّر أسعار وتنتحل هويات وتوقف حسابات.
// كل مسار فيها لازم يعدّي على نفس أربع بوابات: جلسة صالحة، دور كافي،
// توكن CSRF لأي كتابة، ورفعة طازجة للأفعال الخطيرة. كتابة الأربعة بالإيد
// في كل مسار معناها إن أول مسار جديد يُنسى فيه سطر واحد يبقى هو الثغرة -
// وده بالظبط اللي حصل قبل كده في `stop-impersonating`.
//
// الترتيب هنا مقصود: الهوية → التعليق → الدور → CSRF → الرفعة. الأغلى
// (نداء قاعدة بيانات للرفعة مثلاً) بيجي بعد الأرخص، والرسالة اللي
// بترجع مابتفرّقش بين "مش أدمن" و"مش موجود" - الاتنين 401/403 بلا تفصيل.

import { NextRequest, NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getSessionUserFromCookies } from "@/lib/auth";
import { verifyCsrfToken } from "@/lib/csrf";
import { hasValidElevation } from "@/lib/adminElevation";
import {
  resolveAdminRole,
  adminCapabilities,
  type AdminCapability,
  type AdminRoleName,
} from "@/lib/adminRole";

export interface AdminGuardOptions {
  /** القدرة المطلوبة - مش الصفحة، القدرة (راجع lib/adminRole.ts) */
  capability: AdminCapability;
  /** أي طلب بيكتب: بيفرض فحص CSRF */
  mutating?: boolean;
  /** أفعال لا رجعة فيها أو بتمسّ فلوس/صلاحيات: بتفرض تحقّق طازج */
  elevated?: boolean;
}

export type AdminGuardResult =
  | { ok: true; admin: User; role: AdminRoleName }
  | { ok: false; response: NextResponse };

export async function guardAdmin(
  req: NextRequest,
  opts: AdminGuardOptions
): Promise<AdminGuardResult> {
  const admin = await getSessionUserFromCookies();
  if (!admin) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  // أدمن معلَّق مايدخلش لوحته. الحالة نادرة بس حقيقية: تعليق حساب
  // موظّف دعم مشى هو أوّل فعل بيتعمل، ومايصحّش يفضل معاه المفتاح.
  if (admin.isSuspended) {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  const role = resolveAdminRole(admin);
  if (!role) {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  if (!adminCapabilities(role).includes(opts.capability)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "insufficient_role" }, { status: 403 }),
    };
  }

  if (opts.mutating && !verifyCsrfToken(req)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "csrf validation failed" }, { status: 403 }),
    };
  }

  // الكود ده بالذات هو اللي الواجهة بتترجمه لنافذة "أكّد هويتك" -
  // مايتغيّرش بلا تعديل `AdminActionGate` معاه.
  if (opts.elevated && !hasValidElevation(req, admin.id)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "elevation_required" }, { status: 403 }),
    };
  }

  return { ok: true, admin, role };
}
