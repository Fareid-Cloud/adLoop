"use client";

import { useState } from "react";
import { Send } from "lucide-react";

interface Msg { id: string; fromSupport: boolean; body: string; imageUrls: string[]; createdAt: string; }
interface Thread {
  id: string; name: string; email: string; phone: string | null; country: string | null;
  subject: string; status: string; updatedAt: string; messages: Msg[];
}

export function AdminSupportClient({ threads: initial }: { threads: Thread[] }) {
  const [threads, setThreads] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setBusy(true);
    const res = await fetch("/api/admin/support", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: selected.id, text: reply }),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setThreads((prev) => prev.map((t) => t.id === selected.id ? { ...t, status: "ANSWERED", messages: [...t.messages, d.message] } : t));
      setReply("");
    }
  }

  if (threads.length === 0) {
    return <div className="rounded-2xl border border-border bg-surface p-8 text-center text-text-muted">لا توجد رسائل دعم بعد.</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <div className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto">
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className={`rounded-xl border p-3 text-start transition-colors ${t.id === selectedId ? "border-accent bg-surface-raised" : "border-border bg-surface hover:bg-surface-raised"}`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-medium text-text-primary">{t.name}</span>
              {t.status === "OPEN" && <span className="h-2 w-2 shrink-0 rounded-full bg-gap" />}
            </div>
            <div className="truncate text-xs text-text-muted">{t.subject}</div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="flex max-h-[70vh] flex-col rounded-2xl border border-border bg-surface">
          <div className="border-b border-border p-4 text-sm">
            <div className="font-semibold text-text-primary">{selected.subject}</div>
            <div className="mt-1 text-xs text-text-muted">
              {selected.name} · {selected.email}{selected.phone ? ` · ${selected.phone}` : ""}{selected.country ? ` · ${selected.country}` : ""}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
            {selected.messages.map((m) => (
              <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] ${m.fromSupport ? "self-end bg-accent text-white" : "self-start bg-surface-raised text-text-primary"}`}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                {m.imageUrls?.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="mt-1.5 max-h-40 rounded-lg" /></a>
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
              placeholder="اكتب رداً للعميل..."
              className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
            <button onClick={sendReply} disabled={busy} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-50">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
