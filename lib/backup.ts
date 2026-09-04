// lib/backup.ts
//
// نسخةٌ احتياطية مستقلّة عن مزوّد قاعدة البيانات، في Vercel Blob.
//
// ═══ ما الذي يُنسَخ، ولماذا هذا بالذات ═══
//
// 🔴 **كانت أربعة جداول من سبعةٍ وثمانين، وسقط منها الجوهر.**
//
// المنطق المكتوب كان صحيحاً - «انسخ ما لا سبيل لإعادة بنائه، ودع أرقام
// الأداء فهي تُسحَب ثانيةً من المنصّات» - لكنّ تطبيقه لم يتبعه: أرقامُ
// الأداء استُثنيت بحقّ، ثمّ استُثني معها **كلُّ ما لا مصدر خارجيّ له
// أصلاً**. التحقّقاتُ والإسنادُ والدعمُ والدفعاتُ وسجلُّ التدقيق لا تُسحَب
// من جوجل ولا من ميتا ولا من أيّ مكان: إن ضاعت، ضاعت.
//
// القاعدةُ الآن صريحة: **يُنسَخ ما لا يمكن إعادةُ بنائه من مصدرٍ خارجيّ.**
//   • لا يُنسَخ: `MetricSnapshot` وإخوتُها (تُعاد مزامنتُها من المنصّة).
//   • يُنسَخ: التحقّق، والإسناد، والمقاعد، والدعم، والفلوس، والتدقيق،
//     والمنافسون، والمنتجات، والقواعد، والتقارير المحفوظة.
//
// ═══ ما لا يُنسَخ أبداً ═══
//
// كلمةُ السرّ وسرُّ التحقّق بخطوتين وتوكناتُ المنصّات وتوكنُ الكارت -
// حتى وهي مشفّرة. النسخةُ الاحتياطية ملفٌّ يعيش خارج النظام، وأقلُّ ما
// يحمله من مفاتيح أفضل. وفقدانُها يعني إعادةَ ربطٍ وإعادةَ تعيين كلمة
// سرّ، وهو ثمنٌ أرخص بكثير من تسريبها.
//
// ═══ حدٌّ صريح ═══
//
// هذه شبكةُ أمانٍ لا خطّةَ تعافٍ كاملة: كلُّ جدولٍ مقصوصٌ عند سقف، والقصُّ
// **يُعلَن في الملفّ نفسه** (`truncated`) بدل أن يمرّ صامتاً فيُظنّ الملفُّ
// كاملاً وهو ناقص.

