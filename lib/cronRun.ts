// lib/cronRun.ts
//
// **أثرُ كلّ مهمّةٍ مجدولة، ورمزُ حالتها الصادق.**
//
// 🔴 كانت المهامّ الستّ ترجع `200` مهما جرى بداخلها: تفشل مزامنةُ كلّ
// مساحةٍ على حدة، وتُجمَع أخطاؤها في مصفوفة، ثمّ يُرَدّ «نجاح». ولوحةُ
// الكرون عند المنصّة تقرأ رمزَ الحالة وحده - فيومٌ فشل فيه كلُّ شيء يبدو
// فيها **مطابقاً تماماً** ليومٍ نجح فيه كلُّ شيء. ولا إنذار يُرفع.
//
// وأسوأ منه: خمسٌ من الستّ لا تكتب صفَّ تشغيلٍ إطلاقاً - فالسؤال «هل جرت
// النسخةُ الاحتياطية هذا الأسبوع؟» لا جواب له في المنتج كلّه. ويومٌ
// توقّفت فيه المهمّة يبدو من كلّ زاويةٍ متاحة مطابقاً ليومٍ لم تُستدعَ فيه.
//
// فهنا موضعٌ واحد: يكتب الصفّ باسم المهمّة، ويشتقّ رمزَ الحالة من النتيجة
// لا من مجرّد بلوغ آخر السطر.

import { prisma } from "./prisma";
import { NextResponse } from "next/server";

export interface CronOutcome {
  /** اسم المهمّة كما في `vercel.json` - مفتاح القراءة لاحقاً */
  job: string;
  total: number;
  succeeded: number;
  failed: number;
  startedAt: number;
  /** تفصيلٌ يُحفَظ للتشخيص - لا يُعرَض لمشترك */
  errors?: unknown;
}

/**
 * يسجّل التشغيلة ويردّ استجابةً رمزُها يطابق ما جرى فعلاً:
 *   - `200` لا فشل فيه
 *   - `207` نجح بعضُه (Multi-Status) - المهمّة عملت وبعضُ العناصر سقط
 *   - `500` لم ينجح شيءٌ وقد كان هناك ما يُعالَج
 *
 * والتسجيل لا يُفشِل المهمّة: سقوطُ صفِّ سجلٍّ لا يُبطل عملاً تمّ.
 */
export async function finishCronRun(
  outcome: CronOutcome,
  body: Record<string, unknown> = {}
): Promise<NextResponse> {
  const { job, total, succeeded, failed, startedAt, errors } = outcome;

  try {
    await prisma.cronRunLog.create({
      data: {
        job,
        totalWorkspaces: total,
        succeeded,
        failed,
        durationMs: Date.now() - startedAt,
        errors: failed > 0 && errors !== undefined ? JSON.stringify(errors).slice(0, 8000) : null,
      },
    });
  } catch (err) {
    console.error(`[cron:${job}] تعذّر تسجيل صفّ التشغيل:`, err);
  }

  const status = failed === 0 ? 200 : succeeded > 0 ? 207 : 500;
  return NextResponse.json({ ok: failed === 0, job, total, succeeded, failed, ...body }, { status });
}
