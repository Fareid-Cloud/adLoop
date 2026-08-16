// lib/oauthState.ts
//
// حماية من CSRF في تدفقات الـ OAuth - بدل ما نخزن "state" في قاعدة بيانات
// أو جلسة سيرفر مؤقتة، بنوقّعه كـ JWT قصير العمر يحمل userId + رمز عشوائي.
// المنصة (جوجل/ميتا) بترجعه لنا زي ما هو في الـ callback، ونتحقق من التوقيع
// والصلاحية قبل ما نكمل - بيثبت إن الطلب راجع من نفس المستخدم اللي بدأ
// العملية، مش حد تاني بيحاول يخترق الـ redirect.
//
// ═══ ولماذا يحمل النيّة أيضاً ═══
//
// بعد أن صار المشترك يملك أكثر من تسجيل دخولٍ للمنصّة الواحدة، لم يعد
// ردّ المنصّة كافياً لتحديد ما يجب فعله به: أهو **تجديد** صلاحيةٍ منتهية
// لمنحةٍ قائمة، أم **منحة ثانية** لحساب عميلٍ آخر؟ الردّ نفسه واحد في
// الحالتين، والفرق في نيّة من ضغط الزرّ - فتُحمل معه.
//
// وتحميلها هنا لا في `?query` مقصود: هذا الحقل موقَّع، فلا يستطيع أحد
// تحويل «جدِّد منحتي» إلى «أنشئ منحة» ولا الإشارة إلى منحة غيره.

import jwt from "jsonwebtoken";
import crypto from "crypto";

export interface OAuthIntent {
  /** منحةٌ بعينها يُراد تجديدها. يُقدَّم على ما عداه. */
  connectionId?: string;
  /** طلبٌ صريح بمنحةٍ إضافية - لا استبدال القائمة. */
  addNew?: boolean;
}

export function createOAuthState(userId: string, intent: OAuthIntent = {}): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  return jwt.sign(
    {
      userId,
      nonce,
      ...(intent.connectionId ? { cid: intent.connectionId } : {}),
      ...(intent.addNew ? { add: true } : {}),
    },
    process.env.JWT_SECRET!,
    { expiresIn: "10m" }
  );
}

export function verifyOAuthState(
  state: string
): { userId: string; connectionId?: string; addNew: boolean } | null {
  try {
    const payload = jwt.verify(state, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as {
      userId: string;
      nonce: string;
      cid?: string;
      add?: boolean;
    };
    return {
      userId: payload.userId,
      connectionId: payload.cid,
      addNew: payload.add === true,
    };
  } catch {
    return null; // منتهي الصلاحية، أو موقّع غلط، أو اتلاعب بيه
  }
}
