// lib/mfaStepUp.ts
//
// **تأكيدُ الهويّة قبل المساس بالتحقّق بخطوتين - بأيّ عاملٍ يملكه صاحبُ
// الحساب فعلاً، لا بكلمة السرّ وحدها.**
//
// 🔴 **العطلُ الذي أوجد هذا الملفّ:** مسارا «أضِف تطبيقاً» و«عطّل التحقّق»
// كانا يشترطان كلمةَ سرّ. ومَن دخل بجوجل أو فيسبوك **ليس له كلمةُ سرّ من
// الأساس**، فكان يقرأ: «حسابك لا يملك كلمة سرّ، فالتأكيدُ غير متاح -
// تواصل معنا لتعطيل التحقّق». أي أنّ أكثرَ المستخدمين أماناً - المفعِّلَ
// للتحقّق بخطوتين - هو وحدَه الممنوعُ من إدارته.
//
// **وما بعد الرسالة أسوأ من الرسالة:** «تواصل معنا» يحوّل قراراً أمنيّاً
// إلى محادثةِ دعم، وهي أضعفُ حلقةٍ ممكنة. مَن ينتحل شخصيةَ العميل ويطلب
// التعطيل يواجه موظّفاً يحكم بانطباعه، لا نظاماً يطلب دليلاً. بنينا
// التحقّقَ بخطوتين ثمّ جعلنا إلغاءَه مكالمةً.
//
// **الحلّ: العاملُ الموجود بالفعل.** مَن فعّل التحقّق يملك تطبيقاً يولّد
// رمزاً كلَّ ثلاثين ثانية. وطلبُ رمزٍ حاليٍّ منه يثبت حيازةَ الجهاز
// المسجَّل - وهو **أقوى** من إعادة كتابة كلمة سرّ، لا أضعف: كلمةُ السرّ
// شيءٌ تعرفه وقد يكون مسرَّباً في تسريبٍ لموقعٍ آخر، والرمزُ شيءٌ تملكه
// الآن. وهذا بالضبط ما تفعله جوجل وجيتهاب ومايكروسوفت لحسابات الدخول
// الموحَّد.
//
// **ولماذا لا نعيد المصادقة عبر جوجل بدلاً من ذلك؟** لأنّ المتصفّح يُبقي
// جلسةَ جوجل مفتوحة، فـ«إعادةُ المصادقة» تصير ضغطةً واحدة بلا إدخال أيّ
// بيانات - تُثبت أنّ المتصفّح مسجَّلُ الدخول، لا أنّ الجالسَ أمامه هو
// صاحبُ الحساب. وهو ما نحاول إثباتَه بالضبط.
//
// **ولماذا لا نمرّره بلا تأكيدٍ ما دام لا يملك كلمةَ سرّ؟** لأنّ جلسةً
// مسروقةً تفتح هذه الشاشة. وبلا شرطٍ يقدر حاملُها أن يسجّل تطبيقَ مصادقةٍ
// خاصّاً به - فيرث الحمايةَ بدل أن تصدَّه - أو يعطّلَ التحقّق فيقفل صاحبَ
// الحساب خارجه نهائياً. **الغيابُ هنا استيلاءٌ كامل، لا تسهيل.**
//
// الترتيب: كلمةُ السرّ لمن له كلمةُ سرّ، أو رمزٌ حاليّ من التطبيق، أو كودُ
// استرجاعٍ **يُحرَق** عند استعماله. وأيُّ واحدٍ منها يكفي - كلُّها تثبت
// الشيءَ نفسه.

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { decryptMfaSecret, verifyMfaCode, matchBackupCode } from "@/lib/mfa";

/** ما يقبله التأكيد. كلُّها اختيارية: المرسِل يبعث ما يملكه. */
export interface StepUpProof {
  password?: unknown;
  /** رمزٌ حاليّ من تطبيق المصادقة المسجَّل */
  code?: unknown;
  /** كودُ استرجاعٍ من الورقة المحفوظة - يُستهلك */
  backupCode?: unknown;
}

export type StepUpResult =
  | { ok: true; usedBackupCode: boolean }
  /** `key` مفتاحُ ترجمةٍ تحت `apiErr.` - النصّ يُبنى في المسار بلغة المستخدم */
  | { ok: false; key: string; status: 400 | 401 };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * يتحقّق من أنّ صاحبَ الجلسة هو صاحبُ الحساب فعلاً، قبل تغييرٍ في إعدادات
 * التحقّق بخطوتين.
 *
 * **يُنادى بعد حدّ المعدّل لا قبله**: كلُّ فرعٍ هنا بابُ تخمين.
 */
export async function verifyMfaStepUp(
  user: { id: string; passwordHash: string | null; mfaSecret: string | null },
  proof: StepUpProof
): Promise<StepUpResult> {
  const password = str(proof.password);
  const code = str(proof.code);
  const backupCode = str(proof.backupCode);

  if (!password && !code && !backupCode) {
    return { ok: false, key: "mfaStepUpRequired", status: 400 };
  }

  // ١) كلمةُ السرّ - لمن يملكها. ومَن لا يملكها يسقط إلى الفرعين التاليين
  //    بدل أن يُرفض، وهو الفرقُ كلُّه عن النسخة السابقة.
  if (password) {
    if (!user.passwordHash) return { ok: false, key: "mfaNoPassword", status: 400 };
    if (await bcrypt.compare(password, user.passwordHash)) {
      return { ok: true, usedBackupCode: false };
    }
    return { ok: false, key: "wrongPassword", status: 401 };
  }

  // ٢) رمزٌ حاليّ من التطبيق المسجَّل - حيازةُ الجهاز.
  if (code) {
    if (!user.mfaSecret) return { ok: false, key: "mfaNotEnabled", status: 400 };
    const secret = decryptMfaSecret(user.mfaSecret);
    if (await verifyMfaCode(secret, code)) {
      return { ok: true, usedBackupCode: false };
    }
    return { ok: false, key: "codeInvalid", status: 401 };
  }

  // ٣) كودُ استرجاع - لمن فقد الجهاز. **يُحرَق فوراً**: كودٌ يُقبل مرّتين
  //    ورقةٌ مسرَّبةٌ تعمل إلى الأبد.
  const stored = await prisma.mfaBackupCode.findMany({
    // المعلَّقة ليست فعّالةً بعد: مجموعةٌ وُلّدت ولم يُقَرّ بحفظها
    // لا تصلح دليلاً - قبولُها يجعل التوليدَ وحدَه كافياً للتأكيد.
    where: { userId: user.id, usedAt: null, pendingUntilConfirmed: false },
    select: { id: true, codeHash: true },
  });
  const matchedId = await matchBackupCode(backupCode, stored);
  if (!matchedId) return { ok: false, key: "backupCodeInvalid", status: 401 };

  await prisma.mfaBackupCode.update({
    where: { id: matchedId },
    data: { usedAt: new Date() },
  });
  return { ok: true, usedBackupCode: true };
}
