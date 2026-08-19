// middleware.ts
//
// شيئان قبل أن تصل الطلبات إلى معالجاتها:
//   ١) صفحات `/dashboard` لا تُفتح بلا كوكي جلسة (فحصٌ سريع؛ التحقّق
//      الكامل من التوكن يبقى داخل كلّ مسار عبر `getSessionUser`).
//   ٢) كلّ كتابةٍ مُصادَقةٍ بكوكي تُرفَض إن جاءت من أصلٍ آخر.

import { NextRequest, NextResponse } from "next/server";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * حراسة الأصل للكتابات المُصادَقة بالكوكي.
 *
 * 🔴 **تسعةٌ من مئة مسار كتابةٍ كانت تتحقّق من رمز CSRF.** والباقي متروكٌ
 * لـ`SameSite=Lax` وحدها، وهي تقلّل الخطر الكلاسيكيّ ولا تُغني عنه: نطاقٌ
 * فرعيٌّ مخترَق يُعَدّ same-site، وأيّ تخفيفٍ للسياسة مستقبلاً يفتح الباب
 * كلَّه دفعةً واحدة.
 *
 * وإضافة سطرٍ إلى واحدٍ وتسعين ملفّاً حلٌّ هشّ - أوّلُ مسارٍ جديد يُكتب
 * بلا السطر، ولا شيء يشكو. فالحراسة هنا: موضعٌ واحد يمرّ عليه كلُّ طلب،
 * ولا يمكن لمسارٍ جديد أن «ينسى» المرور به.
 *
 * والشرط دقيقٌ عمداً:
 *   - الطرق الآمنة (GET/HEAD) لا تُمَسّ.
 *   - بلا كوكي جلسة لا خطر أصلاً: الويب هوك يُوقَّع، وMCP يحمل Bearer -
 *     كلاهما لا يعتمد على كوكي المتصفّح فلا يعبر منه هجومُ أصلٍ آخر.
 *   - غيابُ `Origin` لا يُرفَض: المتصفّحات تُرسله مع كلّ كتابةٍ عابرةِ
 *     أصل، وغيابُه يعني نداءً من خادمٍ لا من صفحةٍ في متصفّح ضحيّة.
 */
function crossOriginWrite(req: NextRequest): boolean {
  if (!UNSAFE.has(req.method)) return false;
  if (!req.cookies.get("session")?.value) return false;

  const origin = req.headers.get("origin");
  if (!origin) return false;

  try {
    // المقارنة بالمضيف لا بالنصّ كاملاً: الوكيل قد يغيّر المخطّط أو المنفذ،
    // والمضيف هو ما يفصل موقعنا عن موقع المهاجم.
    return new URL(origin).host !== req.nextUrl.host;
  } catch {
    // `Origin` غير صالح - لا يرسله متصفّحٌ سليم، فيُرفض
    return true;
  }
}

export function middleware(req: NextRequest) {
  if (crossOriginWrite(req)) {
    return NextResponse.json(
      { error: "cross_origin_request_blocked" },
      { status: 403 }
    );
  }

  // ما بعده يخصّ صفحات اللوحة وحدها
  if (!req.nextUrl.pathname.startsWith("/dashboard")) return NextResponse.next();

  if (!req.cookies.get("session")?.value) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // `/api` أُضيف لأجل حراسة الأصل. والاستثناءات ليست ثغرة: الويب هوك
  // والمصادقة لا تحملان كوكي جلسة أصلاً، فالحارس يتخطّاهما بحكم شرطه -
  // لكن استثناءها صراحةً يجنّبنا تشغيل الوسيط على مسارات المزوّدين.
  matcher: ["/dashboard/:path*", "/api/((?!webhooks/|auth/|mcp).*)"],
};
