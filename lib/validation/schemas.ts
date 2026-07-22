// lib/validation/schemas.ts
//
// أكبر فجوة في النقد الذاتي بـ SECURITY.md (قسم 22): TypeScript بيحمي
// وقت الكتابة بس، مش وقت التشغيل - JSON body من مستخدم خبيث ممكن يبقى
// أي شكل. Zod بيتأكد من الشكل الفعلي قبل ما نلمس قاعدة البيانات بيه.

import { z } from "zod";

// ==================== المصادقة ====================

// سياسة كلمة المرور: 8 أحرف على الأقل، خليط من حروف كبيرة وصغيرة وأرقام
// ورموز - كل شرط بيتفحص لوحده برسالة واضحة، عشان المستخدم يعرف بالظبط
// إيه الناقص بدل رفض عام مربك
const passwordSchema = z
  .string()
  .min(8, "كلمة المرور 8 أحرف على الأقل")
  .max(200)
  .regex(/[a-z]/, "لازم تحتوي على حرف صغير (a-z) واحد على الأقل")
  .regex(/[A-Z]/, "لازم تحتوي على حرف كبير (A-Z) واحد على الأقل")
  .regex(/[0-9]/, "لازم تحتوي على رقم واحد على الأقل")
  .regex(/[^a-zA-Z0-9]/, "لازم تحتوي على رمز واحد على الأقل (!@#$...)");

export const signupSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صحيح").max(255),
  password: passwordSchema,
  name: z.string().max(100).optional(),
  preferredLocale: z.enum(["ar", "en"]).optional(),
  turnstileToken: z.string().min(1, "الكابتشا مطلوبة"),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  newPassword: passwordSchema, // نفس قوة كلمة السر المطلوبة وقت التسجيل - مش أضعف
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

// ==================== مساحة العمل ====================
export const createWorkspaceSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب").max(100),
  industryVertical: z.string().max(50).nullable().optional(),
});

// ==================== المنتجات (محرك التسعير) ====================
export const productSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  currentPrice: z.number().positive().finite().optional(),
  cogs: z.number().nonnegative().finite().optional(),
  outboundShippingCost: z.number().nonnegative().finite().optional(),
  returnShippingCost: z.number().nonnegative().finite().optional(),
  rtoRatePct: z.number().min(0).max(100).optional(),
  avgAdCostPerOrder: z.number().nonnegative().finite().optional(),
  desiredMarginPct: z.number().min(0).max(100).optional(),
});

// ==================== أفعال الأدمن (أخطر نقطة في النظام كله) ====================
export const impersonateSchema = z.object({
  targetUserId: z.string().min(1),
});

export const suspendUserSchema = z.object({
  targetUserId: z.string().min(1),
  suspend: z.boolean(),
});

// ==================== الفيدباك ====================
export const feedbackSchema = z.object({
  message: z.string().min(3, "الرسالة قصيرة جداً").max(2000),
  category: z.enum(["bug", "feature_request", "other"]).optional(),
});

// دالة مساعدة موحّدة - بترجع خطأ 400 واضح لو الفحص فشل، بدل ما كل route
// يكتب نفس منطق try/catch لوحده
export function validateOrError<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return { success: false, error: firstIssue?.message ?? "بيانات غير صحيحة" };
  }
  return { success: true, data: result.data };
}
