// lib/inbox.ts
//
// **صندوقٌ واحد، وقنواتٌ تدخل فيه - لا ثلاثة صناديق.**
//
// الرسالةُ من واتساب ومن ماسنجر ومن شات الموقع نفسُ الشيء: حدٌّ بيسأل
// وحدٌّ بيردّ. وفصلُها في مسارات منفصلة معناه إنّ كلّ ميزةٍ في الصندوق
// (تعيين، وسم، بحث، إغلاق، مقروء) تتبني تلات مرّات وتفترق تلات مرّات -
// وإنّ العميل اللي كلّمك على واتساب امبارح وعلى الموقع النهاردة يبقى
// شخصين بلا تاريخٍ مشترك.
//
// الملفّ ده هو نقطةُ الدخول الوحيدة: أيّ قناةٍ جديدة بتنادي
// `ingestInboundMessage` وبتاخد الصندوق كلّه مجّاناً.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { sendPushToUser } from "@/lib/webPush";
import { STAFF_WHERE } from "@/lib/adminStaff";

// الثابتاتُ في ملفٍّ بلا استيراد (`lib/inboxChannels.ts`) وتُعاد التصدير
// من هنا: الملفّ ده بيجرّ `web-push` ومعاه مكتباتِ Node، فاستيرادُ كلاينت
// كومبوننت منه بيكسر البناء. المستهلكُ الخادميّ بياخدها من هنا، والكلاينت
// من هناك، والتعريفُ واحد في الحالتين.
export { CHANNELS, CHANNEL_LABEL, isChannel, type Channel } from "@/lib/inboxChannels";
import { CHANNEL_LABEL, type Channel } from "@/lib/inboxChannels";

// ══════════════════════════════════════════════════════════════════════
// الوارد
// ══════════════════════════════════════════════════════════════════════

export interface InboundMessage {
  channel: Channel;
  /** معرّفُ المحادثة عند المنصّة - رقمُ الواتساب أو PSID */
  externalThreadId: string;
  /** معرّفُ الرسالة عند المنصّة - حارسُ التكرار */
  externalMessageId?: string | null;
  body: string;
  imageUrls?: string[];
  /** اسمُ المرسل كما تعطيه المنصّة - أفضلُ ما عندنا قبل ما يعرّف نفسه */
  senderName?: string | null;
  phone?: string | null;
  email?: string | null;
  receivedAt?: Date;
}

/**
 * تسجيلُ رسالةٍ واردة من أيّ قناة.
 *
 * **الذرّية مقصودة:** إنشاءُ المحادثة وكتابةُ الرسالة وتحديثُ وقتِ آخر
 * رسالة في معاملةٍ واحدة. تسليمان متزامنان لنفس المحادثة (وميتا بتعيد
 * الإرسال لو ماردّيناش بسرعة) كانا هيقروا الاتنين "مافيش محادثة"
 * فيفتحوا اتنين لنفس الشخص.
 *
 * ويرجع `null` لو الرسالة اتسجّلت قبل كده - فالمنادي يعرف إنّه مايبعتش
 * إشعاراً تاني لنفس الرسالة.
 */
export async function ingestInboundMessage(
  msg: InboundMessage
): Promise<{ threadId: string; messageId: string } | null> {
  const receivedAt = msg.receivedAt ?? new Date();

  // فحصُ التكرار قبل المعاملة: أرخصُ من فتحِ معاملةٍ ترجع فاضية، والحالة
  // دي متكرّرة فعلاً لا نادرة.
  if (msg.externalMessageId) {
    const seen = await prisma.supportMessage.findUnique({
      where: { externalId: msg.externalMessageId },
      select: { id: true },
    });
    if (seen) return null;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const thread = await tx.supportThread.upsert({
        where: {
          channel_externalId: { channel: msg.channel, externalId: msg.externalThreadId },
        },
        create: {
          channel: msg.channel,
          externalId: msg.externalThreadId,
          // الاسمُ والبريد أفضلُ ما تعطيه المنصّة، وممكن يبقى ناقصاً:
          // واتساب بيدّي اسمَ الملفّ الشخصيّ وبس، وماسنجر بيدّي PSID.
          name: msg.senderName?.trim() || msg.phone || "Unknown",
          email: msg.email ?? "",
          phone: msg.phone ?? null,
          // موضوعٌ من أوّل رسالة: القنواتُ دي مالهاش حقلُ موضوع أصلاً،
          // وتركُه فاضياً بيدّي صفوفاً بلا عنوان في القائمة.
          subject: msg.body.slice(0, 80) || CHANNEL_LABEL[msg.channel],
          lastMessageAt: receivedAt,
        },
        update: {
          lastMessageAt: receivedAt,
          // ردٌّ جديد بيرجّع المحادثة للحياة: مقفولة + رسالة جديدة =
          // مفتوحة، وإلا بتتدفن في فلتر "مقفول" ومحدّش يشوفها.
          status: "OPEN",
          closedAt: null,
          deletedAt: null,
        },
        select: { id: true },
      });

      const message = await tx.supportMessage.create({
        data: {
          threadId: thread.id,
          fromSupport: false,
          body: msg.body,
          imageUrls: msg.imageUrls ?? [],
          externalId: msg.externalMessageId ?? null,
          createdAt: receivedAt,
        },
        select: { id: true },
      });

      return { threadId: thread.id, messageId: message.id };
    });
  } catch (err) {
    // سباقٌ على المفتاح الفريد: تسليمان وصلا معاً وسبقنا واحد. النتيجة
    // صحيحة (الرسالة اتكتبت مرّة)، فمش خطأ يترمى.
    if ((err as { code?: string }).code === "P2002") return null;
    throw err;
  }
}

