// app/components/FeedbackWidget.tsx
//
// زرار عائم بيظهر في كل صفحات لوحة التحكم - عشان المستخدم يقدر يبعت
// ملاحظة أو مشكلة في أي وقت، من غير ما يدور على "تواصل معنا" في مكان تاني.

"use client";

import { useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setSending(false);
    setSent(true);
    setMessage("");
    setTimeout(() => {
      setSent(false);
      setOpen(false);
    }, 1500);
  }

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {open ? (
        <div className="w-72 rounded-2xl bg-surface-raised p-4 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">ملاحظة أو مشكلة؟</span>
            <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text-primary">
              <X size={15} />
            </button>
          </div>
          {sent ? (
            <p className="text-xs text-verified">تم الإرسال، شكراً ✓</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب هنا..."
                required
                rows={3}
                className="mb-2 w-full rounded-xl bg-surface px-3 py-2 text-xs text-text-primary outline-none"
              />
              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-full bg-accent py-1.5 text-xs text-white disabled:opacity-50"
              >
                {sending ? "جارٍ الإرسال..." : "إرسال"}
              </button>
            </form>
          )}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white shadow-lg"
        >
          <MessageSquarePlus size={18} />
        </button>
      )}
    </div>
  );
}
