// app/api/admin/lock/route.ts
//
// قفل اللوحة يدوياً - يمسح كوكي الفتح فتُغلق فوراً بدل انتظار المهلة.
//
// **مايعدّيش على `guardAdmin` عن قصد.** الحارس بيشترط قفلاً صالحاً، وقفل
// اللوحة وهي مقفولة أصلاً مش خطأ - هو نتيجةٌ صحيحة. اشتراط الفتح عشان
// تقفل بيخلّي الزرار يفشل بالظبط في الحالة اللي ماتفرقش، ويشتغل بس في
// الحالة اللي بتفرق، فبيبان "بايظ أحياناً" بلا سبب مفهوم.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromCookies } from "@/lib/auth";
import { isAdminUser } from "@/lib/adminRole";
import { verifyCsrfToken } from "@/lib/csrf";
import { ADMIN_ELEVATED_COOKIE, ADMIN_UNLOCK_COOKIE } from "@/lib/adminElevation";

export async function POST(req: NextRequest) {
  const admin = await getSessionUserFromCookies();
  if (!admin || !isAdminUser(admin)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  // الرفعة بتتمسح مع القفل: سايبها شغّالة بعد القفل معناه إنّ فتحاً جديداً
  // بيلاقي فعلاً خطيراً جاهزاً للتنفيذ بلا سؤال - وهو عكس الغرض بالظبط.
  const res = NextResponse.json({ locked: true });
  for (const name of [ADMIN_UNLOCK_COOKIE, ADMIN_ELEVATED_COOKIE]) {
    res.cookies.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return res;
}
