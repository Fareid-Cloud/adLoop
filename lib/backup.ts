// lib/backup.ts
//
// إصلاح فجوة حقيقية من SECURITY.md قسم 12: كنا معتمدين بالكامل على
// نسخ قاعدة البيانات الاحتياطي من مزوّد الاستضافة، بدون نسخة مستقلة.
// دلوقتي عندنا نسخة أسبوعية للبيانات الجوهرية في Vercel Blob - مزوّد
// مختلف تماماً عن قاعدة البيانات، فلو حصلت مشكلة في المزوّد الأساسي،
// النسخة دي تفضل موجودة.
//
// ملاحظة صادقة: خطة Vercel المجانية (Hobby) غير تجارية بس - أي SaaS
// حقيقي محتاج Pro أصلاً ($20/شهر)، فتخزين Blob هيبقى بتسعير استخدام رخيص
// (0.023$/جيجا) مش مجاني بالكامل، لكن رخيص جداً لحجم بياناتنا الحالي.

import { put, list, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// بنسخ الجداول الجوهرية بس (مش كل حاجة) - أولوية للبيانات اللي مفيش
// طريقة تانية نعيد بنائها بيها لو ضاعت (عكس بيانات الأداء اليومية اللي
// ممكن نعيد سحبها من Google/Meta لو لزم الأمر)
export async function backupCriticalData(): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { success: false, error: "BLOB_READ_WRITE_TOKEN غير مضبوط - النسخ الاحتياطي متوقف" };
  }

  try {
    const [users, workspaces, connectedPlatforms, products] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true, email: true, name: true, createdAt: true, isAdmin: true,
          // passwordHash وmfaSecret ومتغيرات التشفير مُستبعدين عمداً - لو النسخة
          // الاحتياطية نفسها اتسربت، مبتفضحش بيانات مصادقة حساسة
        },
      }),
      prisma.workspace.findMany(),
      prisma.connectedPlatform.findMany({
        select: { id: true, userId: true, platform: true, expiresAt: true, connectedAt: true },
        // accessToken/refreshToken مُستبعدين عمداً - نفس المبدأ، حتى لو
        // مشفّرين، أقل بيانات حساسة ممكنة في نسخة احتياطية خارجية
      }),
      prisma.product.findMany(),
    ]);

    const backupData = {
      backedUpAt: new Date().toISOString(),
      users,
      workspaces,
      connectedPlatforms,
      products,
    };

    // إصلاح حرج من اختبار الاختراق: كان الاسم متوقّع تماماً (بالتاريخ
    // بس) والوصول "public" - يعني أي حد يعرف النمط يقدر يحمّل كل نسخنا
    // الاحتياطية من غير أي مصادقة. دلوقتي: اسم عشوائي غير متوقّع +
    // access: "private" (محتاج توكن السيرفر نفسه عشان توصله، مش رابط عام)
    const randomSuffix = crypto.randomBytes(16).toString("hex");
    const filename = `backups/${new Date().toISOString().slice(0, 10)}-${randomSuffix}.json`;
    const blob = await put(filename, JSON.stringify(backupData), {
      access: "private",
      addRandomSuffix: false, // احنا مولّدين عشوائية أقوى بأنفسنا فوق، مش محتاجين طبقة تانية تلقائية
    });

    return { success: true, url: blob.url };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "فشل غير معروف" };
  }
}

// بنحتفظ بآخر 8 أسابيع بس - مش تراكم بلا حد (نفس فلسفة سياسة الاحتفاظ
// بالبيانات في lib/dataRetention.ts)
export async function pruneOldBackups() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;

  const { blobs } = await list({ prefix: "backups/" });
  const sorted = blobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  const toDelete = sorted.slice(8); // نحتفظ بآخر 8، نمسح الباقي

  for (const blob of toDelete) {
    await del(blob.url);
  }
}
