import { PrismaClient } from "@prisma/client";
import { seedDemoWorkspace } from "./lib/demo";
const p = new PrismaClient();
(async () => {
  const ws = await p.workspace.findFirst({ where: { isDemo: true }, select: { id: true, userId: true } });
  if (!ws) { console.log("no demo ws"); process.exit(0); }
  // مسح كامل ثم إعادة بناء من الصفر - نفس ما يمرّ به مستخدم جديد تماماً
  await p.workspace.delete({ where: { id: ws.id } });
  console.log("deleted. rebuilding...");
  const t0 = Date.now();
  const id = await seedDemoWorkspace(ws.userId, "ar");
  console.log("built", id, "in", ((Date.now() - t0) / 1000).toFixed(1) + "s");

  const c: Record<string, number> = {};
  c.metricSnapshot = await p.metricSnapshot.count({ where: { workspaceId: id } });
  c.creativeSnapshot = await p.creativeSnapshot.count({ where: { workspaceId: id } });
  c.campaignLink = await p.campaignLink.count({ where: { workspaceId: id } });
  c.searchTerm = await p.searchTermSnapshot.count({ where: { workspaceId: id } });
  c.product = await p.product.count({ where: { workspaceId: id } });
  c.actionFeed = await p.actionFeedItem.count({ where: { workspaceId: id } });
  c.touchpoint = await p.touchpoint.count({ where: { workspaceId: id } });
  c.conversionEvent = await p.conversionEvent.count({ where: { workspaceId: id } });
  c.customer = await p.customer.count({ where: { workspaceId: id } });
  c.order = await p.order.count({ where: { workspaceId: id } });
  c.syncRun = await p.syncRun.count({ where: { workspaceId: id } });
  c.experimentLog = await p.experimentLog.count({ where: { workspaceId: id } });
  console.log(JSON.stringify(c, null, 1));
  await p.$disconnect();
})().catch((e) => { console.error("FAILED:", e.message?.slice(0, 600)); process.exit(1); });
