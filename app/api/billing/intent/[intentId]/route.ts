// app/api/billing/intent/[intentId]/route.ts
//
// صفحة العودة من البوّابة تسأل هذا المسار حتى يصل الويب هوك ويقلب
// الحالة. **لا يُفعّل شيئاً** - يقرأ فقط. التفعيل من الويب هوك وحده،
// لأن صفحة العودة تُفتح برابط مباشر بلا دفع.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getIntentStatus } from "@/lib/billing";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ intentId: string }> }
) {
  const { intentId } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const intent = await getIntentStatus(user.id, intentId);
  if (!intent) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ intent });
}
