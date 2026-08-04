// app/api/workspaces/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { verifyCsrfToken } from "@/lib/csrf";

const ALLOWED_FIELDS = [
  "name",
  "currency",
  "targetLocation",
  "profitMarginPct",
  "monthlyChangeCeilingPct",
  "facebookPageId",
  "whatsappPhoneNumberId",
  "whatsappBusinessPhone",
  "googleAdsCustomerId",
  "useModeledAttribution",
  "responseTimeThresholdMinutes",
  "messengerInactivityThresholdMinutes",
  "primaryConversionSource",
  "autoReplyText",
  "enableAIInsights",
  "enableAutomationRules",
  "enableDailyDiagnostics",
  "enablePricingHealthChecks",
  "adFatigueFrequencyThreshold",
  "ctrDropThresholdPct",
  "pricingWarningThresholdPct",
  "pricingCriticalThresholdPct",
  "rtoAnomalyMultiplier",
  "automationMonthlyBudgetChangeCeilingPct",
  "notifyUrgentByEmail",
  "notifyHighByEmail",
  "notificationEmail",
  // إعادة رفع التحويلات للمنصات
  "conversionSyncEnabled",
  "conversionSyncVerifiedOnly",
  "metaPixelId",
  "googleConversionActionId",
  "tiktokPixelCode",
] as const;

// حقول سرّية تُشفَّر قبل التخزين ولا تُعاد للواجهة أبداً. مفصولة عن
// ALLOWED_FIELDS عمداً: مرورها في نفس الحلقة كان سيكتبها نصاً صريحاً في
// قاعدة البيانات - نفس نوع الثغرة التي أُصلحت في توكنات OAuth.
const ENCRYPTED_FIELDS = ["metaCapiToken", "tiktokCapiToken"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // تحقق الملكية - نفس المبدأ في كل مكان (ADR §7)
  const workspace = await prisma.workspace.findFirst({
    where: { id: id, userId: user.id },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, any> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) data[field] = body[field];
  }

  // معرّفات رقمية تُنظَّف على الخادم لا في الواجهة وحدها: نسخها من واتساب
  // أو من لوحة جوجل يجرّ معها `+` وشرطات ومسافات، و`wa.me` وGoogle Ads
  // يرفضان كليهما. التنظيف في المتصفّح وحده يترك أيّ نداء آخر - أو لصقاً
  // في حقل آخر - يكتب قيمة تفشل صامتةً وقت الاستخدام لا وقت الحفظ.
  for (const field of ["whatsappPhoneNumberId", "whatsappBusinessPhone", "googleAdsCustomerId"]) {
    if (typeof data[field] === "string") {
      const digits = data[field].replace(/[^0-9]/g, "");
      data[field] = digits || null;
    }
  }

  // التوكنات: تُشفَّر قبل الكتابة. سلسلة فارغة تعني "امسح التوكن" لا
  // "شفّر الفراغ" - وإلّا تعذّر على المستخدم إلغاء توكن أدخله بالخطأ.
  for (const field of ENCRYPTED_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (typeof raw !== "string" || raw.trim() === "") {
      data[field] = null;
      continue;
    }
    // القيمة المقنّعة التي أرسلناها للواجهة تعود كما هي إن لم يعدّلها
    // المستخدم - كتابتها ستدمّر التوكن الحقيقي، فنتجاهلها.
    if (raw.includes("•")) continue;
    const { encryptToken } = await import("@/lib/encryption");
    data[field] = encryptToken(raw.trim());
  }

  const updated = await prisma.workspace.update({
    where: { id: id },
    data,
  });

  // لا تُعاد الحقول السرّية للواجهة إطلاقاً - حتى المشفّرة منها. إعادتها
  // تضع النصّ المشفّر في حمولة الاستجابة وذاكرة المتصفح بلا أي داعٍ،
  // والواجهة لا تحتاجها أصلاً (تعرض قناعاً لا القيمة).
  const safe = { ...updated } as Record<string, unknown>;
  for (const field of ENCRYPTED_FIELDS) delete safe[field];

  return NextResponse.json({ workspace: safe });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // إصلاح من اختبار الاختراق: حذف Workspace كامل كان من غير حماية CSRF
  // - فعل تدميري يستاهل نفس مستوى حماية حذف الحساب بالظبط
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: id, userId: user.id },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  // onDelete: Cascade في الـ schema بيتكفل بمسح كل البيانات المرتبطة تلقائياً
  await prisma.workspace.delete({ where: { id: id } });

  return NextResponse.json({ success: true });
}
