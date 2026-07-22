// public/sw.js
//
// Service Worker بسيط لاستقبال إشعارات Web Push وعرضها - بيشتغل من
// المتصفح مباشرة، بما فيها موبايل (Android بالكامل، iOS محتاج الموقع
// يتضاف للشاشة الرئيسية كـ"تطبيق" أولاً - قيد حقيقي في نظام آبل نفسه).

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "AdLoop", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "AdLoop", {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(clients.openWindow(url));
});
