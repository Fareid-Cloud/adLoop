// lib/dataCurrency.ts
//
// عملة الأرقام: تُلتقط من الحساب الإعلانيّ ولا تُختار.
//
// **العلّة التي عالجها هذا الملفّ:** كانت العملة قائمة اختيارٍ حرّة في
// الإعدادات، بينما الأرقام تصل من جوجل وميتا **بعملة الحساب الإعلانيّ**
// وتُخزَّن كما هي. فمن بدّل القائمة بدّل اللافتة وحدها: يقرأ «ج.م» فوق
// أرقامٍ ريالات. لم نكن نحوّل المال، كنّا نُعيد تسميته.
//
// **ولماذا لا تُحوَّل ببساطة عند العرض؟** لأنّ العملة في هذا السياق ليست
// تفضيلاً بل خاصّية في البيانات: جوجل وميتا تُثبتان عملة الحساب عند
// إنشائه ولا تسمحان بتغييرها، والفاتورة تُدفع بها. فالصادق أن تُعرَض كما
// هي - وهو ما تفعله لوحتا جوجل وميتا نفساهما.
//
// ولذلك: `dataCurrency` تُملأ من المنصّة، و`currency` تتبعها.

import { prisma } from "@/lib/prisma";

/**
 * يسجّل عملة الحساب الإعلانيّ على المساحة.
 *
 * **أوّل التقاطٍ يُثبّت العرض عليه.** وما بعده لا يُصمت عنه: مساحةٌ تجمع
 * حسابين بعملتين مختلفتين تجمع تفّاحاً ببرتقال في كلّ مجموع في المنتج -
 * فيُسجَّل تحذيرٌ صريح بدل أن يمرّ الخلط بلا أثر.
 *
 * لا ترمي أبداً: التقاط العملة تحسينٌ على هامش المزامنة، وفشلُه لا يجوز
 * أن يُسقط سحب بيانات يومٍ كامل.
 */
export async function recordDataCurrency(
  workspaceId: string,
  platform: string,
  currency: string | null | undefined,
): Promise<void> {
  const code = currency?.trim().toUpperCase();
  if (!code || code.length !== 3) return;

  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { dataCurrency: true, isDemo: true },
    });
    if (!ws || ws.isDemo) return;

    if (!ws.dataCurrency) {
      // أوّل مرّة: تُكتب العملتان معاً. `currency` وحدها كانت ستبقى على
      // الافتراضيّ (SAR) فوق أرقامٍ بعملةٍ أخرى - وهي العلّة نفسها.
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { dataCurrency: code, currency: code },
      });
      return;
    }

    if (ws.dataCurrency !== code) {
      console.warn(
        `[dataCurrency] المساحة ${workspaceId}: ${platform} يُرسل بـ${code} بينما المخزَّن ${ws.dataCurrency}. ` +
          `المجاميع عبر المنصّتين تخلط عملتين - يلزم فصل الحسابين في مساحتين.`,
      );
    }
  } catch (err) {
    console.error("[dataCurrency] تعذّر تسجيل عملة الحساب:", err);
  }
}