import { put, list, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/** سقفُ الصفوف لكلّ جدول. رقمٌ واحد يحكم الجميع: ملفٌّ يتجاوز حجماً
 *  معقولاً يصير عبئاً على الرفع والقراءة معاً. */
const ROW_CAP = 20_000;

export interface BackupSummary {
  success: boolean;
  url?: string;
  error?: string;
  /** عدد الصفوف لكلّ جدول - يُقرأ في اللوحة فيُعرَف ما الذي حُفظ فعلاً. */
  counts?: Record<string, number>;
  /** الجداول التي بلغت السقف فقُصَّت. */
  truncated?: string[];
}

export async function backupCriticalData(): Promise<BackupSummary> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { success: false, error: "BLOB_READ_WRITE_TOKEN غير مضبوط - النسخ الاحتياطي متوقف" };
  }

  try {
    const take = ROW_CAP;

    const [
      users, workspaces, connectedPlatforms, products, productSales,
      members, invites, verifications, campaignLinks, valueConfigs,
      threads, messages, notes, ratings,
      payments, subscriptionEvents, auditLog,
      competitors, competitorAds, automationRules, savedViews, reportViews,
      salesEnquiries, customers, orders,
    ] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true, email: true, name: true, createdAt: true, isAdmin: true,
          adminRole: true, subscriptionPlan: true, subscriptionStatus: true,
          currentPeriodEnd: true, billingCountry: true, preferredLocale: true,
          isSuspended: true, isVip: true, planLimitOverrides: true,
          featureOverrides: true, customPriceOverrideCents: true,
          // 🔴 `passwordHash` و`mfaSecret` و`savedCardToken` مستبعدةٌ عمداً -
          // راجع رأس الملفّ. فقدانُها يعني إعادةَ تعيين، لا كارثة.
        },
        take,
      }),
      prisma.workspace.findMany({ take }),
      prisma.connectedPlatform.findMany({
        select: { id: true, userId: true, platform: true, expiresAt: true, connectedAt: true },
        take,
      }),
      prisma.product.findMany({ take }),
      prisma.productSaleEvent.findMany({ take }),
      prisma.workspaceMember.findMany({ take }),
      prisma.workspaceInvite.findMany({
        select: { id: true, workspaceId: true, email: true, role: true, expiresAt: true, acceptedAt: true, invitedById: true, createdAt: true },
        take,
      }),
      // **قلبُ المنتج.** ما لا يوجد في أيّ منصّةٍ خارجية: أيُّ تحويلٍ
      // أمكن إثباتُه فعلاً. ضياعُه يمحو ادّعاءَ المنتج نفسه.
      prisma.conversionVerification.findMany({ take }),
      prisma.campaignLink.findMany({ take }),
      prisma.conversionValueConfig.findMany({ take }),
      prisma.supportThread.findMany({ take }),
      prisma.supportMessage.findMany({ take }),
      prisma.supportNote.findMany({ take }),
      prisma.supportRating.findMany({ take }),
      prisma.paymentIntent.findMany({ take }),
      prisma.subscriptionEvent.findMany({ take }),
      prisma.adminAuditLog.findMany({ take }),
      prisma.competitor.findMany({ take }),
      prisma.competitorAd.findMany({ take }),
      prisma.automationRule.findMany({ take }),
      prisma.savedView.findMany({ take }),
      prisma.savedReportView.findMany({ take }),
      prisma.salesEnquiry.findMany({ take }),
      prisma.customer.findMany({ take }),
      prisma.order.findMany({ take }),
    ]);

    const tables: Record<string, unknown[]> = {
      users, workspaces, connectedPlatforms, products, productSales,
      members, invites, verifications, campaignLinks, valueConfigs,
      threads, messages, notes, ratings,
      payments, subscriptionEvents, auditLog,
      competitors, competitorAds, automationRules, savedViews, reportViews,
      salesEnquiries, customers, orders,
    };

    const counts: Record<string, number> = {};
    const truncated: string[] = [];
    for (const [name, rows] of Object.entries(tables)) {
      counts[name] = rows.length;
      if (rows.length >= ROW_CAP) truncated.push(name);
    }

    const backupData = {
      backedUpAt: new Date().toISOString(),
      /** نسخةُ الصيغة - أيُّ استعادةٍ تفحصها قبل أن تثق بالملفّ. */
      format: 2,
      rowCap: ROW_CAP,
      counts,
      truncated,
      ...tables,
    };

    // إصلاح حرج من اختبار الاختراق: كان الاسم متوقّعاً تماماً (بالتاريخ
    // بس) والوصول "public" - يعني أي حد يعرف النمط يقدر يحمّل كل نسخنا
    // الاحتياطية من غير أي مصادقة. دلوقتي: اسم عشوائي غير متوقّع +
    // access: "private" (محتاج توكن السيرفر نفسه عشان توصله، مش رابط عام)
    const randomSuffix = crypto.randomBytes(16).toString("hex");
    const filename = `backups/${new Date().toISOString().slice(0, 10)}-${randomSuffix}.json`;
    const blob = await put(filename, JSON.stringify(backupData), {
      access: "private",
      addRandomSuffix: false, // احنا مولّدين عشوائية أقوى بأنفسنا فوق، مش محتاجين طبقة تانية تلقائية
    });

    return { success: true, url: blob.url, counts, truncated };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "فشل غير معروف" };
  }
}

/** آخرُ ثلاثين نسخة. صارت النسخةُ يوميّةً لا أسبوعية، فثلاثون يوماً من
 *  التاريخ بدل ثمانية أسابيع بفجواتٍ أسبوعية بينها - والفجوةُ الأسبوعية
 *  كانت تعني احتمالَ خسارةِ أسبوع عملٍ كامل بين نسختين. */
export async function pruneOldBackups() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;

  const { blobs } = await list({ prefix: "backups/" });
  const sorted = blobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  const toDelete = sorted.slice(30);

  for (const blob of toDelete) {
    await del(blob.url);
  }
}

export interface BackupFile {
  url: string;
  pathname: string;
  uploadedAt: Date;
  size: number;
}

/** قائمةُ النسخ المتاحة - تُقرأ في اللوحة، فيُعرَف أنّ النسخ يعمل قبل أن
 *  يُحتاج إليه. نسخةٌ لا يراها أحد لا يُعرَف أنّها توقّفت. */
export async function listBackups(): Promise<BackupFile[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  const { blobs } = await list({ prefix: "backups/" });
  return blobs
    .map((b) => ({ url: b.url, pathname: b.pathname, uploadedAt: new Date(b.uploadedAt), size: b.size }))
    .sort((a, z) => z.uploadedAt.getTime() - a.uploadedAt.getTime());
}
