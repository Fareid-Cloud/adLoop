// app/api/connected-platforms/[id]/route.ts
//
// تسمية منحة الوصول.
//
// حين يملك المشترك تسجيلَي دخولٍ لجوجل، لا يفرّق بينهما في الواجهة شيء:
// الشعار واحد والاسم واحد وتاريخ الربط قريب. والاسم هو ما يجعل «افصل هذه»
// قراراً واعياً بدل مقامرة - فبدونه يفصل الوكيل منحة عميلٍ ظنّاً أنّها
// منحة آخر، ولا يكتشف ذلك حتى تتوقّف مزامنةٌ لا يتوقّع توقّفها.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

/** أطول ما يُعرض في سطر البطاقة دون أن يزاحم ما حوله */
const MAX_LABEL = 60;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const body = await req.json().catch(() => null);
  const raw = typeof body?.label === "string" ? body.label.trim() : null;
  if (raw !== null && raw.length > MAX_LABEL) {
    return NextResponse.json({ error: t(locale, "apiErr.labelTooLong", { max: MAX_LABEL }) }, { status: 400 });
  }

  // الملكية شرطٌ في `where` لا فحصٌ سابق: بينهما نافذةٌ يمكن أن يتغيّر فيها
  // الصفّ، وشرطُ التحديث نفسه لا نافذة فيه.
  const updated = await prisma.connectedPlatform.updateMany({
    where: { id, userId: user.id },
    // النصّ الفارغ يعني «أزل الاسم» لا اسماً فارغاً يُعرض كفراغ محيّر.
    data: { label: raw ? raw : null },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
