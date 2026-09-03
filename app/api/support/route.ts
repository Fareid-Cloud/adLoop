// app/api/support/route.ts
//
// GET: يجيب محادثة الدعم الحالية للمستخدم + الرسائل + عدد ردود الدعم غير المقروءة.
// POST: يفتح محادثة جديدة (لو فيها subject) أو يضيف رسالة متابعة (لو فيها threadId).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { notifyOwnerNewSupport } from "@/lib/supportEmail";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";
import { shouldAskForRating } from "@/lib/supportRating";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // **محادثةٌ واحدة للعميل** - والجلساتُ تُفصَل داخلها بفاصلٍ لا بصفٍّ
  // جديد. عميلٌ واحد بمحادثاتٍ متعدّدة معناه إنّ تاريخَه متفرّق، وإنّ
  // الدعم بيفتح واحدة ومايشوفش اللي قبلها.
  const thread = await prisma.supportThread.findFirst({
    where: { userId: user.id, deletedAt: null },
    orderBy: { lastMessageAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!thread) return NextResponse.json({ thread: null });

  const unread = thread.messages.filter((m) => m.fromSupport && !m.readByUser).length;

  // التقييم: القرارُ في السيرفر لا في الودجت. القاعدةُ فيها وقتٌ وحالة،
  // وحسابُها في المتصفّح معناه إنّ ساعةَ الجهاز بتحكم متى نسأل.
  const ratings = await prisma.supportRating.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "desc" },
  });
  const last = thread.messages[thread.messages.length - 1] ?? null;
  const { ask, triggerMessageId } = shouldAskForRating({
    status: thread.status,
    last: last ? { id: last.id, fromSupport: last.fromSupport, createdAt: last.createdAt } : null,
    answeredTriggerIds: ratings
      .filter((r) => r.score !== null || r.dismissedAt !== null)
      .map((r) => r.triggerMessageId),
  });

  // الصفُّ الحاليّ بيترجع كمان لو موجود: العميلُ ممكن يكون دَي درجةً
  // ولسه ما كتبش سبباً، فالكارت بيفتح على اللي هو سايبه لا من أوّله.
  const current = triggerMessageId
    ? ratings.find((r) => r.triggerMessageId === triggerMessageId) ?? null
    : null;

  return NextResponse.json({
    thread,
    unread,
    rating: {
      ask,
      triggerMessageId: triggerMessageId ?? null,
      score: current?.score ?? null,
      reasons: current?.reasons ?? [],
      comment: current?.comment ?? "",
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const body = await req.json();
  // نفس حارس مسار الأدمن: مسارُنا المصادَق عليه وحده. قبولُ رابطٍ خارجيّ
  // معناه إنّ حدّاً يقدر يخلّي المنتج يعرض صورةً من سيرفره في محادثة.
  const ATTACHMENT = /^\/api\/support\/attachment\/[\w./-]+$/;
  const imageUrls: string[] = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u: unknown) => typeof u === "string" && ATTACHMENT.test(u)).slice(0, 6)
    : [];

  // متابعة على محادثة قائمة
  if (body.threadId) {
    const thread = await prisma.supportThread.findFirst({ where: { id: body.threadId, userId: user.id } });
    if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });
    // صورةٌ بلا نصّ رسالةٌ كاملة - أكترُ شكلٍ بيتبعت في الدعم التقنيّ.
    if (!body.text?.trim() && imageUrls.length === 0) {
      return NextResponse.json({ error: t(locale, "apiErr.messageEmpty") }, { status: 400 });
    }

    const msg = await prisma.supportMessage.create({
      data: { threadId: thread.id, fromSupport: false, body: (body.text ?? "").trim(), imageUrls, readByUser: true },
    });
    // 🔴 `lastMessageAt` مش `updatedAt`: الصندوق بيرتّب بالأوّل، وبدونه
    // رسالةُ العميل الجديدة ماكانتش بتطلّع محادثته فوق القائمة إطلاقاً -
    // فالدعم بيشوف الجديد في مكانه القديم أو مايشوفهوش.
    await prisma.supportThread.update({
      where: { id: thread.id },
      data: { status: "OPEN", lastMessageAt: msg.createdAt, readByAdminAt: null },
    });
    void notifyOwnerNewSupport({
      name: thread.name, email: thread.email, phone: thread.phone, country: thread.country,
      subject: thread.subject, body: body.text.trim(), isReply: true,
    });
    return NextResponse.json({ message: msg }, { status: 201 });
  }

  // فتح محادثة جديدة
  //
  // 🔴 **الاسم والبريد من الجلسة لا من الطلب.** كانا مطلوبين في الحمولة،
  // والمستخدم **مسجَّلٌ دخوله بالفعل** - فكان المنتج بيسأله عن اسمه
  // وبريده وهو عارفهما، وأيّ واجهة مابتبعتهمش بتترفض بـ٤٠٠ مبهمة. وده
  // اللي كان بيكسر ودجت الدعم: بيبعت الرسالة وبس، فالمسار يرفض.
  //
  // وقبولُهما من الطلب كان أسوأ من إزعاج: حدٌّ يقدر يفتح تذكرة باسم
  // وبريد **غيره** وهي متربطة بحسابه هو، فسجلّ الدعم يكدب.
  const { phone, country, subject, text } = body;
  if (!text?.trim()) {
    return NextResponse.json({ error: t(locale, "apiErr.messageEmpty") }, { status: 400 });
  }

  const name = user.name?.trim() || user.email.split("@")[0];
  const email = user.email;
  // موضوعٌ من أوّل سطر حين لا يُرسَل: صفٌّ بلا عنوان في الصندوق بيتقري
  // كمحادثةٍ فاضية.
  const finalSubject = subject?.trim() || text.trim().slice(0, 80);

  const now = new Date();

  // 🔴 **رسالةٌ جديدة بتكمّل محادثته، مابتفتحش واحدة تانية.**
  //
  // كانت كلُّ رسالةٍ بتعمل صفّاً جديداً - فالعميل بيشوف الأخيرة بس
  // ويحسّ إنّ القديمة اتمسحت، والدعم بيلاقي نفس الشخص متكرّراً في
  // الصندوق بلا تاريخٍ مشترك. الجلساتُ تُفصَل بالوقت داخل المحادثة، لا
  // بصفوفٍ متفرّقة.
  const existing = await prisma.supportThread.findFirst({
    where: { userId: user.id, channel: "WEB", deletedAt: null },
    orderBy: { lastMessageAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    await prisma.supportMessage.create({
      data: {
        threadId: existing.id,
        fromSupport: false,
        body: text.trim(),
        imageUrls,
        readByUser: true,
        createdAt: now,
      },
    });
    const reopened = await prisma.supportThread.update({
      where: { id: existing.id },
      data: {
        status: "OPEN",
        closedAt: null,
        lastMessageAt: now,
        readByAdminAt: null,
        // الموضوعُ بيتحدّث للأحدث: الصندوق بيعرض الموضوع، وموضوعٌ من
        // شهرٍ فوق رسالةٍ من دقيقة بيوصف الحاجة الغلط.
        subject: finalSubject,
        phone: phone?.trim() || undefined,
        country: country?.trim() || undefined,
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    void notifyOwnerNewSupport({
      name, email, phone, country, subject: finalSubject, body: text.trim(), isReply: true,
    });
    return NextResponse.json({ thread: reopened }, { status: 201 });
  }

  const thread = await prisma.supportThread.create({
    data: {
      userId: user.id,
      name, email,
      phone: phone?.trim() || null,
      country: country?.trim() || user.country || null,
      subject: finalSubject,
      channel: "WEB",
      lastMessageAt: now,
      messages: {
        create: { fromSupport: false, body: text.trim(), imageUrls, readByUser: true, createdAt: now },
      },
    },
    include: { messages: true },
  });

  void notifyOwnerNewSupport({ name, email, phone, country, subject: finalSubject, body: text.trim() });
  return NextResponse.json({ thread }, { status: 201 });
}
