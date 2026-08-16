// lib/ecommerce/resolveStore.ts
//
// **مِن أيّ متجرٍ جاء هذا الويب هوك، ومَن يملكه؟**
//
// 🔴 كان الجواب `findFirst({ platform, active: true })` في موضعين
// (مسار الويب هوك و`ingestOrder`) - بلا `workspaceId` أصلاً. أي أنّ أوّل
// مشتركٍ على المنصّة يبتلع كلّ ويب هوكاتها: توقيع الثاني يُفحص بمفتاح
// الأوّل فيُرفض `401`، ومتجره **لا يوصّل طلباً واحداً بلا رسالةٍ تشرح
// السبب**. عيبٌ لا يظهر بمشتركٍ واحد، ويظهر يوم يأتي الثاني - أي يوم
// يصير المنتج منتجاً.
//
// ═══ لماذا السرّ هو الحاسم لا المعرّف ═══
//
// المعرّف (نطاق شوبيفاي، عنوان ووكومرس...) يصل في **ترويسةٍ يستطيع أيّ
// أحدٍ ادّعاءها**. فلا يُبنى عليه قرار ملكية وحده. أمّا سرّ الويب هوك
// فلكلّ مساحة عملٍ سرّها، ولا يُنتج توقيعاً صحيحاً إلّا صاحبه.
//
// فالمعرّف **مسار سريع**، والسرّ **هو الإثبات**:
//
//   ١) بمعرّف مطابق: ربطٌ واحد → يُفحص توقيعه → قبول أو رفض. لا مسح.
//   ٢) بلا معرّف مطابق (منصّة بلا معرّف معروف، أو ربطٌ قديم لم يُوسَم
//      بعد): تُجرَّب الروابط غير الموسومة، ومَن يصحّ توقيعه فهو المالك -
//      ثمّ **يُوسَم بمعرّفه** فلا يتكرّر المسح له أبداً.
//
// وهذا يجعل المنصّات الخمس تعمل صحيحاً **ولو جهلنا معرّف بعضها**
// (إيزي أوردرز مثلاً)، ويهاجر الموجود بنفسه بلا خطوةٍ من أحد.

import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";
import { verifySignature } from "./adapters";
import type { EcommercePlatform } from "./types";

/** سقف الروابط غير الموسومة التي تُجرَّب في طلبٍ واحد.
 *
 *  بدونه يستطيع أحدهم أن يجعل كلّ طلبٍ مزوَّر يحسب دوالّ تجزئة بعدد
 *  مشتركي المنصّة كلّهم. والسقف لا يضرّ الحالة الشرعية: الرابط يُوسَم
 *  بعد أوّل رسالة ناجحة فيخرج من المسح نهائياً. */
const MAX_UNTAGGED_CANDIDATES = 25;

export interface ResolvedStore {
  connectionId: string;
  workspaceId: string;
}

export async function resolveStoreConnection(
  platform: EcommercePlatform,
  storeIdentifier: string | null,
  rawBody: string,
  headers: Headers
): Promise<ResolvedStore | null> {
  // ═══ ١) المسار السريع: معرّفٌ معروفٌ موسومٌ من قبل ═══
  if (storeIdentifier) {
    const tagged = await prisma.ecommerceConnection.findFirst({
      where: { platform: platform as never, storeIdentifier, active: true },
      select: { id: true, workspaceId: true, webhookSecret: true, webhookUsername: true },
    });
    if (tagged) {
      // وُجد صاحب المعرّف - فالتوقيع إمّا يثبته أو يُرفض الطلب. ولا
      // نعود إلى المسح: طلبٌ يدّعي متجراً ثمّ يفشل توقيعه مرفوضٌ، لا
      // فرصةَ له في أن يُجرَّب على أسرار الآخرين.
      const secret = tagged.webhookSecret ? decryptToken(tagged.webhookSecret) : undefined;
      if (!verifySignature(platform, rawBody, headers, secret, tagged.webhookUsername)) return null;
      return { connectionId: tagged.id, workspaceId: tagged.workspaceId };
    }
  }

  // ═══ ٢) المسار البطيء مرّةً واحدة: مَن يصحّ سرّه فهو المالك ═══
  const untagged = await prisma.ecommerceConnection.findMany({
    where: { platform: platform as never, active: true, storeIdentifier: null },
    select: { id: true, workspaceId: true, webhookSecret: true, webhookUsername: true },
    orderBy: { createdAt: "asc" },
    take: MAX_UNTAGGED_CANDIDATES,
  });

  for (const candidate of untagged) {
    const secret = candidate.webhookSecret ? decryptToken(candidate.webhookSecret) : undefined;
    if (!verifySignature(platform, rawBody, headers, secret, candidate.webhookUsername)) continue;

    // وسمٌ يحدث مرّةً واحدة في عمر الربط. `updateMany` بشرط `null` تمنع
    // سباق رسالتين متزامنتين من متجرين مختلفين على الربط نفسه: الأولى
    // تسم، والثانية لا تجد شرطها فلا تكتب فوقها.
    if (storeIdentifier) {
      await prisma.ecommerceConnection.updateMany({
        where: { id: candidate.id, storeIdentifier: null },
        data: { storeIdentifier },
      });
    }
    return { connectionId: candidate.id, workspaceId: candidate.workspaceId };
  }

  return null;
}
