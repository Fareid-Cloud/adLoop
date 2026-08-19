// lib/admin/operational.ts
//
// الجانب التشغيليّ: تذاكر الدعم، مشاكل العملاء، وزمن الحلّ.
//
// "مشكلة عميل" هنا ليها مصدرين حقيقيين مختلفين، ومابنخلطهمش:
//   • **تذكرة دعم** - العميل كتب بنفسه. عدد صغير، إشارة قوية.
//   • **بند تنبيه معلّق** (`ActionFeedItem` بخطورة عالية) - النظام رصد
//     خللاً في حساب العميل والعميل ممكن يكون مالحظوش أصلاً. عدد كبير،
//     إشارة استباقية.
// جمعهم في رقم واحد كان هيخفي الاتنين.

import { prisma } from "@/lib/prisma";
import { supportCategoryLabel } from "@/lib/supportCategories";
import { atRiskThreshold } from "./customers";
import type { DateRange } from "./shared";

export interface OperationalAnalytics {
  tickets: { open: number; answered: number; closed: number; newInRange: number };
  /** أكتر موضوعات الدعم تكراراً - من `SupportThread.category` */
  byCategory: Array<{ key: string; label: string; count: number }>;
  uncategorised: number;
  /** متوسّط ووسيط زمن الحلّ بالساعات - `null` لو مافيش محادثة مقفولة بعد */
  resolution: { averageHours: number | null; medianHours: number | null; sample: number };
  feedbackByCategory: Array<{ category: string; count: number }>;
  workspaceIssues: { pending: number; urgent: number; topWorkspaces: Array<{ workspaceId: string; name: string; ownerEmail: string; count: number }> };
  atRiskAccounts: number;
  incidents: Array<{ runAt: Date; failed: number; total: number; errors: string | null }>;
}

export async function getOperationalAnalytics(range: DateRange): Promise<OperationalAnalytics> {
  const [
    open, answered, closed, newInRange,
    categoryGroups, uncategorised, closedThreads,
    feedbackGroups, pendingIssues, urgentIssues, issueGroups,
    atRiskAccounts, failedRuns,
  ] = await Promise.all([
    prisma.supportThread.count({ where: { status: "OPEN" } }),
    prisma.supportThread.count({ where: { status: "ANSWERED" } }),
    prisma.supportThread.count({ where: { status: "CLOSED" } }),
    prisma.supportThread.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
    prisma.supportThread.groupBy({
      by: ["category"],
      where: { category: { not: null } },
      _count: true,
      orderBy: { _count: { category: "desc" } },
    }),
    prisma.supportThread.count({ where: { category: null } }),
    prisma.supportThread.findMany({
      where: { closedAt: { not: null } },
      select: { createdAt: true, closedAt: true },
      orderBy: { closedAt: "desc" },
      take: 200,
    }),
    prisma.feedback.groupBy({ by: ["category"], _count: true }),
    prisma.actionFeedItem.count({ where: { status: "PENDING" } }),
    prisma.actionFeedItem.count({ where: { status: "PENDING", severity: { in: ["URGENT", "HIGH"] } } }),
    prisma.actionFeedItem.groupBy({
      by: ["workspaceId"],
      where: { status: "PENDING", severity: { in: ["URGENT", "HIGH"] } },
      _count: true,
      orderBy: { _count: { workspaceId: "desc" } },
      take: 10,
    }),
    prisma.user.count({ where: { OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: atRiskThreshold() } }] } }),
    prisma.cronRunLog.findMany({
      where: { failed: { gt: 0 } },
      orderBy: { runAt: "desc" },
      take: 15,
      select: { runAt: true, failed: true, totalWorkspaces: true, errors: true },
    }),
  ]);

  const hours = closedThreads
    .filter((t) => t.closedAt)
    .map((t) => (t.closedAt!.getTime() - t.createdAt.getTime()) / 3_600_000)
    .filter((h) => h >= 0)
    .sort((a, z) => a - z);

  const median = hours.length > 0
    ? hours.length % 2 === 1
      ? hours[(hours.length - 1) / 2]
      : (hours[hours.length / 2 - 1] + hours[hours.length / 2]) / 2
    : null;

  const wsIds = issueGroups.map((g) => g.workspaceId);
  const wsRows = wsIds.length
    ? await prisma.workspace.findMany({
        where: { id: { in: wsIds } },
        select: { id: true, name: true, user: { select: { email: true } } },
      })
    : [];
  const wsById = new Map(wsRows.map((w) => [w.id, w]));

  return {
    tickets: { open, answered, closed, newInRange },
    byCategory: categoryGroups.map((g) => ({
      key: g.category!,
      label: supportCategoryLabel(g.category),
      count: g._count,
    })),
    uncategorised,
    resolution: {
      averageHours: hours.length > 0 ? hours.reduce((s, h) => s + h, 0) / hours.length : null,
      medianHours: median,
      sample: hours.length,
    },
    feedbackByCategory: feedbackGroups.map((g) => ({ category: g.category ?? "unspecified", count: g._count })),
    workspaceIssues: {
      pending: pendingIssues,
      urgent: urgentIssues,
      topWorkspaces: issueGroups.map((g) => ({
        workspaceId: g.workspaceId,
        name: wsById.get(g.workspaceId)?.name ?? "—",
        ownerEmail: wsById.get(g.workspaceId)?.user.email ?? "—",
        count: g._count,
      })),
    },
    atRiskAccounts,
    incidents: failedRuns.map((r) => ({
      runAt: r.runAt, failed: r.failed, total: r.totalWorkspaces, errors: r.errors,
    })),
  };
}
