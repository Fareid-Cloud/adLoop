// lib/oauthGrant.ts
//
// **أيّ صفٍّ نكتب فيه ما عاد به المستخدم من المنصّة؟**
//
// كان الجواب `upsert` على `userId_platform`: صفٌّ واحدٌ لكلّ منصّة، فأيّ
// موافقةٍ جديدة تكتب فوقه. وذلك صحيحٌ ما دام المشترك لا يملك إلّا تسجيل
// دخولٍ واحد - فإذا ملك اثنين، صارت الموافقة الثانية **تمحو الأولى**:
// حساب العميل الأوّل يتوقّف عن المزامنة، بلا رسالةٍ ولا سجلٍّ ولا شيءٍ
// يدلّ على ما جرى.
//
// ولذلك تُحسَم النيّة أوّلاً، ثمّ يُكتب الصفّ:
//
//   منحةٌ مُشار إليها  → جدِّدها هي (وقد ضغط «إعادة الربط» عليها بعينها)
//   طلبٌ صريح بإضافة   → أنشئ منحةً جديدة
//   منحةٌ واحدة قائمة  → جدِّدها (وهو ما كان يحدث دائماً، فلا يتغيّر شيء)
//   أكثر من منحة       → أنشئ جديدة
//
// والسطر الأخير هو موضع الحكم: حين تتعدّد المنح ولا نيّة معنا، فالكتابة
// فوق إحداها اختيارٌ عشوائيّ قد يمحو منحة عميلٍ آخر بتوكن عميلٍ ثالث -
// وهو العطب نفسه الذي جئنا نصلحه. أمّا المنحة الزائدة فيراها المشترك في
// القائمة ويحذفها. **العطب الظاهر أهون من الصامت.**

import { prisma } from "@/lib/prisma";
import type { Platform } from "@prisma/client";

export type GrantTarget = { mode: "update"; id: string } | { mode: "create" };

export async function resolveGrantTarget(opts: {
  userId: string;
  platform: Platform;
  /** من `state` الموقَّع - لا من `?query` */
  connectionId?: string;
  addNew: boolean;
}): Promise<GrantTarget> {
  const { userId, platform, connectionId, addNew } = opts;

  if (connectionId) {
    // الملكية تُتحقَّق هنا لا في المستدعي: `connectionId` وإن جاء موقَّعاً
    // فقد تكون المنحة حُذفت بين بدء التدفّق والعودة منه.
    const owned = await prisma.connectedPlatform.findFirst({
      where: { id: connectionId, userId, platform },
      select: { id: true },
    });
    if (owned) return { mode: "update", id: owned.id };
    // اختفت: نكمل بمنطق «بلا نيّة» بدل أن نفشل بعد أن وافق المستخدم فعلاً.
  }

  if (addNew) return { mode: "create" };

  const existing = await prisma.connectedPlatform.findMany({
    where: { userId, platform },
    select: { id: true },
    orderBy: { connectedAt: "asc" },
  });

  if (existing.length === 1) return { mode: "update", id: existing[0].id };
  return { mode: "create" };
}

/**
 * تسجيل ما تصله المنحة من حسابات إعلانية.
 *
 * يُنادى من `available-campaigns` وحده - وهو يسأل المنصّة عن حساباتها
 * بالفعل ليعرضها للاختيار. **فالحفظ لا يكلّف نداءً واحداً إضافياً**، وهو
 * ما يجعله يستحقّ وجوده: بدونه ترى الواجهة «جوجل» و«جوجل» ولا تعرف
 * أيّهما حساب أيّ عميل.
 *
 * **لا يحذف ما لم يعد يُرى.** غيابُ حسابٍ عن ردٍّ واحد قد يكون انقطاعاً
 * لحظياً أو صلاحيةً نقصت مؤقّتاً، وحذفُه يمحو الاسم الذي يعرف به المشترك
 * منحته. `lastSeenAt` يقول متى رُئي آخر مرّة، والواجهة تعرض ذلك.
 *
 * **أفضل جهد**: هذا تحسينُ عرضٍ لا شرطُ صحّة، فلا يجوز أن يُسقط طلب
 * المستخدم لاختيار الحملات إن فشل.
 */
export async function recordDiscoveredAccounts(
  connectionId: string,
  platform: Platform,
  accounts: Array<{ externalAccountId: string; name?: string | null }>
): Promise<void> {
  if (accounts.length === 0) return;
  try {
    const now = new Date();
    await Promise.all(
      accounts.map((a) =>
        prisma.connectedAccount.upsert({
          where: {
            connectionId_externalAccountId: {
              connectionId,
              externalAccountId: a.externalAccountId,
            },
          },
          create: {
            connectionId,
            platform,
            externalAccountId: a.externalAccountId,
            name: a.name ?? null,
            lastSeenAt: now,
          },
          update: { name: a.name ?? undefined, lastSeenAt: now },
        })
      )
    );
  } catch (err) {
    console.error("تعذّر تسجيل الحسابات المكتشفة للمنحة", connectionId, err);
  }
}
