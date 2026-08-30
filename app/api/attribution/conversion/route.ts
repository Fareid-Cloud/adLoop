// app/api/attribution/conversion/route.ts
//
// استقبال حدث تحويل حقيقي (طلب مؤكَّد، عميل دافع) - وهو "العملة" التي
// تُقسَّم على اللمسات في نماذج الإسناد، والحمولة التي تُرفع لاحقاً للمنصات.
//
// الخصوصية أولاً: البيانات الشخصية تصل هنا نصاً صريحاً وتُهشَّم **قبل**
// الكتابة في قاعدة البيانات. لا يُخزَّن بريد ولا هاتف صريح إطلاقاً، لا هنا
// ولا في السجلّات - فحتى لو تسرّبت قاعدة البيانات لا يوجد ما يُقرأ.
//
// آمن للتكرار: externalId فريد لكل مساحة عمل، فإعادة إرسال الويب هوك
// (شائعة جداً) لا تُنشئ تحويلاً مكرّراً ولا ترفعه مرّتين للمنصة.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalServiceAuth } from "@/lib/internalServiceAuth";
import { hashEmail, hashPhone, hashPhoneE164, hashPii } from "@/lib/conversionSync";
import { scoreMatchQuality } from "@/lib/matchQuality";

export async function POST(req: NextRequest) {
  if (!verifyInternalServiceAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const workspaceId = str(body.workspaceId);
  const externalId = str(body.externalId);
  if (!workspaceId || !externalId) {
    return NextResponse.json({ error: "workspaceId and externalId are required" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { currency: true, targetLocation: true },
  });
  if (!workspace) return NextResponse.json({ error: "workspace not found" }, { status: 404 });

  // رمز الدولة الافتراضي لتطبيع الهاتف إلى E.164 - رقم بصيغة محلية لن
  // يطابق شيئاً لدى المنصة مهما كان التهشيم سليماً
  const defaultCc = workspace.targetLocation === "EG" ? "20" : workspace.targetLocation === "AE" ? "971" : "966";

  const signals = {
    emailHash: hashEmail(str(body.email)),
    // تهشيمان لرقمٍ واحد: ميتا تريده أرقاماً مجرّدة، وجوجل وتيك توك E.164
    // بعلامة `+` (C-4). ويُحسبان هنا معاً لأنّ الخام لا يُخزَّن.
    phoneHash: hashPhone(str(body.phone), defaultCc),
    phoneHashE164: hashPhoneE164(str(body.phone), defaultCc),
    firstNameHash: hashPii(str(body.firstName)),
    lastNameHash: hashPii(str(body.lastName)),
    cityHash: hashPii(str(body.city)),
    countryHash: hashPii(str(body.country)),
    externalUserId: hashPii(str(body.customerId)),
    clientIpAddress: str(body.ipAddress) ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    clientUserAgent: str(body.userAgent),
    fbp: str(body.fbp),
    // ميتا تتوقّع fbc بصيغتها الرسمية: fb.1.<timestamp>.<fbclid>
    fbc: str(body.fbc) ?? buildFbc(str(body.fbclid)),
    gclid: str(body.gclid),
    ttclid: str(body.ttclid),
    // مصدر الحدث يحدّد `action_source` عند الرفع لميتا (C-8). القيمة
    // الافتراضية `website` تُبقي سلوك أحداث المتجر كما هو - وهي صحيحةٌ لها.
    sourceKind:
      str(body.sourceKind) === "whatsapp" ? "whatsapp"
      : str(body.sourceKind) === "messenger" ? "messenger"
      : "website",
    ctwaClid: str(body.ctwaClid),
  };

  const quality = scoreMatchQuality(signals);

  try {
    const event = await prisma.conversionEvent.upsert({
      where: { workspaceId_externalId: { workspaceId, externalId } },
      create: {
        workspaceId,
        externalId,
        visitorId: str(body.visitorId),
        eventName: str(body.eventName) ?? "Purchase",
        occurredAt: body.occurredAt ? new Date(String(body.occurredAt)) : new Date(),
        value: num(body.value) ?? 0,
        currency: str(body.currency) ?? workspace.currency,
        verified: body.verified === true,
        matchQualityScore: quality.score,
        ...signals,
      },
      // إعادة الإرسال قد تحمل بيانات أكمل (رقم تأكّد لاحقاً، طلب صار مدفوعاً)
      update: {
        verified: body.verified === true ? true : undefined,
        value: num(body.value) ?? undefined,
        matchQualityScore: quality.score,
        ...signals,
      },
    });

    return NextResponse.json({
      ok: true,
      id: event.id,
      matchQuality: quality.score,
      grade: quality.gradeAr,
      worthSending: quality.worthSending,
      missingHighValue: quality.missingHighValue.map((m) => m.labelAr),
    });
  } catch (err) {
    console.error("فشل تسجيل حدث التحويل:", err);
    return NextResponse.json({ error: "could not record the event" }, { status: 500 });
  }
}

/** ميتا تشترط صيغة fb.1.<ms>.<fbclid> - إرسال fbclid خاماً يُهمَل بصمت */
function buildFbc(fbclid: string | null): string | null {
  if (!fbclid) return null;
  return `fb.1.${Date.now()}.${fbclid}`;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
