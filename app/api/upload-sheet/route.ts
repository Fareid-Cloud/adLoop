// app/api/upload-sheet/route.ts
//
// بيستقبل ملف Excel، يقرأه، ويخزن الصفوف في UploadedSheetRow عشان تدخل
// في نفس المقارنات جنب Google Ads وMeta.
//
// إصلاحين أمنيين من المراجعة الشاملة:
// 1) مكتبة xlsx القديمة فيها ثغرتين عاليتي الخطورة (Prototype Pollution
//    وReDoS) بدون إصلاح متاح من المطور - استُبدلت بـ read-excel-file
//    (صفر ثغرات معروفة، أصغر 7 مرات، ومخصصة للقراءة فقط وهو استخدامنا بالظبط)
// 2) BOLA - كان مفيش فحص ملكية على workspaceId خالص، أي مستخدم كان يقدر
//    يرفع بيانات لـ Workspace مستخدم تاني لو عرف الـ ID
//
// الشكل المتوقع للملف (أعمدة لازم تكون موجودة):
// Date | Campaign | Impressions | Clicks | Cost | Conversions

import { NextRequest, NextResponse } from "next/server";
import { readSheet } from "read-excel-file/node";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const workspaceId = formData.get("workspaceId") as string | null;
  const sourceLabel = (formData.get("sourceLabel") as string) || "Manual Source";

  if (!file || !workspaceId) {
    return NextResponse.json({ error: "الملف أو الـ workspace ناقص" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  // فحص أمان قبل المعالجة: حجم أقصى 5 ميجا (ملف بيانات إعلانات معقول
  // مش المفروض يعدّي كده أبداً)، ونوع الملف Excel فعلاً - يمنع محاولات
  // إغراق السيرفر بملف ضخم أو ملف مش Excel أصلاً (Resource Exhaustion)
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "الملف كبير جداً - الحد الأقصى 5 ميجابايت" }, { status: 400 });
  }
  const validTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];
  if (file.type && !validTypes.includes(file.type)) {
    return NextResponse.json({ error: "الملف لازم يكون Excel (.xlsx أو .xls)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawRows: any[][];
  try {
    rawRows = await readSheet(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: "تعذّر قراءة الملف - تأكد إنه ملف Excel صحيح" },
      { status: 400 }
    );
  }

  if (rawRows.length < 2) {
    return NextResponse.json({ error: "الملف فاضي أو مفيهوش صفوف بيانات" }, { status: 400 });
  }

  const headers = rawRows[0].map((h) => String(h ?? "").trim());
  const requiredCols = ["Date", "Campaign", "Impressions", "Clicks", "Cost", "Conversions"];
  const missing = requiredCols.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `أعمدة ناقصة في الملف: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const colIndex = Object.fromEntries(requiredCols.map((c) => [c, headers.indexOf(c)]));
  const rows = rawRows.slice(1).map((row) => ({
    Date: row[colIndex.Date],
    Campaign: row[colIndex.Campaign],
    Impressions: row[colIndex.Impressions],
    Clicks: row[colIndex.Clicks],
    Cost: row[colIndex.Cost],
    Conversions: row[colIndex.Conversions],
  }));

  const uploadedSheet = await prisma.uploadedSheet.create({
    data: {
      workspaceId,
      fileName: file.name,
      sourceLabel,
      rowsCount: rows.length,
    },
  });

  await prisma.uploadedSheetRow.createMany({
    data: rows.map((r) => ({
      uploadedSheetId: uploadedSheet.id,
      date: new Date(r.Date as any),
      campaignName: String(r.Campaign),
      impressions: Number(r.Impressions) || 0,
      clicks: Number(r.Clicks) || 0,
      cost: Number(r.Cost) || 0,
      conversions: Number(r.Conversions) || 0,
    })),
  });

  return NextResponse.json({ success: true, rowsImported: rows.length });
}
