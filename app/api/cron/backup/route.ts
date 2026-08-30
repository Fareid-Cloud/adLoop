// app/api/cron/backup/route.ts
//
// نسخة احتياطية أسبوعية مستقلة (Vercel Blob، مزوّد مختلف عن قاعدة
// البيانات). محمي بنفس CRON_SECRET المستخدم في باقي الـ crons.

import { NextRequest } from "next/server";
import { denyUnlessCron } from "@/lib/cronAuth";
import { backupCriticalData, pruneOldBackups } from "@/lib/backup";
import { finishCronRun } from "@/lib/cronRun";

// نسخة كاملة بتقرا جداول وترفعها لمزوّد تاني - المهلة الافتراضية
// (١٥ ثانية) بتقطعها في نصّها، والنسخة المقطوعة أخطر من عدم وجودها.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = denyUnlessCron(req);
  if (denied) return denied;

  const startedAt = Date.now();
  const result = await backupCriticalData();
  if (result.success) {
    await pruneOldBackups();
  }

  // 🔴 نسخةٌ فشلت كانت تُرَدّ بـ`200` - فلوحةُ الكرون تعرضها ناجحة، ولا
  // شيء في المنتج كلّه يقول إن كانت النسخة الأسبوعية قد جرت. ونسخةٌ
  // يُظنّ أنها موجودة أخطر من غيابٍ معلوم.
  return finishCronRun(
    {
      job: "backup",
      total: 1,
      succeeded: result.success ? 1 : 0,
      failed: result.success ? 0 : 1,
      startedAt,
      errors: result.success ? undefined : result,
    },
    { result }
  );
}
