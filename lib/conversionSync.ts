// lib/conversionSync.ts
//
// إغلاق الحلقة: رفع أحداث التحويل **المتحقَّق منها** من عندنا إلى المنصات
// عبر الخادم (Server-Side / CAPI).
//
// لماذا هذا أهم ما في طبقة الحقيقة عملياً: كشف الفجوة وحده يجعل المستخدم
// أدرى - لكنه لا يغيّر شيئاً في المزاد. خوارزمية المنصة تتعلّم ممّا نطعمها
// إياه؛ فإن كانت تتعلّم على نقرات ورسائل عابرة، ستجلب المزيد منها. حين
// نرفع إليها العميل الدافع فعلاً، تتغيّر دالة التحسين نفسها لديها فتبدأ
// تبحث عن أشباهه. هذا هو الفرق بين لوحة تقارير وأداة تحسين.
//
// لماذا من الخادم لا المتصفح: حظر كوكيز الطرف الثالث وiOS ومانعات التتبع
// تُسقط جزءاً كبيراً من الأحداث المرسلة من المتصفح. الإرسال من الخادم لا
// يمرّ بأي من ذلك - الحدث يخرج من خادمنا إلى خادم المنصة مباشرة.
//
// الخصوصية: كل معرّف شخصي يُهشَّم SHA-256 بعد التطبيع (حروف صغيرة، إزالة
// مسافات، صيغة E.164 للهاتف) قبل مغادرته الخادم. لا نرسل نصاً صريحاً أبداً.

import { createHash } from "node:crypto";
import { countedFetch } from "@/lib/platformUsage";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";
import {
  scoreMatchQuality,
  signalsForPlatform,
  MIN_WORTH_SENDING_SCORE,
  type MatchSignals,
} from "@/lib/matchQuality";
import { assertNotDemo } from "@/lib/demo";
import { pickConnection } from "@/lib/platformConnections";

const META_API_VERSION = "v25.0";
const TIKTOK_API_VERSION = "v1.3";

// ==================== التطبيع والتهشيم ====================

export function hashPii(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * تطبيع الهاتف إلى E.164 بلا علامة + قبل التهشيم - وهو ما تتوقّعه المنصات
 * الثلاث. رقم بصيغة محلية ("05xxxxxxxx") لن يطابق شيئاً لدى المنصة مهما
 * كان التهشيم صحيحاً، لأنها تخزّن الصيغة الدولية.
 */
export function hashPhone(phone: string | null | undefined, defaultCountryCode = "966"): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = defaultCountryCode + digits.slice(1);

  // رقم قصير جداً ليس رقماً دولياً صالحاً - إرساله يخفض جودة المطابقة بلا فائدة
  if (digits.length < 8) return null;
  return createHash("sha256").update(digits).digest("hex");
}

export function hashEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

// ==================== الأنواع ====================

export interface SyncableConversion {
  id: string;
  externalId: string;
  eventName: string;
  occurredAt: Date;
  value: number;
  currency: string;
  verified: boolean;
  emailHash: string | null;
  phoneHash: string | null;
  firstNameHash: string | null;
  lastNameHash: string | null;
  cityHash: string | null;
  countryHash: string | null;
  externalUserId: string | null;
  clientIpAddress: string | null;
  clientUserAgent: string | null;
  fbp: string | null;
  fbc: string | null;
  gclid: string | null;
  ttclid: string | null;
}

export interface SyncResult {
  platform: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string;
  platformEventId?: string;
  matchQualityScore?: number;
}

// خريطة أسماء الأحداث القياسية لكل منصة. الاسم غير القياسي يُقبل لكنه
// لا يُغذّي تحسين المنصة بنفس القوة - فالخوارزمية تعرف "شراء" ولا تعرف
// اسماً اخترعناه نحن.
const META_EVENT_NAMES: Record<string, string> = {
  Purchase: "Purchase",
  Lead: "Lead",
  QualifiedLead: "Lead",
  Subscribe: "Subscribe",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  Contact: "Contact",
};

const TIKTOK_EVENT_NAMES: Record<string, string> = {
  Purchase: "CompletePayment",
  Lead: "SubmitForm",
  QualifiedLead: "SubmitForm",
  Subscribe: "Subscribe",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  Contact: "Contact",
};

// ==================== ميتا - Conversions API ====================

