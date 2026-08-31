// app/api/admin/customers/[id]/override/route.ts
//
// تعديل حدود/ميزات/سعر حساب بعينه - **الطريق الوحيد لتخصيص أي شيء لعميل.**
//
// كتالوج الباقات (`lib/plans.ts`) بيفضل في الكود بقرار صريح: تعديله من
// واجهة بيغيّر السعر المعروض لكل الزوّار وبيلمس حساب الاستحقاقات لكل
// المشتركين، وخطأ كتابة واحد فيه بيبقى حادث تسعير. أما التخصيص لحساب
// واحد فمحصور هنا، وأثره محصور فيه.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { validateOrError } from "@/lib/validation/schemas";

/**
 * الحدود العددية المسموح تخصيصها.
 *
 * **قائمة مغلقة مطابقة لـ`parseOverrides` في `lib/entitlements.ts`** - أي
 * مفتاح يتقبل هنا وما يُقرأش هناك بيتخزّن ومايأثّرش، فالمالك بيفتكر إنه
 * غيّر حاجة وهي ما اتغيّرتش. التطابق مقصود ولازم يفضل.
 */
const NUMERIC_KEYS = [
  "workspaces", "adAccounts", "monthlySpendUsd", "verifiedConversions",
  "historyMonths", "automationRules", "stores", "aiCredits", "deepScans", "savedViews",
] as const;

const numeric = z.number().int().refine((v) => v >= 0 || v === -1, "use -1 for unlimited");

const schema = z.object({
  limits: z.record(z.enum(NUMERIC_KEYS), numeric).nullable().optional(),
  features: z
    .object({
      scheduledReports: z.boolean().optional(),
      mcp: z.boolean().optional(),
      scaleKill: z.enum(["view", "apply"]).optional(),
      conversionSync: z.enum(["none", "one", "all"]).optional(),
      platforms: z.union([z.literal("all"), z.number().int().min(0)]).optional(),
    })
    .nullable()
    .optional(),
  // بالوحدة الكاملة مش السنت في الواجهة (المالك بيكتب 899 مش 89900)،
  // والتحويل هنا - رقم بالسنت في خانة إدخال بشرية وصفة لخطأ ×100.
  customPrice: z
    .object({
      amount: z.number().min(0),
      currency: z.enum(["EGP", "SAR", "USD"]),
    })
    .nullable()
    .optional(),
  // بلد الفوترة يحدّد قائمة السعر وحدها. لا يعدّله صاحبُ الحساب - وهذا
  // ما يمنع أن يختار الناس أسعارهم بأنفسهم (ثغرة B-1). سلسلة فارغة = مسح.
  billingCountry: z.string().regex(/^[A-Za-z]{2}$/).or(z.literal("")).nullable().optional(),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardAdmin(req, {
    capability: "customers.override",
    mutating: true,
    elevated: true,
  });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const body = validation.data;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { email: true, planLimitOverrides: true, featureOverrides: true, customPriceOverrideCents: true, billingCountry: true },
  });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  const changed: string[] = [];

  if (body.limits !== undefined) {
    data.planLimitOverrides = body.limits && Object.keys(body.limits).length > 0 ? body.limits : null;
    changed.push(`limits=${JSON.stringify(data.planLimitOverrides)}`);
  }
  if (body.features !== undefined) {
    data.featureOverrides = body.features && Object.keys(body.features).length > 0 ? body.features : null;
    changed.push(`features=${JSON.stringify(data.featureOverrides)}`);
  }
  if (body.billingCountry !== undefined) {
    data.billingCountry = body.billingCountry ? body.billingCountry.toUpperCase() : null;
    changed.push(`billingCountry=${data.billingCountry ?? "null"}`);
  }
  if (body.customPrice !== undefined) {
    if (body.customPrice === null) {
      data.customPriceOverrideCents = null;
      data.customPriceCurrency = null;
      changed.push("customPrice=cleared");
    } else {
      data.customPriceOverrideCents = Math.round(body.customPrice.amount * 100);
      data.customPriceCurrency = body.customPrice.currency;
      changed.push(`customPrice=${body.customPrice.amount} ${body.customPrice.currency}`);
    }
  }

  if (changed.length === 0) {
    return NextResponse.json({ error: "nothing to change" }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data });

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "OVERRIDE_ENTITLEMENTS",
    targetUserId: id,
    details: `${guard.admin.email} → ${target.email}: ${changed.join("; ")}${body.note ? ` — ${body.note}` : ""}`,
  });

  return NextResponse.json({ success: true });
}
