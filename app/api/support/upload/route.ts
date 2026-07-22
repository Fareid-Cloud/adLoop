// app/api/support/upload/route.ts - رفع صور مرفقة عبر Vercel Blob (اختياري)
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "رفع الصور غير مفعّل حالياً" }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "لا يوجد ملف" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "الحد الأقصى 5 ميجابايت" }, { status: 413 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "الصور فقط" }, { status: 415 });

  const blob = await put(`support/${user.id}/${Date.now()}-${file.name}`, file, { access: "public" });
  return NextResponse.json({ url: blob.url });
}
