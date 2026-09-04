// app/api/sales-enquiry/route.ts - طلبُ الباقة الاتفاقية
//
// مسارٌ منفصلٌ عن الدعم، مش لأنّ الحقول مختلفة - لأنّ **الرحلة** مختلفة:
// ده طلبُ شراء، ومكانُه طابورُ مبيعاتٍ له حالاتُه (اتُّصل به، رَبِح، خسر)
// لا صندوقُ تذاكر بيتقفل بالردّ.

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSpendBand } from "@/lib/salesEnquiry";
import { notifyOwnerSalesEnquiry } from "@/lib/supportEmail";

const SPEND_LABEL: Record<string, string> = {
  under_10k: "أقل من 10,000$ شهرياً",
  "10k_50k": "10,000$ – 50,000$ شهرياً",
  "50k_200k": "50,000$ – 200,000$ شهرياً",
  over_200k: "أكثر من 200,000$ شهرياً",
};

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(req: NextRequest) {
  // **الطلبُ متاحٌ لمسجَّلٍ وغير مسجَّل.** أكبرُ عميلٍ محتمَل ممكن يكون
  // لسه ما عملش حساب - وإجبارُه على التسجيل قبل ما يقدر يكلّمنا بيصفّي
  // بالظبط اللي إحنا عايزينه.
  const user = await getSessionUser(req).catch(() => null);

  // 🔴 **مسارٌ مفتوح بيكتب صفّاً وبيبعت بريداً - لازم حدُّ معدّل.**
  //
  // من غيره، سكربتٌ في سطرٍ واحد بيملا الطابور بمئات الطلبات المزيّفة
  // ويغرق بريد المالك - والطابورُ اللي جوّاه ضوضاء بيتساب، فيضيع معاه
  // الطلبُ الحقيقيّ الوحيد اللي فيه. والضررُ التاني إنّ كلَّ رسالةٍ من
  // دول مدفوعةٌ عندنا في Resend.
  //
  // خمسةٌ في الساعة للـIP: أكترُ بكتير من أيّ حاجةٍ حقيقية (اللي بيطلب
  // مكالمةَ مبيعات بيطلبها مرّة)، وأقلُّ بكتير من أن يكون الإغراقُ مجدياً.
  // والمسجَّلُ بيتحسب بحسابه لا بالـIP: المكاتب في مصر ورا CGNAT، فحدٌّ
  // بالـIP وحده كان هيقفل على شركةٍ كاملة بطلبِ موظّفٍ واحد.
  const limit = await checkRateLimit(
    user ? `user:${user.id}` : `ip:${getClientIp(req)}`,
    "sales-enquiry",
    5,
    60
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "too many requests — please email us directly" },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const company = str(body.company, 160);
  const name = str(body.name, 120) ?? user?.name ?? null;
  const email = str(body.email, 190) ?? user?.email ?? null;
  const phone = str(body.phone, 40);

  // الهاتفُ مطلوبٌ هنا كما في الشاشة. `required` في المتصفّح تحسينُ تجربةٍ
  // لا قاعدة: نداءٌ مباشر يتخطّاه، فيدخل الطلبُ بلا رقمٍ والوعدُ مكالمة.
  if (!company || !name || !email || !phone) {
    return NextResponse.json(
      { error: "company, name, email and phone are required" },
      { status: 400 }
    );
  }
  // أربعةُ أرقامٍ على الأقلّ: يمنع «-» و«لا يوجد» بلا رفضِ صيغةٍ دوليةٍ صحيحة.
  if ((phone.match(/\d/g) ?? []).length < 4) {
    return NextResponse.json({ error: "invalid phone" }, { status: 400 });
  }
  // فحصُ شكلٍ بسيط لا تحقّقٌ من الوجود: الغرضُ منع الخطأ المطبعيّ اللي
  // بيخلّي الردَّ يروح لحدّ تاني، مش إثباتُ ملكية البريد.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const monthlySpend = isSpendBand(body.monthlySpend) ? body.monthlySpend : null;
  const adAccountsRaw = Number(body.adAccounts);
  const adAccounts =
    Number.isFinite(adAccountsRaw) && adAccountsRaw > 0 && adAccountsRaw < 100_000
      ? Math.round(adAccountsRaw)
      : null;

  const row = await prisma.salesEnquiry.create({
    data: {
      userId: user?.id ?? null,
      company,
      name,
      email,
      phone,
      country: str(body.country, 8),
      monthlySpend,
      adAccounts,
      message: str(body.message, 4000),
    },
    select: { id: true },
  });

  // البريدُ بعد الردّ: العميلُ مايستنّاش Resend عشان يشوف «وصلنا طلبك»،
  // و`after` لا `void` - التاني بيموت مع انتهاء الطلب على serverless.
  after(async () => {
    await notifyOwnerSalesEnquiry({
      company,
      name,
      email,
      phone,
      country: str(body.country, 8),
      spendLabel: monthlySpend ? SPEND_LABEL[monthlySpend] : null,
      adAccounts,
      message: str(body.message, 4000),
      isCustomer: !!user,
    });
  });

  return NextResponse.json({ ok: true, id: row.id });
}
