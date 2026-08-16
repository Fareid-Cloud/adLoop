// lib/platformConnections.ts
//
// **من أين يأتي التوكن الذي نكلّم به هذا الحساب الإعلانيّ؟**
//
// 🔴 كان الجواب مكرَّراً أربعين مرّة في ثمانية ملفّات، بالسطر نفسه:
//
//     connectedPlatforms.find((c) => c.platform === "GOOGLE_ADS")
//
// وهو يعني حرفياً: «خذ أوّل منحة وصولٍ لهذه المنصّة، أيّاً كانت». وذلك
// صحيحٌ ما دام للمشترك منحةٌ واحدة لكلّ منصّة - وهو ما يفرضه القيد
// `@@unique([userId, platform])` اليوم. فإذا سقط ذلك القيد ليملك المشترك
// أكثر من تسجيل دخول (وكالةٌ تدير حسابات عملائها مثلاً)، صار السطر نفسه
// يختار **منحةً عشوائية** ويكلّم بها حساباً لا تملكه.
//
// ولذلك يُجمَع الحسم هنا أوّلاً: أربعون موضعاً تصير نداءً واحداً، فيكفي
// تعديلُ هذا الملفّ وحده حين تتعدّد المنح - بدل تعقّب أربعين سطراً
// متطابقاً يسهل أن يُنسى واحدٌ منها فيبقى صامتاً حتى يشتكي مشترك.
//
// ═══ منحةٌ واحدة قد تصل إلى حساباتٍ كثيرة ═══
//
// وهذا ما يجعل التصميم أدقّ من «حسابٍ واحدٍ لكلّ منصّة»: منحة جوجل عبر
// حساب إدارة (MCC) تصل إلى عشرات الحسابات الإعلانية بتوكنٍ واحد، ولذلك
// يجمع الكود روابط الحملات بـ`externalAccountId` ثمّ يستعمل توكناً واحداً
// لها جميعاً. فالمنحة ليست حساباً، بل **بابٌ** قد يفتح على حسابات.

import type { Platform } from "@prisma/client";

/** أقلّ ما نحتاجه لتمييز منحة - لا نطلب الصفّ كاملاً لئلّا يُجبر كلّ
 *  مستدعٍ على جلب حقولٍ لا يستعملها (والتوكنات منها). */
export interface ConnectionLike {
  platform: Platform | string;
  externalAccountId?: string | null;
}

/**
 * المنحة التي نكلّم بها هذا الحساب.
 *
 * @param externalAccountId الحساب الإعلانيّ المقصود إن عُرف. تمريره هو ما
 *   يجعل النداء صحيحاً حين تتعدّد المنح: منحةٌ وُسمت بهذا الحساب تفوز،
 *   وإلّا فمنحةٌ غير موسومة (بابٌ عامّ كحساب الإدارة) تصلح له.
 *
 *   وتركُه فارغاً يعني «أيّ منحةٍ لهذه المنصّة» - وهو المقبول في القراءات
 *   التي لا تخصّ حساباً بعينه (فحص صحّة الربط مثلاً)، والخطأ فيما عداها.
 */
export function pickConnection<T extends ConnectionLike>(
  connections: T[] | undefined | null,
  platform: Platform | string,
  externalAccountId?: string | null
): T | undefined {
  if (!connections?.length) return undefined;
  const ofPlatform = connections.filter((c) => c.platform === platform);
  if (ofPlatform.length === 0) return undefined;
  // منحةٌ واحدة: لا لبس، وهو الحال الغالب اليوم.
  if (ofPlatform.length === 1) return ofPlatform[0];

  if (externalAccountId) {
    const exact = ofPlatform.find((c) => c.externalAccountId === externalAccountId);
    if (exact) return exact;
  }

  // البابُ العامّ: منحةٌ غير مقيَّدة بحسابٍ بعينه تصل - نظرياً - إلى ما
  // تحتها. تُفضَّل على منحةٍ وُسمت بحسابٍ **آخر**، لأنّ الثانية ستُرفض من
  // المنصّة يقيناً بينما الأولى قد تنجح.
  return ofPlatform.find((c) => !c.externalAccountId) ?? ofPlatform[0];
}

/** كلّ منح هذه المنصّة - لواجهةٍ تعرضها، أو لفحصٍ يمرّ عليها جميعاً. */
export function connectionsForPlatform<T extends ConnectionLike>(
  connections: T[] | undefined | null,
  platform: Platform | string
): T[] {
  return (connections ?? []).filter((c) => c.platform === platform);
}
