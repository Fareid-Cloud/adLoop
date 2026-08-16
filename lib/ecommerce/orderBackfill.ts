// lib/ecommerce/orderBackfill.ts
//
// **سحب الطلبات السابقة على الربط.**
//
// الويب هوك يبدأ من لحظة تركيبه: من ربط متجره اليوم يرى صفراً حتى يصل
// أوّل طلبٍ جديد، وتاريخُ متجره كلّه غائب. وهو أسوأ من الفراغ - لأنّ
// كلّ ما يقيسه المنتج (الربح، المرتجعات، العميل المتكرّر، اتّجاه
// التكلفة) يحتاج ماضياً ليقول شيئاً. أوّلُ أسبوعٍ بلا تاريخٍ يجعل المنتج
// يبدو أعمى وهو سليم.
//
// **ولا يُخشى التكرار:** الطلب يمرّ بـ`ingestOrder` نفسها التي يمرّ بها
// الويب هوك، وحارسُها يطابق (المنصّة، رقم الطلب + بصمة حالته، المتجر).
// فالطلب الذي وصل بويب هوكٍ ثمّ جاء في السحب يُقرأ `duplicate` ويُهمَل،
// والطلبُ الذي تغيّرت حالته بين الاثنين يُقرأ تحديثاً. لا منطق ثانياً
// هنا - ولو كُتب لتباعد عن الأوّل مع الوقت.
//
// **ولا يُدَّعى الشمول:** السحب مقيَّدٌ بنافذةٍ وسقفِ صفحات، ويقول صراحةً
// إن توقّف عند السقف (`reachedCap`). ورسالةُ «تمّ» على سحبٍ مبتورٍ أسوأ
// من رسالةِ «سُحب ما أمكن».

import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";
import { parseOrder } from "./adapters";
import { ingestOrder } from "./ingest";
import type { EcommercePlatform } from "./types";

export interface BackfillResult {
  ok: boolean;
  platform?: EcommercePlatform;
  storeName?: string | null;
  /** طلباتٌ لم تكن عندنا فدخلت */
  imported: number;
  /** كانت عندنا بالحالة نفسها */
  duplicates: number;
  /** كانت عندنا فتغيّرت حالتها (شُحنت، ارتُجعت) */
  updated: number;
  /** وصلت بشكلٍ لم يُفهَم فلم تُقرأ - تُعَدّ ولا تُخترَع */
  unreadable: number;
  /** توقّف عند سقف الصفحات، فالتاريخ أقدم ممّا سُحب */
  reachedCap: boolean;
  windowDays: number;
  reasonKey?: string;
  reasonVars?: Record<string, string | number>;
}

const EMPTY = {
  imported: 0, duplicates: 0, updated: 0, unreadable: 0, reachedCap: false,
};

/** سقفٌ يحمي من متجرٍ بعشرات الآلاف ومن مهلة الخادم معاً */
const MAX_PAGES = 20;
const PAGE_SIZE = 100;
/** النافذة الافتراضية - تكفي «آخر تسعين يوماً» التي تقيس بها اللوحة */
const DEFAULT_WINDOW_DAYS = 90;

export async function backfillOrdersForWorkspace(
  workspaceId: string,
  windowDays = DEFAULT_WINDOW_DAYS
): Promise<BackfillResult[]> {
  const connections = await prisma.ecommerceConnection.findMany({
    where: { workspaceId, active: true },
    select: { id: true },
  });
  const out: BackfillResult[] = [];
  for (const c of connections) out.push(await backfillOrdersFromStore(c.id, windowDays));
  return out;
}

export async function backfillOrdersFromStore(
  connectionId: string,
  windowDays = DEFAULT_WINDOW_DAYS
): Promise<BackfillResult> {
  const connection = await prisma.ecommerceConnection.findUnique({ where: { id: connectionId } });
  if (!connection) return { ok: false, ...EMPTY, windowDays, reasonKey: "obNoStore" };

  const platform = connection.platform as EcommercePlatform;
  const base = { platform, storeName: connection.storeName, windowDays };

  if (!connection.apiToken) return { ok: false, ...EMPTY, ...base, reasonKey: "obNoToken" };

  const token = decryptToken(connection.apiToken);
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  let raw: { rows: any[]; reachedCap: boolean };
  try {
    switch (platform) {
      case "SALLA":       raw = await listSalla(token, since); break;
      case "SHOPIFY":     raw = await listShopify(token, connection.storeIdentifier, since); break;
      case "ZID":         raw = await listZid(token, connection.storeIdentifier, since); break;
      case "WOOCOMMERCE": raw = await listWoo(token, connection, since); break;
      case "EASY_ORDERS": raw = await listEasyOrders(token, since); break;
      default:
        return { ok: false, ...EMPTY, ...base, reasonKey: "obPlatformUnsupported" };
    }
  } catch (err) {
    return {
      ok: false, ...EMPTY, ...base,
      reasonKey: err instanceof Error ? "obPullFailedWithReason" : "obPullFailed",
      reasonVars: err instanceof Error ? { reason: err.message.slice(0, 160) } : undefined,
    };
  }

  let imported = 0, duplicates = 0, updated = 0, unreadable = 0;

  for (const row of raw.rows) {
    // القارئ نفسه الذي يقرأ الويب هوك: صيغة الطلب في القائمة هي صيغته
    // في الإشعار عند المنصّات الخمس، وأيّ اختلافٍ يظهر هنا `null` فيُعَدّ
    // «غير مقروء» بدل أن يُحفَظ نصفَ طلب.
    const order = parseOrder(platform, row);
    if (!order) { unreadable++; continue; }

    const result = await ingestOrder(order, connection.workspaceId, connectionId);
    if (result.status === "ok") imported++;
    else if (result.status === "updated") updated++;
    else duplicates++;
  }

  return { ok: true, ...base, imported, duplicates, updated, unreadable, reachedCap: raw.reachedCap };
}

