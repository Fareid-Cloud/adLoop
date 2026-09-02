// lib/workspaceAccess.ts
//
// نقطة الاختناق الوحيدة لسؤال: **هل يصل هذا المستخدم إلى هذه المساحة؟**
//
// 🔴 كان الجواب مكتوباً بيدٍ في أربعةٍ وخمسين موضعاً تحت `app/api`، وهي
// أربعةٌ وخمسون فرصةً للنسيان - نمط BOLA بعينه المرصود في المراجعة
// الأمنية. والموضع المنسيّ لا يشكو: يعمل تماماً لصاحب المساحة، ولا يظهر
// إلّا حين يجرّبه من ليست له.
//
// ✅ **والمقاعد وصلت، وتغيّرت هنا وحدها** - كما وُعد في هذا الملفّ نفسه.
// الشرط صار: صاحبُ المساحة، **أو** عضوٌ فيها. أربعةٌ وخمسون موضعاً ورثوا
// التغيير بلا لمسة، وهذا هو المقابل الذي دُفع ثمنُه يوم صار للسؤال جوابٌ
// واحد.
//
// ── ما لا يخصّه ──────────────────────────────────────────────────
// ثلاثةٌ وثلاثون موضعاً آخر تفحص `userId` لبياناتٍ **شخصية** لا مساحيّة:
// أكواد التحقّق الاحتياطية، تفضيلات الحساب، الاشتراك. تلك تبقى على
// المستخدم نفسه ولا تعبر إلى عضوٍ أبداً، فلا تمرّ من هنا - ومرورُها كان
// سيمنح عضواً مقعده في مساحةٍ حقَّ تعديل حساب مالكها.

import type { Prisma } from "@prisma/client";

/** الدوران المتاحان لعضو المساحة. المالك ليس عضواً - هو فوقهما. */
export type MemberRole = "VIEWER" | "OPERATOR";

/** شرط الوصول - يُدمج في `where` بدل أن يُكتب `userId` بيد.
 *
 *  يُعاد كائناً لا سلسلةً كي تبقى أنواع Prisma قائمةً على مواضع النداء:
 *  خطأٌ في اسم حقلٍ هنا يظهر عند الترجمة لا عند التشغيل. */
export function workspaceAccessFilter(userId: string): Prisma.WorkspaceWhereInput {
  return {
    OR: [
      { userId },
      { members: { some: { userId } } },
    ],
  };
}

/** الوصول إلى المساحة نفسها: `where: { id, ...workspaceAccess(userId) }`.
 *
 *  اسمٌ ثانٍ للدالة نفسها ليُقرأ الاستدعاء عند المساحة كما يُقرأ عند
 *  تابعها، فلا يتردّد قارئُ الكود أيَّهما يستعمل. */
export const workspaceAccess = workspaceAccessFilter;

/**
 * 🔴 **صفٌّ شخصيّ لا مساحيّ - يبقى على صاحبه ولا يعبر إلى عضو.**
 *
 * الفلتر فوق كان يُستعمَل على جداول تابعة عندها `userId` خاصّ بيها،
 * فكان يقرأ صحيحاً بالصدفة: `{ userId }` واحدة في الحالتين. ولمّا وصلت
 * المقاعد انكشف الخلط - وهو خلطٌ في المعنى لا في النوع فقط:
 *
 *   • **محادثات الوكيل** (`AgentChat`) شخصيّة: صاحبُ الحساب بيسأل عن
 *     شغله، وزميلٌ في نفس المساحة مالوش أن يقراها. مقعدٌ في مساحةٍ مش
 *     إذنَ اطّلاعٍ على أسئلةِ مالكها.
 *   • **الآراء المحفوظة** (`SavedReportView`) شخصيّة كذلك: ترتيبُ أعمدةٍ
 *     يخصّ من رتّبه.
 *
 * فتُسمّى الحالة باسمها بدل ما تتخفّى تحت اسمٍ يقول «مساحة».
 */
export function ownRowFilter(userId: string): { userId: string } {
  return { userId };
}

