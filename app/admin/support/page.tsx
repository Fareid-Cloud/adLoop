// app/admin/support/page.tsx - صندوق الدعم الموحَّد
//
// (الوصول محمي عبر app/admin/layout.tsx وقفل اللوحة)
//
// **الحالة في الرابط لا في المكوّن.** الفلترُ والمحادثةُ المفتوحة في
// `searchParams`، فالصفحة تتقسم للينك يُبعَت ويُفتَح على نفس المكان،
// والرجوعُ بزرار المتصفّح بيرجّع الفلتر. ولمّا كانت في الحالة، كلّ فتحةٍ
// كانت بتبدأ من أوّل القائمة.

import { LifeBuoy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  listThreads, channelCounts, isChannel, inboxWhere, type InboxFilters,
} from "@/lib/inbox";
import { AdminPageHeader } from "../components/AdminUI";
import { InboxClient } from "./InboxClient";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  const filters: InboxFilters = {
    channel: isChannel(sp.channel) ? sp.channel : "ALL",
    status:
      sp.status === "OPEN" || sp.status === "ANSWERED" || sp.status === "CLOSED"
        ? sp.status
        : "ALL",
    unread: sp.unread === "1",
    assignedToId: sp.assigned || undefined,
    tag: sp.tag || undefined,
    q: sp.q || undefined,
  };

  const [threads, counts, agents, allTags] = await Promise.all([
    listThreads(filters),
    channelCounts(filters),
    // اللي ينفع يتعيّن له: حسابات إدارية بس - تعيينُ محادثة لعميل بيخفيها
    // من كلّ فلتر بيتفرّج عليه الفريق فتضيع بصمت.
    prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true, name: true, email: true, lastActiveAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.supportThread.findMany({
      where: { deletedAt: null, tags: { isEmpty: false } },
      select: { tags: true },
      take: 500,
    }),
  ]);

  // المحادثةُ المفتوحة تُجلب على حدة لا من القائمة: القائمة مقصوصة على
  // ستّين، ورابطٌ لمحادثةٍ أقدم منها كان بيفتح على فراغ.
  const openId = sp.thread;
  const active = openId
    ? await prisma.supportThread.findUnique({
        where: { id: openId },
        select: {
          id: true, channel: true, name: true, email: true, phone: true, country: true,
          subject: true, status: true, pinned: true, tags: true, assignedToId: true,
          userId: true, createdAt: true, lastMessageAt: true, category: true,
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true, fromSupport: true, body: true, imageUrls: true, createdAt: true,
            },
          },
          // الملاحظات الداخلية - عمودُ التفاصيل بيعرضها تحت بيانات المرسل.
          notes: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true, body: true, createdAt: true,
              author: { select: { name: true, email: true } },
            },
          },
        },
      })
    : null;

  // تاريخُ العميل: محادثاتُه السابقة. بتظهر في اللوحة الجانبية فالدعم
  // بيعرف إنّه بيكلّم حدّ اشتكى تلات مرّات قبل كده - وده بيغيّر الردّ.
  const history =
    active?.userId || active?.email
      ? await prisma.supportThread.findMany({
          where: {
            id: { not: active.id },
            deletedAt: null,
            OR: [
              ...(active.userId ? [{ userId: active.userId }] : []),
              ...(active.email ? [{ email: active.email }] : []),
            ],
          },
          orderBy: { lastMessageAt: "desc" },
          take: 8,
          select: { id: true, subject: true, status: true, channel: true, lastMessageAt: true },
        })
      : [];

  // صورةُ صاحب المحادثة المفتوحة - نفس سبب الاستعلام المنفصل في القائمة:
  // `SupportThread` مالهاش علاقةٌ بـ`User`.
  const activeAvatar = active?.userId
    ? (await prisma.user.findUnique({ where: { id: active.userId }, select: { avatarUrl: true } }))?.avatarUrl ?? null
    : null;

  const tags = [...new Set(allTags.flatMap((t) => t.tags))].sort();
  const unreadCount = threads.filter((t) => t.unread).length;

  // عدّادُ كلّ حالة - بيتعرض جنب اسمها في العمود الأوّل فيُعرَف أين الشغل
  // قبل الفتح. بيتحسب على الفلاتر الحالية عدا الحالة نفسها، وإلّا كلُّ
  // عدّادٍ بيبقى صفراً إلا المختار.
  const statusRows = await prisma.supportThread.groupBy({
    by: ["status"],
    where: inboxWhere({ ...filters, status: "ALL" }),
    _count: true,
  });
  const statusCounts: Record<string, number> = {};
  for (const r of statusRows) statusCounts[r.status] = r._count;

  const ONLINE_MS = 5 * 60_000;
  const agentRows = agents.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    online: !!a.lastActiveAt && Date.now() - a.lastActiveAt.getTime() < ONLINE_MS,
  }));

  return (
    <div>
      <AdminPageHeader
        title="Inbox"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread in this view`
            : "Every channel in one place — website, WhatsApp and Messenger"
        }
        icon={LifeBuoy}
      />
      <InboxClient
        threads={JSON.parse(JSON.stringify(threads))}
        active={active ? JSON.parse(JSON.stringify(active)) : null}
        history={JSON.parse(JSON.stringify(history))}
        activeAvatar={activeAvatar}
        counts={counts}
        statusCounts={statusCounts}
        agents={agentRows}
        tags={tags}
        filters={{
          channel: filters.channel ?? "ALL",
          status: filters.status ?? "ALL",
          unread: !!filters.unread,
          assigned: sp.assigned ?? "",
          tag: sp.tag ?? "",
          q: sp.q ?? "",
        }}
      />
    </div>
  );
}