async function sendToMeta(
  workspace: { id: string; metaPixelId: string | null; metaCapiToken: string | null },
  conv: SyncableConversion
): Promise<SyncResult> {
  if (!workspace.metaPixelId || !workspace.metaCapiToken) {
    return { platform: "META_ADS", status: "SKIPPED", error: "لم يُضبط معرّف البكسل أو توكن CAPI" };
  }

  const signals = signalsForPlatform("META_ADS", toSignals(conv));
  const quality = scoreMatchQuality(signals);
  if (!quality.worthSending) {
    return {
      platform: "META_ADS",
      status: "SKIPPED",
      error: `جودة المطابقة ${quality.score}/10 أقل من الحد الأدنى (${MIN_WORTH_SENDING_SCORE}) - الرفع لن يُربط بأحد`,
      matchQualityScore: quality.score,
    };
  }

  // ميتا تتوقّع مصفوفات لحقول المستخدم المُهشَّمة، وقيمة مفردة لـ fbc/fbp
  // وIP/المتصفح. الخلط بينهما سبب شائع لقبول الحدث ثم إهماله بلا خطأ ظاهر.
  const userData: Record<string, unknown> = {};
  const arrayField = (key: string, v: string | null) => {
    if (v) userData[key] = [v];
  };
  arrayField("em", conv.emailHash);
  arrayField("ph", conv.phoneHash);
  arrayField("fn", conv.firstNameHash);
  arrayField("ln", conv.lastNameHash);
  arrayField("ct", conv.cityHash);
  arrayField("country", conv.countryHash);
  arrayField("external_id", conv.externalUserId);
  if (conv.clientIpAddress) userData.client_ip_address = conv.clientIpAddress;
  if (conv.clientUserAgent) userData.client_user_agent = conv.clientUserAgent;
  if (conv.fbc) userData.fbc = conv.fbc;
  if (conv.fbp) userData.fbp = conv.fbp;

  const payload = {
    data: [
      {
        event_name: META_EVENT_NAMES[conv.eventName] ?? conv.eventName,
        event_time: Math.floor(conv.occurredAt.getTime() / 1000),
        // نفس المعرّف المستخدم لدى البكسل في المتصفح - هو ما يمنع ميتا من
        // عدّ التحويل مرتين حين يصلها من المصدرين معاً
        event_id: conv.externalId,
        action_source: "website",
        user_data: userData,
        custom_data: { currency: conv.currency, value: conv.value },
      },
    ],
  };

  try {
    const res = await countedFetch(workspace.id, "META_ADS", 
      `https://graph.facebook.com/${META_API_VERSION}/${workspace.metaPixelId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, access_token: decryptToken(workspace.metaCapiToken) }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        platform: "META_ADS",
        status: "FAILED",
        error: data?.error?.message ?? `HTTP ${res.status}`,
        matchQualityScore: quality.score,
      };
    }
    return {
      platform: "META_ADS",
      status: "SENT",
      platformEventId: data?.fbtrace_id ?? undefined,
      matchQualityScore: quality.score,
    };
  } catch (err) {
    return { platform: "META_ADS", status: "FAILED", error: errorText(err), matchQualityScore: quality.score };
  }
}

// ==================== جوجل - رفع تحويلات النقرات ====================
//
// مؤكَّد من توثيق مكتبة google-ads-api الرسمية ومن توثيق جوجل نفسه:
// - customer.conversionUploads.uploadClickConversions
// - partial_failure **يجب** أن يكون true لهذه الخدمة
// - user_identifiers: معرّف واحد فقط لكل كائن UserIdentifier (لا بريد
//   وهاتف في الكائن نفسه) - وهو خطأ شائع يُرجع طلباً مشوَّهاً
// - تتطلّب ConversionAction من نوع WEBPAGE مع تفعيل التحويلات المُحسَّنة

async function sendToGoogle(
  workspace: { id: string; googleConversionActionId: string | null },
  conv: SyncableConversion
): Promise<SyncResult> {
  if (!workspace.googleConversionActionId) {
    return {
      platform: "GOOGLE_ADS",
      status: "SKIPPED",
      error: "لم يُضبط معرّف إجراء التحويل (Conversion Action) في الإعدادات",
    };
  }

  const signals = signalsForPlatform("GOOGLE_ADS", toSignals(conv));
  const quality = scoreMatchQuality(signals);
  // جوجل بلا gclid وبلا بريد/هاتف لا تملك ما تربط به شيئاً إطلاقاً
  if (!conv.gclid && !conv.emailHash && !conv.phoneHash) {
    return {
      platform: "GOOGLE_ADS",
      status: "SKIPPED",
      error: "لا يوجد gclid ولا بريد/هاتف - لا سبيل لجوجل لربط الحدث",
      matchQualityScore: quality.score,
    };
  }

  try {
    const { GoogleAdsApi, ResourceNames, services } = await import("google-ads-api");

    const link = await prisma.campaignLink.findFirst({
      where: { workspaceId: workspace.id, platform: "GOOGLE_ADS" },
    });
    if (!link) {
      return { platform: "GOOGLE_ADS", status: "SKIPPED", error: "لا يوجد حساب جوجل مرتبط" };
    }

    const ws = await prisma.workspace.findUnique({
      where: { id: workspace.id },
      include: { user: { include: { connectedPlatforms: { include: { accounts: true } } } } },
    });
    // الحساب معروفٌ من الرابط أعلاه، فتُحسم به المنحة: رفع التحويلات
    // إلى حساب عميلٍ بتوكن عميلٍ آخر يُرفض، فتنقطع حلقة التحقّق نفسها.
    const connection = pickConnection(ws?.user.connectedPlatforms, "GOOGLE_ADS", link.externalAccountId);
    if (!connection?.refreshToken) {
      return { platform: "GOOGLE_ADS", status: "SKIPPED", error: "حساب جوجل غير متصل" };
    }

    const customer = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    }).Customer({
      customer_id: link.externalAccountId,
      // نفس نمط حسابات الوكالة (MCC) المستخدم في كل نداء آخر - إغفاله
      // يُفشل كل حساب يعمل تحت وكالة، وهو الوضع الشائع لعملاء AdLoop
      ...(connection.managerAccountId ? { login_customer_id: connection.managerAccountId } : {}),
      refresh_token: decryptToken(connection.refreshToken),
    });

    // معرّف واحد فقط لكل كائن - قيد صريح في توثيق جوجل
    const userIdentifiers: Array<Record<string, unknown>> = [];
    if (conv.emailHash) userIdentifiers.push({ hashed_email: conv.emailHash });
    if (conv.phoneHash) userIdentifiers.push({ hashed_phone_number: conv.phoneHash });

    const clickConversion: Record<string, unknown> = {
      conversion_action: ResourceNames.conversionAction(
        link.externalAccountId,
        workspace.googleConversionActionId
      ),
      conversion_date_time: formatGoogleDateTime(conv.occurredAt),
      conversion_value: conv.value,
      currency_code: conv.currency,
      order_id: conv.externalId, // يمنع الرفع المزدوج لنفس الطلب
    };
    if (conv.gclid) clickConversion.gclid = conv.gclid;
    if (userIdentifiers.length > 0) clickConversion.user_identifiers = userIdentifiers;

    const request = new services.UploadClickConversionsRequest({
      customer_id: link.externalAccountId,
      conversions: [clickConversion],
      // إلزامي لهذه الخدمة تحديداً - من دونه يُرفض الطلب
      partial_failure: true,
    });

    const response = await customer.conversionUploads.uploadClickConversions(request);

    // partial_failure يعني أن الاستجابة قد تكون 200 وفيها فشل الصف نفسه.
    // تجاهل هذا الحقل هو بالضبط ما يجعل أداةً تقول "تمت المزامنة" بينما
    // لم يصل شيء - نقرؤه صراحةً.
    const partialError = (response as { partial_failure_error?: { message?: string } })
      ?.partial_failure_error;
    if (partialError?.message) {
      return {
        platform: "GOOGLE_ADS",
        status: "FAILED",
        error: partialError.message,
        matchQualityScore: quality.score,
      };
    }

    return { platform: "GOOGLE_ADS", status: "SENT", matchQualityScore: quality.score };
  } catch (err) {
    return { platform: "GOOGLE_ADS", status: "FAILED", error: errorText(err), matchQualityScore: quality.score };
  }
}

/** جوجل تتطلّب "yyyy-MM-dd HH:mm:ss+|-HH:mm" - إغفال إزاحة المنطقة الزمنية
 *  سبب رفض شائع، ولا تكفي صيغة ISO المعتادة. */
function formatGoogleDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

// ==================== تيك توك - Events API 2.0 ====================
//
// ⚠️ مستوى ثقة متوسط: نقطة النهاية (/open_api/v1.3/event/track/) وقيم
// event_source مؤكَّدة من مصادر متعددة، لكن التداخل الدقيق لحقول
// data[].user / data[].properties لم نجد له مثالاً رسمياً كاملاً. مبني
// على الصيغة المتّفق عليها في تكاملات الطرف الثالث الموثّقة، ويحتاج
// تأكيداً عملياً عند أول ربط حساب تيك توك حقيقي - مسجَّل في
// activation-checklist.md بدل ادّعاء اليقين.

async function sendToTikTok(
  workspace: { id: string; tiktokPixelCode: string | null; tiktokCapiToken: string | null },
  conv: SyncableConversion
): Promise<SyncResult> {
  if (!workspace.tiktokPixelCode || !workspace.tiktokCapiToken) {
    return { platform: "TIKTOK_ADS", status: "SKIPPED", error: "لم يُضبط رمز البكسل أو توكن الأحداث" };
  }

  const signals = signalsForPlatform("TIKTOK_ADS", toSignals(conv));
  const quality = scoreMatchQuality(signals);
  if (!quality.worthSending) {
    return {
      platform: "TIKTOK_ADS",
      status: "SKIPPED",
      error: `جودة المطابقة ${quality.score}/10 أقل من الحد الأدنى (${MIN_WORTH_SENDING_SCORE})`,
      matchQualityScore: quality.score,
    };
  }

  const user: Record<string, unknown> = {};
  if (conv.emailHash) user.email = conv.emailHash;
  if (conv.phoneHash) user.phone = conv.phoneHash;
  if (conv.externalUserId) user.external_id = conv.externalUserId;
  if (conv.ttclid) user.ttclid = conv.ttclid;
  if (conv.clientIpAddress) user.ip = conv.clientIpAddress;
  if (conv.clientUserAgent) user.user_agent = conv.clientUserAgent;

  try {
    const res = await countedFetch(workspace.id, "TIKTOK_ADS", 
      `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/event/track/`,
      {
        method: "POST",
        headers: {
          "Access-Token": decryptToken(workspace.tiktokCapiToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_source: "web",
          event_source_id: workspace.tiktokPixelCode,
          data: [
            {
              event: TIKTOK_EVENT_NAMES[conv.eventName] ?? conv.eventName,
              event_time: Math.floor(conv.occurredAt.getTime() / 1000),
              event_id: conv.externalId,
              user,
              properties: { currency: conv.currency, value: conv.value },
            },
          ],
        }),
      }
    );
    const data = await res.json();
    if (data.code !== 0) {
      return {
        platform: "TIKTOK_ADS",
        status: "FAILED",
        error: data.message ?? `code ${data.code}`,
        matchQualityScore: quality.score,
      };
    }
    return {
      platform: "TIKTOK_ADS",
      status: "SENT",
      platformEventId: data.request_id ?? undefined,
      matchQualityScore: quality.score,
    };
  } catch (err) {
    return { platform: "TIKTOK_ADS", status: "FAILED", error: errorText(err), matchQualityScore: quality.score };
  }
}

// ==================== المنسّق ====================

function toSignals(conv: SyncableConversion): MatchSignals {
  return {
    emailHash: conv.emailHash,
    phoneHash: conv.phoneHash,
    firstNameHash: conv.firstNameHash,
    lastNameHash: conv.lastNameHash,
    cityHash: conv.cityHash,
    countryHash: conv.countryHash,
    externalUserId: conv.externalUserId,
    clientIpAddress: conv.clientIpAddress,
    clientUserAgent: conv.clientUserAgent,
    fbp: conv.fbp,
    fbc: conv.fbc,
    gclid: conv.gclid,
    ttclid: conv.ttclid,
  };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** أقصى عدد أحداث لكل تشغيل - يحمي من استنفاد حصّة المنصة ومن مهلة الدالة */
const MAX_EVENTS_PER_RUN = 200;

export interface SyncRunSummary {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  byPlatform: Record<string, { sent: number; failed: number; skipped: number }>;
}

/**
 * يرفع الأحداث التي لم تُرفع بعد. آمن للتكرار: سجل ConversionSyncLog يحمل
 * قيداً فريداً على (الحدث، المنصة)، فإعادة التشغيل لا ترفع الحدث مرتين.
 */
export async function syncPendingConversions(workspaceId: string): Promise<SyncRunSummary> {
  // لا رفع أحداث من مساحة تجريبية إلى حساب إعلاني حقيقي
  await assertNotDemo(workspaceId);

  const summary: SyncRunSummary = { processed: 0, sent: 0, failed: 0, skipped: 0, byPlatform: {} };

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || !workspace.conversionSyncEnabled) return summary;

  const targets: string[] = [];
  if (workspace.metaPixelId && workspace.metaCapiToken) targets.push("META_ADS");
  if (workspace.googleConversionActionId) targets.push("GOOGLE_ADS");
  if (workspace.tiktokPixelCode && workspace.tiktokCapiToken) targets.push("TIKTOK_ADS");
  if (targets.length === 0) return summary;

  // ── حدّ الباقة: رفع التحويلات ─────────────────────────────────────
  //
  // 🔴 كان `conversionSync` معروضاً في جدول الباقات («لا / منصّة واحدة /
  // كلّ المنصّات») ولا يُفحص في أيّ موضع - فالباقة المجّانية التي تَعِد
  // بـ«لا رفع» كانت ترفع إلى الثلاث.
  //
  // والفحص **هنا** لا عند العرض: هذه هي اللحظة التي يُرسَل فيها الحدث
  // فعلاً إلى المنصّة. حدٌّ يُفحص في الواجهة وحدها يمرّ من أوّل نداءٍ آليّ.
  const { getEntitlements } = await import("@/lib/entitlements");
  const allowance = (await getEntitlements(workspace.userId)).limits.conversionSync;

  if (allowance === "none") return summary;
  if (allowance === "one" && targets.length > 1) {
    // المنصّة الواحدة تُختار بالترتيب أعلاه لا عشوائياً، فيبقى الاختيار
    // نفسه بين تشغيلٍ وآخر - وإلّا رُفع الحدث إلى منصّة اليوم وأخرى غداً.
    targets.length = 1;
  }

  const events = await prisma.conversionEvent.findMany({
    where: {
      workspaceId,
      ...(workspace.conversionSyncVerifiedOnly ? { verified: true } : {}),
      // ما لم يُرفع بعد لأي من المنصات المستهدفة
      NOT: { syncLogs: { some: { platform: { in: targets as never }, status: { in: ["SENT", "SKIPPED"] } } } },
    },
    orderBy: { occurredAt: "desc" },
    take: MAX_EVENTS_PER_RUN,
  });

  for (const event of events) {
    const existing = await prisma.conversionSyncLog.findMany({
      where: { conversionEventId: event.id },
    });
    const done = new Set(
      existing.filter((l) => l.status === "SENT" || l.status === "SKIPPED").map((l) => l.platform as string)
    );

    for (const platform of targets) {
      if (done.has(platform)) continue;
      summary.processed++;

      let result: SyncResult;
      if (platform === "META_ADS") result = await sendToMeta(workspace, event);
      else if (platform === "GOOGLE_ADS") result = await sendToGoogle(workspace, event);
      else result = await sendToTikTok(workspace, event);

      const bucket = (summary.byPlatform[platform] ??= { sent: 0, failed: 0, skipped: 0 });
      if (result.status === "SENT") { summary.sent++; bucket.sent++; }
      else if (result.status === "FAILED") { summary.failed++; bucket.failed++; }
      else { summary.skipped++; bucket.skipped++; }

      await prisma.conversionSyncLog.upsert({
        where: { conversionEventId_platform: { conversionEventId: event.id, platform: platform as never } },
        create: {
          workspaceId,
          conversionEventId: event.id,
          platform: platform as never,
          status: result.status as never,
          attempts: 1,
          errorMessage: result.error ?? null,
          platformEventId: result.platformEventId ?? null,
          matchQualityScore: result.matchQualityScore ?? null,
          sentAt: result.status === "SENT" ? new Date() : null,
        },
        update: {
          status: result.status as never,
          attempts: { increment: 1 },
          errorMessage: result.error ?? null,
          platformEventId: result.platformEventId ?? null,
          matchQualityScore: result.matchQualityScore ?? null,
          sentAt: result.status === "SENT" ? new Date() : null,
        },
      });
    }

    // تحديث درجة جودة المطابقة المحسوبة على الحدث نفسه (مرة واحدة)
    if (event.matchQualityScore === null) {
      await prisma.conversionEvent.update({
        where: { id: event.id },
        data: { matchQualityScore: scoreMatchQuality(toSignals(event)).score },
      });
    }
  }

  return summary;
}