/**
 * إشعارُ الفريق برسالةٍ واردة - **زيّ ماسنجر وواتساب بالظبط.**
 *
 * صندوقٌ لازم حدّ يفتحه عشان يعرف إنّ فيه رسالة مش صندوق، هو صفحةٌ بيتفقّدها.
 * وأغلى شيء في الدعم هو وقتُ الردّ الأوّل، وهو بالظبط اللي بيضيع بين وصولِ
 * الرسالة واكتشافِها.
 *
 * **بيتبعت للمعيَّن وحده لو فيه معيَّن**، ولكلّ الأدمنز لو مافيش: تنبيهُ
 * الجميع على محادثةٍ لها صاحب بيخلّي الإشعارات ضجيجاً، وأوّل ما تبقى
 * ضجيجاً بتتقفل - وساعتها بتضيع المهمّة كمان.
 */
export async function notifyTeamOfInbound(threadId: string) {
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: {
      name: true, channel: true, assignedToId: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
    },
  });
  if (!thread) return;

  const recipients = thread.assignedToId
    ? [thread.assignedToId]
    : (
        await prisma.user.findMany({ where: STAFF_WHERE, select: { id: true } })
      ).map((u) => u.id);

  const payload = {
    title: `${thread.name} · ${CHANNEL_LABEL[thread.channel as Channel] ?? thread.channel}`,
    body: thread.messages[0]?.body.slice(0, 140) ?? "New message",
    url: `/admin/support?thread=${threadId}`,
  };

  // بالتوازي وبابتلاعٍ فرديّ: اشتراكٌ منتهي لواحد مايمنعش الباقي.
  await Promise.all(recipients.map((id) => sendPushToUser(id, payload).catch(() => {})));
}

// ══════════════════════════════════════════════════════════════════════
// القراءة
// ══════════════════════════════════════════════════════════════════════

export const THREAD_STATUSES = ["OPEN", "ANSWERED", "CLOSED", "ARCHIVED"] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];
export function isThreadStatus(v: unknown): v is ThreadStatus {
  return typeof v === "string" && (THREAD_STATUSES as readonly string[]).includes(v);
}

/** المعيَّنُ له: معرَّفُ موظَّف، أو `UNASSIGNED` للمحادثات بلا صاحب. */
export const UNASSIGNED = "UNASSIGNED";

// 🔴 **كلُّ بُعدٍ قائمةٌ لا قيمةٌ واحدة.**
//
// كان كلُّ فلترٍ قيمةً مفردة، فاختيارُ «ماسنجر» بيلغي «الموقع» - والسؤال
// الطبيعيّ («وَرّيني الاتنين وسيب واتساب») مالوش تعبير. القوائمُ الفاضية
// معناها «بلا قيد» لا «مافيش حاجة»، فغيابُ الفلتر هو الوضعُ الافتراضيّ
// من غير قيمةٍ سحرية زيّ `ALL` لازم تتفحص في كلّ مكان تُقرأ فيه.
export interface InboxFilters {
  channel?: Channel[];
  status?: ThreadStatus[];
  /** غير المقروء فقط */
  unread?: boolean;
  assignedToId?: string[];
  tag?: string[];
  q?: string;
  /** للعدّادات وحدها: بيرفع استثناءَ الأرشيف عشان صفُّه يعرض رقمَه الحقيقيّ. */
  includeArchived?: boolean;
}

