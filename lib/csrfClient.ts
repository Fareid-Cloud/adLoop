// lib/csrfClient.ts
//
// نسخة العميل (Browser) من lib/csrf.ts - بتقرا كوكي CSRF وتحطها في هيدر
// أي طلب تغييري (POST/PATCH/DELETE) للـ endpoints الحساسة.

export function getCsrfHeader(): Record<string, string> {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  const token = match?.[1];
  return token ? { "x-csrf-token": token } : {};
}
