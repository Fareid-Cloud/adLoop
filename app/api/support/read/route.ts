// app/api/support/read/route.ts - العميل شاف ردود الدعم، نعلّمها مقروءة
//
// مافيش `threadId` في الطلب عن قصد: العميل بيشوف محادثةً واحدة، والتصفيرُ
// بمعرَّفٍ من العميل كان بيخلّي ردوداً في محادثاتٍ تانية تفضل غير مقروءة
// وتولّع الشارة للأبد. التفصيلُ في `lib/supportUnread.ts`.
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { markSupportRead } from "@/lib/supportUnread";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await markSupportRead(user.id);
  return NextResponse.json({ ok: true, unread: 0 });
}
