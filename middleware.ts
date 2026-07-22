// middleware.ts
//
// بيحمي أي صفحة تحت /dashboard - لو مفيش جلسة صحيحة، يرجّع المستخدم لصفحة الدخول.
// (التحقق الكامل من صحة التوكن بيحصل جوه كل route لوحده عن طريق getSessionUser،
// الـ middleware هنا بس فحص سريع لوجود الكوكيز قبل ما تدخل الصفحة أصلاً)

import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const session = req.cookies.get("session")?.value;

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
