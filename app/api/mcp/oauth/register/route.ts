// app/api/mcp/oauth/register/route.ts
//
// التسجيل الديناميكيّ للعملاء (RFC 7591).
//
// **مفتوحٌ بلا مصادقة عن قصد** - وهو ما توجبه المواصفة: العميل يسجّل نفسه
// قبل أن يكون له مستخدمٌ أصلاً. والتسجيلُ لا يمنح شيئاً: لا بيانات تُقرأ
// إلّا بعد أن يوافق مشتركٌ حقيقيّ في مسار التفويض. فأسوأ ما يفعله المُسيء
// أن يملأ جدولاً بأسماء عملاء لا تصل إلى شيء.

import { NextRequest, NextResponse } from "next/server";
import { registerClient } from "@/lib/mcp/oauth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // سقفٌ على عنوان الشبكة: المسار مفتوح، فالحدّ هو ما يمنع إغراق الجدول.
  const limited = await checkRateLimit(getClientIp(req), "mcp-register", 10, 60);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "temporarily_unavailable", error_description: "Too many registration attempts. Try again shortly." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "Request body is not valid JSON." },
      { status: 400 }
    );
  }

  const result = await registerClient(body);
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
