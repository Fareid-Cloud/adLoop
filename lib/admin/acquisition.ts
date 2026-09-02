// lib/admin/acquisition.ts
//
// **من فين جايين، وبيوصلوا لفين.**
//
// `howHeard` و`referralSource` بيتسجّلوا عند التسجيل من زمان **ومحدش
// بيقراهم** - يعني كلّ مشترك بيقول لنا من فين عرفنا، والإجابة بتروح في
// عمود مايتفتحش. الملف ده بيفتحه.
//
// وبيجاوب سؤالاً تانياً أهمّ: **التسجيل مش نجاح، والدفع مش أوّل نجاح.**
// المستخدم بيسجّل، وبعدين لازم يربط منصّة، وبعدين لازم يشوف رقماً متحقَّقاً
// (وهي لحظة القيمة الحقيقية في المنتج ده تحديداً - "الرقم الحقيقي مقابل
// اللي المنصّة بتقوله")، وبعدين يدفع. الأربع خطوات دي قمعٌ حقيقيّ، وكلّ
// خطوة بتسقط فيها ناس لسبب مختلف تماماً - وعلاجها مختلف كمان.
//
// ⚠️ **حدّ صادق: ده قمع لقطة لا قمع أفواج.** بيقول "كام واحد من اللي
// سجّلوا في الفترة دي وصل للخطوة الفلانية **لحدّ دلوقتي**" - يعني اللي
// سجّل امبارح لسه عنده وقت، واللي سجّل من شهر خلاص. مقارنة فترتين
// مختلفتين في الطول أو القِدَم بتقارن ناساً مالهمش نفس الفرصة.

import { prisma } from "@/lib/prisma";
import type { DateRange } from "./shared";

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  /** نسبة من الخطوة اللي قبلها - بتقول فين بالظبط بيقعوا */
  fromPreviousPct: number | null;
  /** نسبة من التسجيل - بتقول الحصيلة النهائية */
  fromTopPct: number | null;
  hint: string;
}

export interface SourceRow {
  source: string;
  signups: number;
  paying: number;
  conversionPct: number | null;
}

export interface AcquisitionAnalytics {
  funnel: FunnelStep[];
  /** «من فين سمعت عننا» - إجابة المستخدم نفسه */
  howHeard: SourceRow[];
  /** كود/مصدر إحالة */
  referral: SourceRow[];
  /** كام حساب ماقالش - المقام الصادق لأيّ نسبة فوق */
  unattributed: number;
  /** وسيط الأيام من التسجيل للدفع - `null` قبل ما يبقى فيه تحويلات كفاية */
  medianDaysToPay: number | null;
  note: string;
}

/** أقلّ من كده أيّ نسبة بتوصف أفراداً لا سلوكاً. */
const MIN_FOR_RATE = 5;