export function inboxWhere(f: InboxFilters): Prisma.SupportThreadWhereInput {
  const where: Prisma.SupportThreadWhereInput = { deletedAt: null };
  // شروطٌ مركَّبة بتتجمّع هنا لا في `where.OR` مباشرةً: أكتر من بُعدٍ
  // بيحتاج `OR` داخليّ (المعيَّنُ له، وغيرُ المقروء)، وكتابتُهم على نفس
  // المفتاح بتخلّي التاني **يمسح** الأوّل بصمت.
  const and: Prisma.SupportThreadWhereInput[] = [];

  if (f.channel?.length) where.channel = { in: f.channel };

  if (f.status?.length) where.status = { in: f.status };
  // المؤرشَفُ بيختفي من كلّ عرضٍ إلّا لمّا يُطلَب صراحةً: الأرشيفُ مكانٌ
  // بتتحطّ فيه المحادثة عشان **تسيب** الصندوق، فظهورُها في «الكلّ» بيلغي
  // الغرض منه.
  else if (!f.includeArchived) where.status = { not: "ARCHIVED" };

  if (f.tag?.length) where.tags = { hasSome: f.tag };

  if (f.assignedToId?.length) {
    const ids = f.assignedToId.filter((v) => v !== UNASSIGNED);
    const or: Prisma.SupportThreadWhereInput[] = [];
    if (f.assignedToId.includes(UNASSIGNED)) or.push({ assignedToId: null });
    if (ids.length) or.push({ assignedToId: { in: ids } });
    if (or.length) and.push({ OR: or });
  }

  // 🔴 **غير المقروء = وصلت رسالة بعد آخر فتحة.** التعريف ده بيخلّي
  // الحالة مشتقّة من حقيقتين موجودتين، بدل عدّادٍ منفصل لازم يتظبّط في
  // كلّ مسار كتابة - وأوّل مسار يُنسى بيخلّي الرقم يكدب للأبد.
  if (f.unread) {
    and.push({
      OR: [
        { readByAdminAt: null },
        { readByAdminAt: { lt: prisma.supportThread.fields.lastMessageAt } },
      ],
    });
  }

  if (f.q?.trim()) {
    const q = f.q.trim();
    // البحثُ في النصّ نفسه لا في العناوين وحدها: العميل بيدوّر على كلمةٍ
    // قالها، والموضوع عندنا مقصوصٌ من أوّل رسالة.
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { messages: { some: { body: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
}

/** ترتيبُ الصندوق: المثبَّت أوّلاً، ثمّ الأحدث رسالةً. */
export const INBOX_ORDER: Prisma.SupportThreadOrderByWithRelationInput[] = [
  { pinned: "desc" },
  { lastMessageAt: "desc" },
];

export interface ThreadRow {
  id: string;
  channel: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  status: string;
  pinned: boolean;
  unread: boolean;
  tags: string[];
  assignedToId: string | null;
  assignedToName: string | null;
  lastMessageAt: Date;
  messageCount: number;
  /** رسائلُ العميل اللي وصلت بعد آخر فتحة - **العدّاد اللي بيتعرض**. */
  unreadCount: number;
  preview: string;
  /** صورةُ الحساب الحقيقيّة لو المرسل مشترك مسجَّل. */
  avatarUrl: string | null;
}

export async function listThreads(filters: InboxFilters, take = 60): Promise<ThreadRow[]> {
  const rows = await prisma.supportThread.findMany({
    where: inboxWhere(filters),
    orderBy: INBOX_ORDER,
    take,
    select: {
      id: true, userId: true, channel: true, name: true, email: true, phone: true, subject: true,
      status: true, pinned: true, tags: true, assignedToId: true,
      lastMessageAt: true, readByAdminAt: true,
      assignedTo: { select: { name: true, email: true } },
      _count: { select: { messages: true } },
      // آخرُ رسالة للمعاينة - القائمةُ بلا معاينة بتخلّي كلّ صفّ يتفتح
      // عشان يُعرَف محتواه.
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true },
      },
    },
  });

  // 🔴 **عدّادُ غير المقروء = رسائلُ العميل بعد آخر فتحة.**
  //
  // كان بيتعرض `_count.messages` (كلُّ الرسائل)، فمحادثةٌ فيها رسالةٌ
  // جديدة واحدة بتقول «١٢» - رقمٌ بيتقري كضغطٍ مش موجود فيبطّل يتقري.
  //
  // ومابيتحسبش في نفس الاستعلام لأنّ الشرط مقارنةٌ بعمودٍ في **صفّ
  // المحادثة نفسه** (`readByAdminAt`)، وPrisma مابيعبّرش عنها في `_count`.
  // فاستعلامٌ واحد إضافي لكلّ الصفحة (محدودةٌ بستّين محادثة)، والعدُّ في
  // الذاكرة - أرخص من استعلامٍ لكلّ صفّ بكتير.
  // صورُ الحسابات: `SupportThread` مالهاش علاقةٌ بـ`User` (بس `userId`
  // كعمود، لأنّ المحادثة ممكن تيجي من واتساب بلا حساب أصلاً)، فبتتجاب
  // على حدة. واستعلامٌ واحد لكلّ الصفحة لا لكلّ صفّ.
  const avatarByUser = new Map<string, string | null>();
  const userIds = [...new Set(rows.map((r) => r.userId).filter((v): v is string => !!v))];
  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, avatarUrl: true },
    });
    for (const u of users) avatarByUser.set(u.id, u.avatarUrl);
  }

  const unreadByThread = new Map<string, number>();
  if (rows.length > 0) {
    const inbound = await prisma.supportMessage.findMany({
      where: { threadId: { in: rows.map((r) => r.id) }, fromSupport: false },
      select: { threadId: true, createdAt: true },
    });
    const seenAt = new Map(rows.map((r) => [r.id, r.readByAdminAt]));
    for (const m of inbound) {
      const readAt = seenAt.get(m.threadId);
      if (!readAt || m.createdAt > readAt) {
        unreadByThread.set(m.threadId, (unreadByThread.get(m.threadId) ?? 0) + 1);
      }
    }
  }

  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    name: r.name,
    email: r.email,
    phone: r.phone,
    subject: r.subject,
    status: r.status,
    pinned: r.pinned,
    unread: !r.readByAdminAt || r.readByAdminAt < r.lastMessageAt,
    tags: r.tags,
    assignedToId: r.assignedToId,
    assignedToName: r.assignedTo?.name ?? r.assignedTo?.email ?? null,
    lastMessageAt: r.lastMessageAt,
    messageCount: r._count.messages,
    unreadCount: unreadByThread.get(r.id) ?? 0,
    avatarUrl: (r.userId && avatarByUser.get(r.userId)) || null,
    preview: r.messages[0]?.body.replace(/\s+/g, " ").slice(0, 120) ?? "",
  }));
}