/**
 * 🔴 **الوصول ليس الصلاحية.**
 *
 * الفلتر فوق يجيب «هل يرى؟». وهذا يجيب «هل يكتب؟» - وهما سؤالان مختلفان
 * تماماً: مقعدُ الاطّلاع (`VIEWER`) يفتح كلَّ شاشة ولا يحرّك جنيهاً واحداً
 * في حساب إعلانات.
 *
 * وخلطُهما كان سيجعل كلَّ مقعدٍ نبيعه مقعدَ تنفيذ - أي أنّ عشرة مقاعد
 * «اطّلاع مجّاني» في الباقة تصير عشرة أشخاص يقدرون يوقفوا حملة.
 */
/**
 * 🔴 **المالكُ وحده - لا عضو ولو كان OPERATOR.**
 *
 * لأفعالٍ بتغيّر مَن يقدر يعمل إيه: إدارةُ المقاعد، الفوترة، حذفُ
 * المساحة. لو عضوٌ قدر يدعو أعضاء، يبقى قدر يوسّع الوصول لنفسه بحدّ
 * تاني - والحدُّ اللي الباقة بتبيعه يبقى بلا معنى.
 *
 * وبيعدّي من هنا لا بيتكتب بيد، عشان يفضل لسؤال الوصول جوابٌ واحد
 * مقروء - حتى لمّا الجواب يكون «المالك بس».
 */
export function workspaceOwnerFilter(userId: string): Prisma.WorkspaceWhereInput {
  return { userId };
}

export function workspaceWriteFilter(userId: string): Prisma.WorkspaceWhereInput {
  return {
    OR: [
      // المالك: كتابةٌ كاملة دائماً.
      { userId },
      // العضو: التنفيذ وحده. `VIEWER` لا يمرّ من هنا إطلاقاً.
      { members: { some: { userId, role: "OPERATOR" } } },
    ],
  };
}

/** دورُ المستخدم في مساحةٍ بعينها - أو `null` لو مالوش وصولٌ أصلاً. */
export type WorkspaceRole = "OWNER" | MemberRole;

export async function roleInWorkspace(
  db: {
    workspace: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
    workspaceMember: { findUnique: (args: unknown) => Promise<{ role: string } | null> };
  },
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const owned = await db.workspace.findFirst({
    where: { id: workspaceId, userId },
    select: { id: true },
  });
  if (owned) return "OWNER";

  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  if (!member) return null;
  return member.role === "OPERATOR" ? "OPERATOR" : "VIEWER";
}


// ══════════════════════════════════════════════════════════════════════
// فرضُ الاطّلاع-فقط
// ══════════════════════════════════════════════════════════════════════
//
// **مش في الوسيط، والسبب تقنيّ لا اختياريّ:** `proxy.ts` بيشتغل على Edge
// حيث لا وصولَ لقاعدة البيانات، والدورُ صفٌّ فيها. فحارسُ «العرض كـ»
// اللي هناك بيقرا الجلسة وحدها، وده مش كافٍ هنا.
//
// فالفرضُ عند نقطة الكتابة - وبنفس منطق حارس الديمو: بيتحطّ عند **تعريف**
// دالّة الكتابة لا عند مستدعيها، فأيّ نداءٍ جديد بيرثه تلقائياً. (راجع
// `lib/demo.ts` - نفس الدرس اتعلّم هناك بعد ما اتكشفت دالّتان مكشوفتان.)

export class ViewerWriteBlocked extends Error {
  readonly isViewerBlock = true;
  constructor() {
    super("This account has view-only access to this workspace.");
    this.name = "ViewerWriteBlocked";
  }
}

/**
 * يرمي لو المستخدم **مقعدُ اطّلاع** في المساحة دي.
 *
 * بيمرّ صامتاً للمالك وللـ`OPERATOR`، وبيمرّ كمان لمن لا علاقة له
 * بالمساحة أصلاً - **عن قصد**: الوصولُ مسؤوليةُ `workspaceAccessFilter`،
 * وتكرارُه هنا بيخلّي نفس السؤال له جوابان يفترقان. ده حارسُ **دور** لا
 * حارسُ وصول.
 */
export async function assertNotViewer(
  db: { workspaceMember: { findUnique: (args: unknown) => Promise<{ role: string } | null> } },
  workspaceId: string,
  userId: string
): Promise<void> {
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  if (member && member.role !== "OPERATOR") throw new ViewerWriteBlocked();
}
