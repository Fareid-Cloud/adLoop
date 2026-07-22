// app/api/cron/backup/route.ts
//
// نسخة احتياطية أسبوعية مستقلة (Vercel Blob، مزوّد مختلف عن قاعدة
// البيانات). محمي بنفس CRON_SECRET المستخدم في باقي الـ crons.

import { NextRequest, NextResponse } from "next/server";
import { backupCriticalData, pruneOldBackups } from "@/lib/backup";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await backupCriticalData();
  if (result.success) {
    await pruneOldBackups();
  }

  return NextResponse.json(result);
}
