// public/sw.js
//
// Service Worker: إشعارات Web Push + سلوك التطبيق المثبَّت.
//
// **قاعدة حاكمة هنا:** هذه أداة تعرض **أرقاماً مالية**. لا يجوز أن تُعرض
// نسخة مخزَّنة من رقم إنفاق أو تحويل — قرار مبنيّ على رقم عمره ساعة أسوأ
// من عدم وجود رقم. لذلك لا شيء من البيانات يُخزَّن مؤقّتاً إطلاقاً؛
// التخزين للأصداف الثابتة وحدها (الأيقونات وصفحة انقطاع الشبكة).
//
// iOS: يتطلّب إضافة الموقع للشاشة الرئيسية أوّلاً قبل أن تعمل الإشعارات
// — قيد من آبل نفسها لا منّا.

// رقم النسخة يتغيّر مع أيّ تعديل هنا: `activate` يحذف ما عداه، فيضمن
// ألّا يبقى عاملُ خدمةٍ قديمٌ يخدم سلوكاً أُصلح.
const CACHE = "adloop-shell-v2";

// أصول ثابتة لا تتغيّر بين النشرات إلّا باسم جديد. لا صفحات ولا واجهات
// برمجية.
const SHELL = ["/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/offline.html"];

self.addEventListener("install", (event) => {
  // `skipWaiting` مقصود: نسخة قديمة عالقة تعني أنّ إصلاحاً نُشر للتوّ
  // لا يصل إلى من ثبّت التطبيق حتى يغلق كلّ نوافذه.
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 🔴 لا نعترض الواجهة البرمجية إطلاقاً.
  //
  // مسارات `/api/oauth/*/start` تُجيب بتحويلٍ إلى **نطاق خارجي** (صفحة
  // موافقة جوجل/ميتا/تيك توك). التحويل عبر النطاقات داخل `fetch` في عامل
  // الخدمة يفشل، فيقع الطلب في `catch` أدناه ويُعرَض المستخدمُ صفحةَ
  // «لا يوجد اتّصال» - وهو متّصل تماماً، وكلّ ما فعله أنّه ضغط «اربط
  // Google Ads». عامل الخدمة هنا وُجد لصفحات الانقطاع لا للواجهة البرمجية.
  if (url.pathname.startsWith("/api/")) return;

  // الشبكة أوّلاً دائماً للتنقّل، وصفحة الانقطاع عند الفشل فقط.
  // لا نخزّن الصفحة الناجحة: قد تحمل أرقاماً، وعرضها لاحقاً كأنها حيّة
  // هو بالضبط ما يمنعه هذا المنتج.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  // الأصول الثابتة من المخزن حين تتوفّر
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});

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
      dir: "auto",
      data: { url: payload.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  // نافذة مفتوحة بالفعل تُركَّز ويُنقل إليها المسار، بدل فتح نسخة ثانية
  // من التطبيق فوق الأولى في كلّ إشعار.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && "focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
