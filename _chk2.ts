import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const W = "cms9nw7af0001slfixuf06rfj";
(async () => {
  const r: Record<string, number> = {};
  r.metricSnapshot = await p.metricSnapshot.count({ where: { workspaceId: W } });
  r.creativeSnapshot = await p.creativeSnapshot.count({ where: { workspaceId: W } });
  r.campaignLink = await p.campaignLink.count({ where: { workspaceId: W } });
  r.product = await p.product.count({ where: { workspaceId: W } });
  r.actionFeedItem = await p.actionFeedItem.count({ where: { workspaceId: W } });
  r.touchpoint = await p.touchpoint.count({ where: { workspaceId: W } });
  r.conversionEvent = await p.conversionEvent.count({ where: { workspaceId: W } });
  r.order = await p.order.count({ where: { workspaceId: W } });
  r.customer = await p.customer.count({ where: { workspaceId: W } });
  r.productSaleEvent = await p.productSaleEvent.count();
  r.searchTermSnapshot = await p.searchTermSnapshot.count({ where: { workspaceId: W } }).catch(() => -1);
  console.log(JSON.stringify(r, null, 1));
  await p.$disconnect();
})();
