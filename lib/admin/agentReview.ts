// lib/admin/agentReview.ts
//
// **تقييم المساعد: القراءة موجَّهة لا عشوائية.**
//
// قراءةُ كلّ محادثة مستحيلة عملياً، والقراءةُ العشوائية بتوقّع على إجابات
// سليمة في أغلب الوقت. المطلوب العكس: **الأسوأ أوّلاً**. والترتيب هنا
// بيبني طابوراً بالإشارات اللي عندنا فعلاً:
//
//   ١. 👎 من صاحب الحساب - حكمُ مستخدمٍ حقيقيّ، أقوى إشارة عندنا.
//   ٢. إعادةُ السؤال - سأل تاني خلال دقيقتين، يعني الجواب ماكفاش.
//      إشارةٌ مجّانية تماماً وبتمسك اللي مافيش حدّ اتكلّف يقيّمه.
//   ٣. غير المراجَع الأحدث - الباقي، والأحدث أولى لأنّه بيوصف النسخة
//      الشغّالة دلوقتي.
//
// ⚠️ **حدٌّ صريح:** إعادةُ السؤال إشارةٌ لا دليل. فيه ناس بتسأل سؤالاً
// تانياً مختلفاً بسرعة، وفيه إجابةٌ ممتازة بتفتح سؤالاً أعمق. بتترفع
// للمراجعة، ما بتتحكمش عليها.

import { prisma } from "@/lib/prisma";
import type { DateRange } from "./shared";

/** أقصرُ من كده والسؤالُ التاني إكمالٌ لنفس النَّفَس لا استياءٌ من جواب. */
const REASK_WINDOW_MS = 2 * 60_000;

export interface ReviewRow {
  id: string;
  chatId: string;
  chatTitle: string;
  workspaceId: string;
  userEmail: string;
  question: string;
  answer: string;
  createdAt: Date;
  rating: number | null;
  verdict: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  promptVersion: string | null;
  contextSummary: unknown;
  /** سأل تاني خلال نافذة قصيرة - إشارةُ عدم رضا مجّانية */
  reasked: boolean;
}

export interface AgentReviewSummary {
  answers: number;
  rated: number;
  thumbsUp: number;
  thumbsDown: number;
  reasked: number;
  reviewed: number;
  medianLatencyMs: number | null;
  avgOutputTokens: number | null;
  /** توزيعُ الأحكام - بيقول **نوع** العطب لا حجمه فقط */
  byVerdict: Array<{ verdict: string; count: number }>;
  /** أداءُ كلّ نسخةِ تعليمات - أساسُ «التعديل نفع ولا لأ» */
  byPromptVersion: Array<{
    version: string;
    answers: number;
    thumbsUp: number;
    thumbsDown: number;
    reaskedPct: number | null;
  }>;
}

export type ReviewFilter = "queue" | "thumbsdown" | "reasked" | "reviewed" | "all";