export async function getAcquisitionAnalytics(range: DateRange): Promise<AcquisitionAnalytics> {
  const signups = await prisma.user.findMany({
    where: { createdAt: { gte: range.from, lte: range.to } },
    select: {
      id: true,
      createdAt: true,
      howHeard: true,
      referralSource: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
    },
  });

  const ids = signups.map((u) => u.id);
  if (ids.length === 0) {
    return {
      funnel: [], howHeard: [], referral: [], unattributed: 0, medianDaysToPay: null,
      note: "No signups in this period.",
    };
  }

  const [connectedRows, workspaceRows, activatedEvents] = await Promise.all([
    // ربط منصّة: أوّل التزام حقيقيّ - قبله المنتج كلّه شاشات فاضية.
    prisma.connectedPlatform.findMany({
      where: { userId: { in: ids } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    // مساحات العمل بتاعتهم - جسر للوصول لصفوف التحقّق، اللي مربوطة
    // بالمساحة لا بالمستخدم.
    prisma.workspace.findMany({
      where: { userId: { in: ids } },
      select: { id: true, userId: true },
    }),
    // الدفع: من `SubscriptionEvent` لا من `subscriptionStatus`، عشان
    // نعرف **إمتى** دفع لا إنّه دافع دلوقتي بس. والهدايا مستثناة
    // (`actorAdminId`) لنفس سبب استثنائها من الإيراد.
    prisma.subscriptionEvent.findMany({
      where: { userId: { in: ids }, type: "ACTIVATED", actorAdminId: null },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const wsIds = workspaceRows.map((w) => w.id);
  const wsOwner = new Map(workspaceRows.map((w) => [w.id, w.userId]));

  // لحظة القيمة: أوّل تحويل **متحقَّق** - مش أوّل بيانات. المنتج مابيبيعش
  // عرض أرقام المنصّة، بيبيع الفرق بينها وبين الحقيقة، فالوصول لصفّ تحقّق
  // واحد هو أوّل مرّة يشوف فيها المشترك اللي دفع عشانه.
  const verifiedRows = wsIds.length
    ? await prisma.conversionVerification.findMany({
        where: { workspaceId: { in: wsIds } },
        select: { workspaceId: true },
        distinct: ["workspaceId"],
      })
    : [];

  const connectedSet = new Set(connectedRows.map((r) => r.userId));
  const verifiedSet = new Set(
    verifiedRows.map((r) => wsOwner.get(r.workspaceId)).filter((v): v is string => !!v)
  );

  // أوّل تفعيل لكلّ مستخدم - الصفوف مرتّبة تصاعدياً فأوّل واحد هو الأوّل.
  const firstPaid = new Map<string, Date>();
  for (const e of activatedEvents) {
    if (!firstPaid.has(e.userId)) firstPaid.set(e.userId, e.createdAt);
  }

  const total = signups.length;
  const connected = signups.filter((u) => connectedSet.has(u.id)).length;
  const verified = signups.filter((u) => verifiedSet.has(u.id)).length;
  const paid = signups.filter((u) => firstPaid.has(u.id)).length;

  const step = (
    key: string, label: string, count: number, previous: number | null, hint: string
  ): FunnelStep => ({
    key,
    label,
    count,
    fromPreviousPct: previous && previous > 0 ? (count / previous) * 100 : null,
    fromTopPct: total > 0 ? (count / total) * 100 : null,
    hint,
  });

  const funnel: FunnelStep[] = [
    step("signed_up", "Signed up", total, null, "Created an account in this period."),
    step("connected", "Connected a platform", connected, total,
      "Granted access to Google, Meta or TikTok. Before this the product has nothing to show them."),
    step("verified", "Saw a verified number", verified, connected,
      "Reached at least one verified conversion — the moment the product delivers what it sells."),
    step("paid", "Paid", paid, verified, "Started a paid subscription. Gifts are excluded."),
  ];

  // وسيط لا متوسّط: تحويلة واحدة بعد ٩ شهور بتجرّ المتوسّط لرقم مالوش معنى.
  const daysToPay = signups
    .map((u) => {
      const at = firstPaid.get(u.id);
      return at ? (at.getTime() - u.createdAt.getTime()) / 86_400_000 : null;
    })
    .filter((d): d is number => d !== null && d >= 0)
    .sort((a, z) => a - z);

  const medianDaysToPay =
    daysToPay.length >= MIN_FOR_RATE
      ? daysToPay.length % 2 === 1
        ? daysToPay[(daysToPay.length - 1) / 2]
        : (daysToPay[daysToPay.length / 2 - 1] + daysToPay[daysToPay.length / 2]) / 2
      : null;

  function group(pick: (u: (typeof signups)[number]) => string | null): SourceRow[] {
    const map = new Map<string, { signups: number; paying: number }>();
    for (const u of signups) {
      const raw = pick(u)?.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      const row = map.get(key) ?? { signups: 0, paying: 0 };
      row.signups += 1;
      if (firstPaid.has(u.id)) row.paying += 1;
      map.set(key, row);
    }
    return [...map.entries()]
      .map(([source, v]) => ({
        source,
        signups: v.signups,
        paying: v.paying,
        // نسبة تحويل على أقلّ من خمسة مابتتعرضش: "١ من ٢ = ٥٠٪" بيقرا
        // كأحسن قناة عندنا وهو صدفة.
        conversionPct: v.signups >= MIN_FOR_RATE ? (v.paying / v.signups) * 100 : null,
      }))
      .sort((a, z) => z.signups - a.signups);
  }

  const howHeard = group((u) => u.howHeard);
  const referral = group((u) => u.referralSource);
  const unattributed = signups.filter((u) => !u.howHeard?.trim() && !u.referralSource?.trim()).length;

  return {
    funnel,
    howHeard,
    referral,
    unattributed,
    medianDaysToPay,
    note:
      "A snapshot funnel, not a cohort one: it counts how far this period's signups have got by now, " +
      "so someone who signed up yesterday still has time and someone from last month does not. " +
      "Conversion rates are hidden below five signups, where they describe individuals rather than behaviour.",
  };
}
