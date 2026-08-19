// app/api/cron/backup/route.ts
//
// نسخة احتياطية أسبوعية مستقلة (Vercel Blob، مزوّد مختلف عن قاعدة
// البيانات). محمي بنفس CRON_SECRET المستخدم في باقي الـ crons.

import { NextRequest, NextResponse } from "next/server";
import { denyUnlessCron } from "@/lib/cronAuth";
import { backupCriticalData, pruneOldBackups } from "@/lib/backup";

// نسخة كاملة بتقرا جداول وترفعها لمزوّد تاني - المهلة الافتراضية
// (١٥ ثانية) بتقطعها في نصّها، والنسخة المقطوعة أخطر من عدم وجودها.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = denyUnlessCron(req);
  if (denied) return denied;

  const result = await backupCriticalData();
  if (result.success) {
    await pruneOldBackups();
  }

  return NextResponse.json(result);
}
