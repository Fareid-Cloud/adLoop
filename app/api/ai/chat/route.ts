// app/api/ai/chat/route.ts
//
// نقطة مربّع السؤال.
//
// **الترتيب هنا ليس اعتباطياً:** كلّ فحصٍ يسبق النداء المدفوع، والأرخص
// أوّلاً. جلسة ← مساحة ← ديمو ← رصيد ← ثمّ Claude. فحصٌ بعد النداء يعني
// أنّنا دفعنا ثمن طلبٍ كان يجب أن يُرفض.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { blockAiInDemo } from "@/lib/demo";
import { checkAndConsumeChatQuota, refundChatQuota, isAiConfigured } from "@/lib/aiRateLimit";
import { planModelFor } from "@/lib/plans";
import {
  gatherAgentContext, hasEnoughData, type AgentContext,
} from "@/lib/agentContext";
import {
  answerWorkspaceQuestion, type ChatScope, type AnswerTelemetry,
} from "@/lib/aiChat";
import { t } from "@/lib/i18n/dictionary";

export const maxDuration = 60;

const SCOPES: ChatScope[] = ["home", "campaigns", "store"];
/** سؤالٌ أطول من هذا ليس سؤالاً - وطولُه يُدفَع ثمنُه توكناتٍ */
const MAX_QUESTION = 400;

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const locale = (user.preferredLocale as "ar" | "en") ?? "en";
  const body = await req.json().catch(() => null);
  const question = String(body?.question ?? "").trim();
  const scope: ChatScope = SCOPES.includes(body?.scope) ? body.scope : "home";
  /** محادثة قائمة تُكمَّل، أو `null` فتُنشَأ واحدة - مربّع السؤال يمرّر
   *  `null` دائماً، وقسم الوكيل يمرّر معرّف المحادثة المفتوحة. */
  const chatId = typeof body?.chatId === "string" && body.chatId ? body.chatId : null;

  if (question.length < 3 || question.length > MAX_QUESTION) {
    return NextResponse.json({ error: t(locale, "aiAsk.errBadQuestion") }, { status: 400 });
  }

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) return NextResponse.json({ error: t(locale, "common.noWorkspace") }, { status: 404 });

  const demoBlock = await blockAiInDemo(workspace.id, locale);
  if (demoBlock) return demoBlock;

  // البيانات **قبل** خصم الرصيد: حسابٌ بلا أرقام كافية لا يستحقّ أن يُخصم
  // منه رصيد مقابل جوابٍ لا يمكن أن يكون فيه شيء.
  const context = await gatherAgentContext(workspace.id, workspace.currency);

  if (!hasEnoughData(context)) {
    return NextResponse.json({ error: t(locale, "aiAsk.errNoData") }, { status: 422 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json({ error: t(locale, "apiErr.aiUnavailable") }, { status: 503 });
  }

  const quota = await checkAndConsumeChatQuota(user.id);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error:
          quota.reason === "hourly_exhausted"
            ? t(locale, "aiAsk.errHourly", { n: quota.retryAfterMinutes ?? 60 })
            : t(locale, "aiAsk.errMonthly"),
        upgradeUrl: quota.reason === "monthly_exhausted" ? "/dashboard/billing" : undefined,
      },
      { status: 429 }
    );
  }

  try {
    const result = await answerWorkspaceQuestion({
      question,
      context,
      scope,
      locale,
      model: await planModelFor(user.id),
    });
    // ── الذاكرة ──────────────────────────────────────────────────
    // الجواب كان يُعرَض ثمّ يُنسى عند أوّل تنقّل. يُحفظ الآن في محادثة
    // تُفتَح لاحقاً وتُكمَّل، فيصير مربّع السؤال مدخلاً إلى القسم لا
    // بديلاً عنه.
    //
    // **بعد النداء لا قبله:** حفظُ سؤالٍ فشل جوابه يترك محادثةً
    // نصفها فارغ في السجلّ، ولا شيء يُقرأ فيها.
    //
    // والفشل هنا لا يُسقط الجواب: المستخدم دفع رصيدَه وجوابه بين
    // يديه، فخسارة سطرٍ في السجلّ أهون من ابتلاع ما دفع ثمنه.
    const savedChatId = await persistExchange({
      chatId,
      workspaceId: workspace.id,
      userId: user.id,
      question,
      answer: result.answer,
      telemetry: result.telemetry,
      context,
    }).catch((err) => {
      console.error("[ai/chat] تعذّر حفظ المحادثة:", err);
      return null;
    });

    return NextResponse.json({
      answer: result.answer,
      remaining: quota.remainingThisMonth,
      chatId: savedChatId,
    });
  } catch (err) {
    console.error("[ai/chat] فشل النداء:", err);
    // الرصيد خُصم قبل النداء، وفشلُ النداء ليس ذنب المستخدم - يُردّ إليه.
    // **عبر `refundChatQuota` لا بكتابةٍ خام هنا:** اليدويّةُ كانت تردّ
    // الشهريَّ وحده وتترك الساعيَّ مستهلَكاً، وبلا شرط `gt: 0` فتنزل تحت
    // الصفر عند استردادين متوازيين، وبلا فحص المالك. التفصيل عند الدالّة.
    await refundChatQuota(user.id).catch(() => {});
    return NextResponse.json({ error: t(locale, "aiAsk.errFailed") }, { status: 502 });
  }
}