// ══════════════════════════════════════════════════════════════════
//  القوائم لكلّ منصّة
// ══════════════════════════════════════════════════════════════════

/** سلّة - المسار مؤكَّدٌ من `/admin/v2`، وشكل الصفحات ثقةٌ متوسّطة */
async function listSalla(token: string, since: Date) {
  const rows: any[] = [];
  let reachedCap = true;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `https://api.salla.dev/admin/v2/orders?per_page=${PAGE_SIZE}&page=${page}` +
      `&from_date=${since.toISOString().slice(0, 10)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(String(res.status));
    const body: any = await res.json();
    const batch: any[] = body?.data ?? [];
    rows.push(...batch);
    const totalPages = Number(body?.pagination?.totalPages ?? body?.pagination?.total_pages ?? 1);
    if (batch.length === 0 || page >= totalPages) { reachedCap = false; break; }
  }
  return { rows, reachedCap };
}

/** شوبيفاي - REST `/orders.json` مؤكَّدٌ من توثيقها: `status=any` يشمل
 *  المؤرشَف، و`created_at_min` بصيغة ISO، والصفحة بـ`limit` ≤ ٢٥٠ مع
 *  ترقيمٍ عبر ترويسة `Link`. */
async function listShopify(token: string, storeDomain: string | null, since: Date) {
  if (!storeDomain) throw new Error("no-domain");
  const rows: any[] = [];
  let reachedCap = true;
  let url =
    `https://${storeDomain}/admin/api/2026-01/orders.json` +
    `?status=any&limit=250&created_at_min=${encodeURIComponent(since.toISOString())}`;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(url, { headers: { "X-Shopify-Access-Token": token } });
    if (!res.ok) throw new Error(String(res.status));
    const body: any = await res.json();
    rows.push(...(body?.orders ?? []));

    // الصفحة التالية تصل في ترويسة `Link` لا في الجسم
    const next = parseLinkNext(res.headers.get("link"));
    if (!next) { reachedCap = false; break; }
    url = next;
  }
  return { rows, reachedCap };
}

function parseLinkNext(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const [urlPart, relPart] = part.split(";");
    if (relPart?.includes('rel="next"')) {
      const m = urlPart?.trim().match(/^<(.+)>$/);
      if (m) return m[1];
    }
  }
  return null;
}

/** زد - ثقةٌ متوسّطة، والحقول تُقرأ بمرونة */
async function listZid(token: string, storeId: string | null, since: Date) {
  const rows: any[] = [];
  let reachedCap = true;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `https://api.zid.sa/v1/managers/store/orders?page=${page}&page_size=${PAGE_SIZE}` +
      `&created_after=${since.toISOString().slice(0, 10)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(storeId ? { "Store-Id": storeId } : {}),
        },
      }
    );
    if (!res.ok) throw new Error(String(res.status));
    const body: any = await res.json();
    const batch: any[] = body?.orders ?? body?.results ?? body?.data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) { reachedCap = false; break; }
  }
  return { rows, reachedCap };
}

/** ووكومرس - مؤكَّدٌ من توثيق REST v3: `after` بصيغة ISO، و`page`/`per_page` */
async function listWoo(key: string, connection: any, since: Date) {
  if (!connection.storeUrl || !connection.apiSecret) throw new Error("no-credentials");
  const secret = decryptToken(connection.apiSecret);
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const base = String(connection.storeUrl).replace(/\/+$/, "");

  const rows: any[] = [];
  let reachedCap = true;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `${base}/wp-json/wc/v3/orders?per_page=${PAGE_SIZE}&page=${page}` +
      `&after=${encodeURIComponent(since.toISOString())}`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    if (!res.ok) throw new Error(String(res.status));
    const batch: any[] = await res.json();
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) { reachedCap = false; break; }
  }
  return { rows, reachedCap };
}

/** إيزي أوردرز - ثقةٌ متوسّطة */
async function listEasyOrders(token: string, since: Date) {
  const rows: any[] = [];
  let reachedCap = true;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `https://api.easy-orders.net/api/v1/external-apps/orders?page=${page}&limit=${PAGE_SIZE}` +
      `&from=${since.toISOString().slice(0, 10)}`,
      { headers: { "Api-Key": token } }
    );
    if (!res.ok) throw new Error(String(res.status));
    const body: any = await res.json();
    const batch: any[] = Array.isArray(body) ? body : (body?.data ?? body?.items ?? []);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) { reachedCap = false; break; }
  }
  return { rows, reachedCap };
}