// عدّاداتُ الفلاتر. كلُّ واحدٍ منها بيتحسب على باقي الفلاتر **عدا بُعده
// هو** - وإلّا كلُّ رقمٍ بيبقى صفراً إلّا المختار، فالعدّادُ بيبطّل يقول
// «فيه شغلٌ هنا» ويبقى صدىً للاختيار الحاليّ.

/** عدّادُ كلّ قناة - يُعرض جنب اسمها فيُعرَف أين الشغل قبل الفتح. */
export async function channelCounts(base: InboxFilters) {
  const rows = await prisma.supportThread.groupBy({
    by: ["channel"],
    where: inboxWhere({ ...base, channel: [] }),
    _count: true,
  });
  const map: Record<string, number> = {};
  for (const r of rows) map[r.channel] = r._count;
  return map;
}

/** 🔴 عدّادُ كلّ حالة - **بالأرشيف**.
 *
 *  كان بيتحسب باستثناء الأرشيف المفروض على كلّ استعلام، فصفُّ «Archive»
 *  كان بيقول صفر مهما كان جوّاه - وده اللي خلّى الأرشيف يبان معطَّلاً. */
export async function statusCounts(base: InboxFilters) {
  const rows = await prisma.supportThread.groupBy({
    by: ["status"],
    where: inboxWhere({ ...base, status: [], includeArchived: true }),
    _count: true,
  });
  const map: Record<string, number> = {};
  for (const r of rows) map[r.status] = r._count;
  return map;
}

/** عدّادُ كلّ موظَّف + غير المعيَّن، عشان اختيارُ «مسنَد لـ» يبان قبل فتحه. */
export async function assigneeCounts(base: InboxFilters) {
  const rows = await prisma.supportThread.groupBy({
    by: ["assignedToId"],
    where: inboxWhere({ ...base, assignedToId: [] }),
    _count: true,
  });
  const map: Record<string, number> = {};
  for (const r of rows) map[r.assignedToId ?? UNASSIGNED] = r._count;
  return map;
}