/** عنوان المحادثة = أوّل سؤال مقصوصاً عند حدٍّ يُقرأ في عمود ضيّق */
const TITLE_MAX = 60;

/**
 * ما الذي كان متاحاً للمساعد لحظةَ الإجابة - أرقامُ شكلٍ لا محتوى.
 *
 * الغرضُ منها سؤالٌ واحد وقتَ المراجعة: **إجابةٌ ضعيفة، الغلط في المساعد
 * ولا في البيانات؟** مساحةٌ بلا حملات ولا تحقّق، إجابتُها الضعيفة وصفٌ
 * صادق لحالها - وتعديلُ التعليمات عندها إصلاحٌ للشيء الخطأ، وأسوأ:
 * بيضيّع الإجابات الصح في المساحات الممتلئة.
 */
function summariseContext(c: AgentContext) {
  return {
    campaigns: c.campaigns.length,
    creatives: c.bestCreatives.length + c.worstCreatives.length,
    historyMonths: c.history.length,
    pendingDecisions: c.pendingDecisions.length,
    hasStore: c.store !== null,
    // الوسمُ الحيّ هو الفرق بين «الأرقام المتحقّقة صفر» و«التحقّق نفسه
    // مش شغّال» - وهو أوّل ما يُسأل عنه عند مراجعة إجابةٍ عن التحقّق.
    tagLive: c.tracking.tagLive,
    periodDays: c.periodDays,
    currency: c.currency,
  };
}

async function persistExchange({
  chatId, workspaceId, userId, question, answer, telemetry, context,
}: {
  chatId: string | null;
  workspaceId: string;
  userId: string;
  question: string;
  answer: string;
  telemetry: AnswerTelemetry;
  context: AgentContext;
}): Promise<string> {
  // معرّفٌ يصل من العميل، فقبولُه كما ورد يعني الكتابة في محادثة غيره.
  const existing = chatId
    ? await prisma.agentChat.findFirst({ where: { id: chatId, userId }, select: { id: true } })
    : null;

  const chat =
    existing ??
    (await prisma.agentChat.create({
      data: {
        workspaceId,
        userId,
        title: question.length > TITLE_MAX ? `${question.slice(0, TITLE_MAX).trimEnd()}…` : question,
      },
      select: { id: true },
    }));

  await prisma.agentMessage.createMany({
    data: [
      { chatId: chat.id, role: "user", content: question },
      {
        chatId: chat.id,
        role: "assistant",
        content: answer,
        // القياسُ على رسالة المساعد وحدها: سؤالُ المستخدم ماله زمنٌ ولا
        // توكنز ولا نسخةُ تعليمات.
        latencyMs: telemetry.latencyMs,
        inputTokens: telemetry.inputTokens,
        outputTokens: telemetry.outputTokens,
        promptVersion: telemetry.promptVersion,
        // 🔴 **ملخّصٌ لا نسخةٌ من السياق.** السياق نفسه فيه أرقامُ حساب
        // العميل كاملة، وتخزينُه مع كلّ إجابة تكرارٌ ضخمٌ لبياناتٍ موجودة
        // أصلاً - وتوسيعٌ بلا داعٍ لما يُقرأ وقت المراجعة. المطلوب في
        // الحكم شيءٌ واحد: **هل كان قدّامه ما يكفي؟**
        contextSummary: summariseContext(context),
      },
    ],
  });

  // الترتيب في السجلّ بالأحدث نشاطاً - محادثةٌ قديمة تُكمَّل اليوم تصعد.
  if (existing) {
    await prisma.agentChat.update({ where: { id: chat.id }, data: { updatedAt: new Date() } });
  }

  return chat.id;
}
