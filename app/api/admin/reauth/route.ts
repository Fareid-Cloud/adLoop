// app/api/admin/reauth/route.ts
//
// تحقّق طازج (step-up) قبل أي إجراء أدمن خطير - كلمة السر، أو كود
// MFA/ورقة استرجاع لمن فعّله. النجاح بيدّي كوكي رفعة قصيرة العمر
// (10 دقايق) تستهلكها المسارات الحساسة نفسها، مش الجلسة العادية.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSessionUserFromCookies } from "@/lib/auth";
import { isAdminUser } from "@/lib/adminRole";
import { prisma } from "@/lib/prisma";
import { verifyCsrfToken } from "@/lib/csrf";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { createElevationToken, ELEVATION_MINUTES } from "@/lib/adminElevation";
import { decryptMfaSecret, verifyMfaCode, matchBackupCode } from "@/lib/mfa";
import { validateOrError } from "@/lib/validation/schemas";
import { logAdminAction } from "@/lib/adminAudit";

const schema = z.object({
  password: z.string().min(1).optional(),
  code: z.string().min(6).max(24).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await getSessionUserFromCookies();
  // 🔴 كان الفحص `admin.isAdmin` الخام. المالك بيتعرّف ببريده (isOwnerEmail)
  // من غير ما يكون الحقل متظبّط في قاعدة البيانات - يعني اللوحة كانت
  // بتفتح له وكل فعل محتاج رفعة بيرجع 401. الدور بيتحسم من مكان واحد.
  if (!admin || !isAdminUser(admin)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  // نفس صرامة التحقّق بخطوتين وقت الدخول - إجراء أدمن خطير يستاهل نفس الحماية
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(`${admin.id}:${ip}`, "admin-reauth", 5, 10);
  if (!allowed) {
    return NextResponse.json({ error: "too many attempts" }, { status: 429 });
  }

  const rawBody = await req.json();
  const validation = validateOrError(schema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { password, code } = validation.data;

  let verified = false;

  if (password) {
    verified = admin.passwordHash ? await bcrypt.compare(password, admin.passwordHash) : false;
  } else if (code && admin.mfaEnabled && admin.mfaSecret) {
    const secret = decryptMfaSecret(admin.mfaSecret);
    verified = await verifyMfaCode(secret, code);
    if (!verified) {
      const stored = await prisma.mfaBackupCode.findMany({
        where: { userId: admin.id, usedAt: null },
        select: { id: true, codeHash: true },
      });
      const matchedId = await matchBackupCode(code, stored);
      if (matchedId) {
        await prisma.mfaBackupCode.update({ where: { id: matchedId }, data: { usedAt: new Date() } });
        verified = true;
      }
    }
  }

  if (!verified) {
    // نجاح الرفعة مش محتاج سطر - الفعل اللي بعده بيتسجّل بنفسه. الفشل هو
    // الإشارة: جلسة أدمن صالحة بتحاول تخمّن كلمة السر معناها إنّ الجلسة
    // نفسها في إيد غلط، وده بالظبط السيناريو اللي الرفعة موجودة عشانه.
    await logAdminAction({
      adminUserId: admin.id,
      action: "REAUTH_FAILED",
      details: `${password ? "password" : "code"} · ip ${ip}`,
    });
    return NextResponse.json({ error: "verification failed" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true, expiresInMinutes: ELEVATION_MINUTES });
  response.cookies.set("adloop_admin_elevated", createElevationToken(admin.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * ELEVATION_MINUTES,
    path: "/",
  });
  return response;
}
