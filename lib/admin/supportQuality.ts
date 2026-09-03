// lib/admin/supportQuality.ts
//
// **جودةُ الدعم مقيسةً برأي العميل، مقسومةً على الموظَّف.**
//
// الأرقامُ هنا كلُّها من `SupportRating` - رأيُ العميل نفسه، مش استنتاجاً
// من زمن الردّ أو عدد الرسائل. والقسمةُ على `agentId` **المحفوظ لحظةَ
// التقييم** لا على المسؤول الحاليّ عن المحادثة: التعيينُ بيتغيّر بعد
// التقييم (المحادثة بتتنقل، الموظّف بيمشي)، وقراءةُ الحاليّ كانت هتنسب
// رأيَ العميل لحدّ مالوش علاقة بالخدمة اللي قيّمها.
//
// ⚠️ **العيّنةُ الصغيرة كذّابة.** تقييمٌ واحد بخمسة بيدّي متوسّطاً ٥٫٠،
// وهو مش «أحسن موظّف» - هو موظّفٌ اتقيّم مرّة. عشان كده كلُّ صفٍّ بيحمل
// عددَ التقييمات جنب المتوسّط، والواجهةُ بتعلّم اللي تحت `MIN_SAMPLE`
// صراحةً بدل ما ترتّبه في الأوّل.

import { prisma } from "@/lib/prisma";
import { RATING_POSITIVE_FROM } from "@/lib/supportRating";
import type { DateRange } from "@/lib/admin/shared";

/** أقلُّ عددٍ يخلّي المتوسّط يتقري كإشارة لا كصدفة. */
export const MIN_SAMPLE = 5;

export interface AgentQuality {
  agentId: string | null;
  name: string;
  /** عددُ التقييمات اللي فيها درجة فعلاً. */
  rated: number;
  avg: number;
  positivePct: number;
  /** الأسبابُ الأكتر تكراراً عنده، مرتّبةً - مفاتيح لا نصّ معروض. */
  topReasons: Array<{ reason: string; n: number }>;
  /** أقلُّ من `MIN_SAMPLE` - المتوسّطُ مايتقارنش. */
  thin: boolean;
}

export interface SupportQuality {
  /** كم مرّةٍ سألنا (صفوفٌ اتعملت) وكم واحدةٍ رجعت بدرجة. */
  asked: number;
  rated: number;
  dismissed: number;
  /** نسبةُ اللي جاوبوا من اللي اتسألوا - صحّةُ الأداة نفسها. */
  responsePct: number;
  avg: number | null;
  positivePct: number | null;
  /** توزيعُ الدرجات ١..٥ - المتوسّطُ وحده بيخبّي الاستقطاب. */
  distribution: Record<number, number>;
  reasons: Array<{ reason: string; n: number }>;
  agents: AgentQuality[];
  comments: Array<{
    id: string;
    threadId: string;
    score: number | null;
    comment: string;
    agentName: string;
    customer: string;
    createdAt: Date;
  }>;
}

export async function getSupportQuality(range: DateRange): Promise<SupportQuality> {
  const rows = await prisma.supportRating.findMany({
    where: { createdAt: { gte: range.from, lte: range.to } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, threadId: true, score: true, reasons: true, comment: true,
      dismissedAt: true, createdAt: true,
      agentId: true,
      agent: { select: { name: true, email: true } },
      thread: { select: { name: true, email: true } },
    },
  });

  const scored = rows.filter((r) => r.score !== null);
  const asked = rows.length;
  const rated = scored.length;
  const dismissed = rows.filter((r) => r.dismissedAt !== null && r.score === null).length;

  const sum = scored.reduce((a, r) => a + (r.score ?? 0), 0);
  const positive = scored.filter((r) => (r.score ?? 0) >= RATING_POSITIVE_FROM).length;

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of scored) distribution[r.score!] = (distribution[r.score!] ?? 0) + 1;

  const reasonTally = new Map<string, number>();
  for (const r of scored) for (const x of r.reasons) reasonTally.set(x, (reasonTally.get(x) ?? 0) + 1);

  // القسمةُ على الموظَّف. `null` بيتجمّع في صفٍّ واحد اسمه «غير منسوب» -
  // إخفاؤه كان بيخلّي مجموعَ الصفوف أقلَّ من الإجمالي بلا تفسير.
  const byAgent = new Map<string | null, typeof scored>();
  for (const r of scored) {
    const list = byAgent.get(r.agentId) ?? [];
    list.push(r);
    byAgent.set(r.agentId, list);
  }

  const agents: AgentQuality[] = [...byAgent.entries()]
    .map(([agentId, list]) => {
      const tally = new Map<string, number>();
      for (const r of list) for (const x of r.reasons) tally.set(x, (tally.get(x) ?? 0) + 1);
      const s = list.reduce((a, r) => a + (r.score ?? 0), 0);
      const pos = list.filter((r) => (r.score ?? 0) >= RATING_POSITIVE_FROM).length;
      const who = list.find((r) => r.agent)?.agent;
      return {
        agentId,
        name: agentId ? who?.name ?? who?.email ?? "Unknown" : "Unattributed",
        rated: list.length,
        avg: list.length ? s / list.length : 0,
        positivePct: list.length ? (pos / list.length) * 100 : 0,
        topReasons: [...tally.entries()]
          .map(([reason, n]) => ({ reason, n }))
          .sort((a, b) => b.n - a.n)
          .slice(0, 3),
        thin: list.length < MIN_SAMPLE,
      };
    })
    // العددُ قبل المتوسّط في الترتيب: الترتيبُ بالمتوسّط وحده بيحطّ اللي
    // اتقيّم مرّةً واحدة فوق اللي اتقيّم خمسين - وهو تصنيفٌ كاذب.
    .sort((a, b) => (a.thin === b.thin ? b.avg - a.avg : a.thin ? 1 : -1));

  return {
    asked,
    rated,
    dismissed,
    responsePct: asked ? (rated / asked) * 100 : 0,
    avg: rated ? sum / rated : null,
    positivePct: rated ? (positive / rated) * 100 : null,
    distribution,
    reasons: [...reasonTally.entries()]
      .map(([reason, n]) => ({ reason, n }))
      .sort((a, b) => b.n - a.n),
    agents,
    comments: rows
      .filter((r) => (r.comment ?? "").trim().length > 0)
      .slice(0, 30)
      .map((r) => ({
        id: r.id,
        threadId: r.threadId,
        score: r.score,
        comment: r.comment!.trim(),
        agentName: r.agent?.name ?? r.agent?.email ?? "Unattributed",
        customer: r.thread.name || r.thread.email,
        createdAt: r.createdAt,
      })),
  };
}