export async function getAgentReview(
  range: DateRange,
  filter: ReviewFilter = "queue",
  take = 40
): Promise<{ rows: ReviewRow[]; summary: AgentReviewSummary }> {
  // كلُّ رسائل الفترة مرّةً واحدة: الأسئلة لازمة عشان نجيب سؤالَ كلّ إجابة
  // ونحسب إعادةَ السؤال، وجلبُها باستعلامٍ لكلّ صفّ كان N+1 حقيقيّ.
  const messages = await prisma.agentMessage.findMany({
    where: { createdAt: { gte: range.from, lte: range.to } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, chatId: true, role: true, content: true, createdAt: true,
      rating: true, verdict: true, reviewNote: true, reviewedAt: true,
      latencyMs: true, inputTokens: true, outputTokens: true,
      promptVersion: true, contextSummary: true,
      chat: {
        select: {
          title: true, workspaceId: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  // ترتيبُ كلّ محادثة على حدة - إعادةُ السؤال معناها "السؤال اللي بعد
  // الجواب في **نفس** المحادثة"، مش الرسالة اللي بعده زمنياً في الجدول.
  const byChat = new Map<string, typeof messages>();
  for (const m of messages) {
    const list = byChat.get(m.chatId) ?? [];
    list.push(m);
    byChat.set(m.chatId, list);
  }

  const rows: ReviewRow[] = [];
  for (const list of byChat.values()) {
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.role !== "assistant") continue;

      const previous = list[i - 1];
      const next = list[i + 1];
      const reasked =
        !!next &&
        next.role === "user" &&
        next.createdAt.getTime() - m.createdAt.getTime() <= REASK_WINDOW_MS;

      rows.push({
        id: m.id,
        chatId: m.chatId,
        chatTitle: m.chat.title,
        workspaceId: m.chat.workspaceId,
        userEmail: m.chat.user.email,
        // سؤالٌ غائب حالةٌ حقيقيّة: أوّل رسالةٍ في محادثةٍ بدأت قبل الفترة.
        question: previous?.role === "user" ? previous.content : "—",
        answer: m.content,
        createdAt: m.createdAt,
        rating: m.rating,
        verdict: m.verdict,
        reviewNote: m.reviewNote,
        reviewedAt: m.reviewedAt,
        latencyMs: m.latencyMs,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        promptVersion: m.promptVersion,
        contextSummary: m.contextSummary,
        reasked,
      });
    }
  }

  const summary = summarise(rows);

  const filtered = rows.filter((r) => {
    switch (filter) {
      case "queue": return !r.reviewedAt;
      case "thumbsdown": return r.rating === -1;
      case "reasked": return r.reasked;
      case "reviewed": return !!r.reviewedAt;
      default: return true;
    }
  });

  // الأسوأ أوّلاً داخل الفلتر: 👎 ثمّ إعادةُ السؤال ثمّ الأحدث.
  filtered.sort((a, z) => {
    const score = (r: ReviewRow) => (r.rating === -1 ? 2 : 0) + (r.reasked ? 1 : 0);
    const diff = score(z) - score(a);
    return diff !== 0 ? diff : z.createdAt.getTime() - a.createdAt.getTime();
  });

  return { rows: filtered.slice(0, take), summary };
}

function summarise(rows: ReviewRow[]): AgentReviewSummary {
  const latencies = rows
    .map((r) => r.latencyMs)
    .filter((v): v is number => v !== null)
    .sort((a, z) => a - z);

  const outputs = rows.map((r) => r.outputTokens).filter((v): v is number => v !== null);

  const verdicts = new Map<string, number>();
  for (const r of rows) {
    if (r.verdict) verdicts.set(r.verdict, (verdicts.get(r.verdict) ?? 0) + 1);
  }

  const versions = new Map<string, { answers: number; up: number; down: number; reasked: number }>();
  for (const r of rows) {
    const key = r.promptVersion ?? "unversioned";
    const v = versions.get(key) ?? { answers: 0, up: 0, down: 0, reasked: 0 };
    v.answers += 1;
    if (r.rating === 1) v.up += 1;
    if (r.rating === -1) v.down += 1;
    if (r.reasked) v.reasked += 1;
    versions.set(key, v);
  }

  return {
    answers: rows.length,
    rated: rows.filter((r) => r.rating !== null).length,
    thumbsUp: rows.filter((r) => r.rating === 1).length,
    thumbsDown: rows.filter((r) => r.rating === -1).length,
    reasked: rows.filter((r) => r.reasked).length,
    reviewed: rows.filter((r) => r.reviewedAt).length,
    // وسيطٌ لا متوسّط: نداءٌ واحد اتعلّق دقيقتين بيجرّ المتوسّط لرقمٍ
    // مابيوصفش أيّ إجابة حقيقية.
    medianLatencyMs: latencies.length
      ? latencies.length % 2 === 1
        ? latencies[(latencies.length - 1) / 2]
        : (latencies[latencies.length / 2 - 1] + latencies[latencies.length / 2]) / 2
      : null,
    avgOutputTokens: outputs.length
      ? Math.round(outputs.reduce((a, z) => a + z, 0) / outputs.length)
      : null,
    byVerdict: [...verdicts.entries()]
      .map(([verdict, count]) => ({ verdict, count }))
      .sort((a, z) => z.count - a.count),
    byPromptVersion: [...versions.entries()]
      .map(([version, v]) => ({
        version,
        answers: v.answers,
        thumbsUp: v.up,
        thumbsDown: v.down,
        reaskedPct: v.answers > 0 ? (v.reasked / v.answers) * 100 : null,
      }))
      .sort((a, z) => z.version.localeCompare(a.version)),
  };
}

/** الأحكام المتاحة - نصٌّ لا enum عمداً (راجع تعليق المخطّط). */
export const VERDICTS = [
  { key: "GOOD", label: "Good" },
  { key: "WRONG_NUMBER", label: "Wrong number" },
  { key: "HALLUCINATED", label: "Made something up" },
  { key: "SHALLOW", label: "Shallow" },
  { key: "IGNORED_DATA", label: "Ignored the data it had" },
  { key: "TOO_LONG", label: "Too long" },
] as const;
