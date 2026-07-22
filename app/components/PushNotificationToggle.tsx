"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";

// تفعيل إشعارات الموبايل (Web Push) - يشتغل من المتصفح مباشرة على
// أندرويد بالكامل. آيفون محتاج المستخدم يضيف الموقع للشاشة الرئيسية
// كـ"تطبيق" الأول (قيد من نظام آبل نفسه، مش حاجة نقدر نتحكم فيها).
export function PushNotificationToggle() {
  const [status, setStatus] = useState<"loading" | "unsupported" | "granted" | "denied" | "default">("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as "granted" | "denied" | "default");
  }, []);

  async function handleEnable() {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const permission = await Notification.requestPermission();
    setStatus(permission as "granted" | "denied" | "default");
    if (permission !== "granted") return;

    const res = await fetch("/api/push/vapid-public-key");
    const { publicKey } = await res.json();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
  }

  if (status === "unsupported") {
    return <p className="text-xs text-text-faint">متصفحك مش بيدعم إشعارات الموبايل حالياً.</p>;
  }

  if (status === "granted") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-verified">
        <Bell size={13} /> الإشعارات مفعّلة على الجهاز ده
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-text-faint">
        <BellOff size={13} /> رفضت الإذن - لازم تفعّله من إعدادات المتصفح نفسه
      </p>
    );
  }

  return (
    <button
      onClick={handleEnable}
      className="flex items-center gap-1.5 rounded-full bg-surface-raised px-3.5 py-1.5 text-xs text-text-primary"
    >
      <Bell size={13} /> فعّل إشعارات الموبايل على الجهاز ده
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
