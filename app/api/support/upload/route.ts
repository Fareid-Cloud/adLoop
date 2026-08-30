// app/api/support/upload/route.ts - رفع صور مرفقة عبر Vercel Blob (اختياري)
//
// نقطة واحدة للطرفين: العميل والمالك. المسار يفصل بينهما (`support/<userId>/`
// مقابل `support/admin/`) فيبقى واضحاً من رفع ماذا عند المراجعة.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { put } from "@vercel/blob";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { isOwnerEmail } from "@/lib/owner";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale: Locale = (user.preferredLocale as Locale) ?? "ar";

  // الرفع معطَّل لا مكسور: الرسالة تقول ما الناقص وما الخطوة، لا "خطأ" مبهم.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: t(locale, "supportUpload.disabled") }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: t(locale, "supportUpload.noFile") }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: t(locale, "supportUpload.tooLarge") }, { status: 413 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: t(locale, "supportUpload.imagesOnly") }, { status: 415 });
  }

  const isOwner = user.isAdmin || isOwnerEmail(user.email);
  const scope = isOwner ? "admin" : user.id;

  try {
    // 🔴 **كانت المرفقات تُرفع `access: "public"`** - أي رابطٍ يُقدّمه التخزين
    // **بلا أيّ مصادقة، للأبد**، ويبقى عاملاً بعد إغلاق التذكرة وبعد حذف
    // الحساب. ولقطاتُ الدعم هي بالضبط حيث تقع بيانات العملاء: لوحةُ طلبات،
    // محادثةُ واتساب، تصديرُ فورم ليدز. فصارت خاصّةً، ولا يُعاد رابطُ
    // التخزين إطلاقاً - بل مسارُنا المصادَق عليه، فيُفحَص عند كلّ عرض أنّ
    // القارئ صاحبُ التذكرة أو الدعم. واسمُ الملفّ الأصليّ لا يدخل المسار:
    // قد يحمل بنفسه اسم عميلٍ أو رقم طلب.
    const ext = (file.name.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? "").toLowerCase();
    const rest = `${scope}/${Date.now()}-${randomUUID()}${ext}`;
    await put(`support/${rest}`, file, { access: "private", addRandomSuffix: false });
    return NextResponse.json({ url: `/api/support/attachment/${rest}` });
  } catch (err) {
    // فشل التخزين الخارجي لا يجوز أن يظهر كخطأ عامّ: المالك يحتاج أن يعرف
    // أن التوكن موجود لكنه غير صالح، لا أن "الرفع لا يعمل".
    console.error("[support/upload] فشل الرفع إلى Vercel Blob:", err);
    return NextResponse.json({ error: t(locale, "supportUpload.failed") }, { status: 502 });
  }
}
