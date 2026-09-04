// lib/featureFlags.ts
//
// مفاتيح تشغيل/إيقاف عامّة على مستوى المنتج كله.
//
// **مش نظام حدود، ومش بديل عنه.** حدود الباقة بتقول "الحساب ده بيستحقّ
// الميزة دي ولا لأ" وبتعيش في `lib/entitlements.ts`. المفاتيح هنا بتقول
// "الميزة دي شغّالة أصلاً ولا لأ" - إيقاف مزامنة ميتا وقت عطل عندهم، أو
// فتح ميزة تجريبية. الخلط بينهم كان هيخلّي إيقاف طارئ يتقري للعميل
// "باقتك اتغيّرت".
//
// **القائمة مغلقة ومكتوبة هنا** لا صفوف حرّة في قاعدة البيانات: مفتاح
// موجود في الجدول ومفيش كود بيقراه = مفتاح كذّاب بيدّي المالك إحساس
// تحكّم مالوش وجود. الصفّ بيخزّن الحالة بس، والوجود بيتحدّد من هنا.

import { prisma } from "@/lib/prisma";

export const FEATURE_FLAGS = [
  {
    // 🔴 **المفتاح ده بيغيّر فلوساً، مش عرضاً.**
    // وهو مطفأ يبقى السعر الأساسي هو المعروض **والمحصَّل** معاً - لأنّ
    // البطاقة والفاتورة بيقروا من نفس الدالّة. إطفاؤه ينهي عرض الإطلاق
    // فوراً لكلّ زائر جديد؛ الاشتراكات القائمة تكمل بسعرها حتى تجديدها.
    key: "pricing.launchOffer",
    label: "Launch offer pricing",
    description:
      "On: plans are sold at the offer price with the standard price struck through. Off: the standard price becomes the price - on the card and at checkout together.",
    defaultOn: true,
  },
  {
    key: "sync.google",
    label: "Google Ads sync",
    description: "Daily Google Ads data pull. Turn off during a Google-side outage to stop failed runs piling up.",
    defaultOn: true,
  },
  {
    key: "sync.meta",
    label: "Meta Ads sync",
    description: "Daily Meta data pull, including Instagram placements.",
    defaultOn: true,
  },
  {
    key: "sync.tiktok",
    label: "TikTok Ads sync",
    description: "Daily TikTok data pull.",
    defaultOn: true,
  },
  {
    key: "ai.insights",
    label: "AI insights & Ask",
    description: "Claude-backed analysis. Turning this off stops all model spend immediately, product-wide.",
    defaultOn: true,
  },
  {
    key: "ai.siteScan",
    label: "Deep site scan",
    description: "The heaviest AI call in the product — up to four model calls per scan.",
    defaultOn: true,
  },
  {
    key: "automation.apply",
    label: "Automation apply",
    description: "Real write-back calls to ad platforms. Off means suggestions still appear but nothing executes.",
    defaultOn: true,
  },
  {
    key: "billing.checkout",
    label: "Checkout",
    description: "New subscription and credit purchases. Off puts the pricing page into contact-us mode.",
    defaultOn: true,
  },
  {
    key: "marketing.emails",
    label: "Lifecycle emails",
    description: "Trial, engagement and win-back campaigns sent by the daily cron.",
    defaultOn: true,
  },
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[number]["key"];

export function isFeatureFlagKey(v: unknown): v is FeatureFlagKey {
  return typeof v === "string" && FEATURE_FLAGS.some((f) => f.key === v);
}

function defaultOf(key: FeatureFlagKey): boolean {
  return FEATURE_FLAGS.find((f) => f.key === key)?.defaultOn ?? true;
}

/**
 * حالة مفتاح واحد.
 *
 * **الافتراضي عند أي فشل هو "مفتوح"، لا "مقفول".** انقطاع لحظيّ عن قاعدة
 * البيانات مالوش الحقّ يطفّي نص المنتج لكل العملاء - والإيقاف قرار صريح
 * لازم يبقى مكتوب في صفّ، مش نتيجة جانبية لخطأ شبكة.
 */
export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  try {
    const row = await prisma.featureFlag.findUnique({
      where: { key },
      select: { enabledGlobally: true },
    });
    return row ? row.enabledGlobally : defaultOf(key);
  } catch {
    return defaultOf(key);
  }
}

/** كل المفاتيح مرّة واحدة - للحلقات اللي بتفحص أكتر من مفتاح */
export async function loadFeatureFlags(): Promise<Record<FeatureFlagKey, boolean>> {
  const out = {} as Record<FeatureFlagKey, boolean>;
  for (const f of FEATURE_FLAGS) out[f.key] = f.defaultOn;
  try {
    const rows = await prisma.featureFlag.findMany({ select: { key: true, enabledGlobally: true } });
    for (const r of rows) {
      if (isFeatureFlagKey(r.key)) out[r.key] = r.enabledGlobally;
    }
  } catch {
    // نفس المبدأ: فشل القراءة يرجع للافتراضيات مش للإيقاف
  }
  return out;
}

export async function setFeatureFlag(
  key: FeatureFlagKey,
  enabled: boolean,
  description?: string
): Promise<void> {
  await prisma.featureFlag.upsert({
    where: { key },
    create: {
      key,
      enabledGlobally: enabled,
      description: description ?? FEATURE_FLAGS.find((f) => f.key === key)?.description ?? null,
    },
    update: { enabledGlobally: enabled },
  });
}

/** المفاتيح مع حالتها الحالية - لصفحة اللوحة */
export async function listFeatureFlags() {
  const state = await loadFeatureFlags();
  return FEATURE_FLAGS.map((f) => ({ ...f, enabled: state[f.key] }));
}
