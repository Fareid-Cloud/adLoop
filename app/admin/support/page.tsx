// app/admin/support/page.tsx - صندوق الدعم الموحَّد
//
// (الوصول محمي عبر app/admin/layout.tsx وقفل اللوحة)
//
// **الحالة في الرابط لا في المكوّن.** الفلترُ والمحادثةُ المفتوحة في
// `searchParams`، فالصفحة تتقسم للينك يُبعَت ويُفتَح على نفس المكان،
// والرجوعُ بزرار المتصفّح بيرجّع الفلتر. ولمّا كانت في الحالة، كلّ فتحةٍ
// كانت بتبدأ من أوّل القائمة.

import Link from "next/link";
import { LifeBuoy, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  listThreads, channelCounts, statusCounts, assigneeCounts,
  isChannel, isThreadStatus, type InboxFilters,
} from "@/lib/inbox";
import { getSessionUserFromCookies } from "@/lib/auth";
import { isOwnerRole } from "@/lib/adminRole";
import { STAFF_WHERE } from "@/lib/adminStaff";
import { AdminPageHeader } from "../components/AdminUI";
import { InboxClient } from "./InboxClient";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  // الحذفُ النهائيّ للمالك وحده - الدعمُ بيأرشف وبس.
  const viewer = await getSessionUserFromCookies();
  const canDelete = isOwnerRole(viewer);

  // 🔴 **الأرشيف كان بيتفلتر لـ«الكلّ».**
  //
  // القراءةُ القديمة كانت بتقبل تلات حالات بالاسم وترمي أيَّ حاجة غيرها
  // على `ALL`، و`ARCHIVED` مكنش منهم - فدوسةُ «Archive» كانت بتطلب الأرشيف
  // وتتحوّل لـ«الكلّ»، و«الكلّ» بيستثني الأرشيف. الفلترُ الوحيد اللي كان
  // بيرجّع **عكسَ** المطلوب بالظبط، وبلا رسالةِ خطأ تدلّ عليه.
  const list = (raw: string | undefined) =>
    (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const filters: InboxFilters = {
    channel: list(sp.channel).filter(isChannel),
    status: list(sp.status).filter(isThreadStatus),
    unread: sp.unread === "1",
    assignedToId: list(sp.assigned),
    tag: list(sp.tag),
    q: sp.q || undefined,
  };

  const [threads, counts, statuses, assignees, agents, allTags] = await Promise.all([
    listThreads(filters),
    channelCounts(filters),
    statusCounts(filters),
    assigneeCounts(filters),
    // اللي ينفع يتعيّن له: حسابات إدارية بس - تعيينُ محادثة لعميل بيخفيها
    // من كلّ فلتر بيتفرّج عليه الفريق فتضيع بصمت.
    prisma.user.findMany({
      where: STAFF_WHERE,
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
        actions={
          <Link
            href="/admin/support/quality"
            className="flex items-center gap-1.5 rounded-lg border border-border-visible px-2.5 py-1.5 text-[12.5px] text-text-muted no-underline transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            <Star size={14} /> Service quality
          </Link>
        }
      />
      <InboxClient
        threads={JSON.parse(JSON.stringify(threads))}
        active={active ? JSON.parse(JSON.stringify(active)) : null}
        history={JSON.parse(JSON.stringify(history))}
        activeAvatar={activeAvatar}
        canDelete={canDelete}
        counts={counts}
        statusCounts={statuses}
        assigneeCounts={assignees}
        agents={agentRows}
        tags={tags}
        filters={{
          channel: filters.channel ?? [],
          status: filters.status ?? [],
          unread: !!filters.unread,
          assigned: filters.assignedToId ?? [],
          tag: filters.tag ?? [],
          q: sp.q ?? "",
        }}
      />
    </div>
  );
}
