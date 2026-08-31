"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, ImagePlus, X, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import { SUPPORT_CATEGORIES } from "@/lib/supportCategories";
// الرمز المخزَّن (SA/EG/…) لا يُعرض خاماً: `countryName` يعيد الاسم،
// ويعيد الرمز كما هو إن كان مجهولاً - فلا يختفي صفّ قديم بالاسم العربي.
import { countryName } from "@/lib/countries";

interface Msg { id: string; fromSupport: boolean; body: string; imageUrls: string[]; createdAt: string; }
interface Thread {
  id: string; name: string; email: string; phone: string | null; country: string | null;
  subject: string; status: string; updatedAt: string; messages: Msg[];
  category: string | null; closedAt: string | null; userId: string | null;
}

export function AdminSupportClient({
  threads: initial,
  initialThreadId,
}: {
  threads: Thread[];
  /** فتح محادثة بعينها من رابط - صفحة العميل بتحوّل هنا بمعرّف المحادثة */
  initialThreadId?: string;
}) {
  const router = useRouter();
  const [threads, setThreads] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(
    (initialThreadId && initial.some((t) => t.id === initialThreadId) ? initialThreadId : null) ?? initial[0]?.id ?? null
  );
  const [closing, setClosing] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  // صورة وحدها ردّ صالح: لقطة شاشة تشرح أكثر من فقرة أحياناً.
  async function sendReply() {
    if (!selected || (!reply.trim() && images.length === 0)) return;
    setBusy(true);
    const res = await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({
        threadId: selected.id,
        text: reply,
        imageUrls: images,
        // التصنيف بيتبعت مع الردّ لو المالك اختاره - مش لازم يقفل عشان
        // يصنّف، والمحادثة اللي بتتحلّ بردّ واحد بتفضل مصنّفة برضو.
        ...(selected.category ? { category: selected.category } : {}),
      }),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setThreads((prev) => prev.map((t) => t.id === selected.id ? { ...t, status: "ANSWERED", messages: [...t.messages, d.message] } : t));
      setReply("");
      setImages([]);
    }
  }

  /** التصنيف محلّياً بس لحدّ ما يتبعت مع الردّ أو الإغلاق - نداء لكل
   *  تغيير في قائمة منسدلة إسراف بلا فايدة. */
  function pickCategory(value: string) {
    if (!selected) return;
    setThreads((prev) => prev.map((t) => (t.id === selected.id ? { ...t, category: value || null } : t)));
  }

  async function toggleClosed(reopen: boolean) {
    if (!selected) return;
    setClosing(true);
    const res = await fetch(`/api/admin/support/${selected.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ reopen, category: selected.category ?? undefined }),
    });
    setClosing(false);
    if (res.ok) {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selected.id
            ? { ...t, status: reopen ? "OPEN" : "CLOSED", closedAt: reopen ? null : new Date().toISOString() }
            : t
        )
      );
      router.refresh();
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/support/upload", { method: "POST", body: fd });
    setUploading(false);
    e.target.value = ""; // حتى يمكن رفع الملفّ نفسه مرّة أخرى بعد إزالته
    const d = await res.json().catch(() => ({}));
    // سبب الفشل يُعرَض كما جاء من الخادم: "الرفع غير مفعّل" تختلف تماماً
    // عن "التوكن غير صالح"، والمالك هو من يملك إصلاح الاثنين.
    if (res.ok && d.url) setImages((p) => [...p, d.url]);
    else setUploadError(d.error ?? "Failed to upload the image.");
  }

  if (threads.length === 0) {
    return <div className="card pad-lg text-center text-text-muted">No support messages yet.</div>;
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
        <div className="flex max-h-[70vh] flex-col card">
          <div className="border-b border-border p-4 text-sm">
            <div className="font-semibold text-text-primary">{selected.subject}</div>
            <div className="mt-1 text-xs text-text-muted">
              {selected.name} · {selected.email}{selected.phone ? ` · ${selected.phone}` : ""}{selected.country ? ` · ${countryName(selected.country, "en")}` : ""}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={selected.category ?? ""}
                onChange={(e) => pickCategory(e.target.value)}
                title="What was this about? Powers the 'most common problems' report."
                className="field field-sm h-7"
              >
                <option value="">Uncategorised</option>
                {SUPPORT_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={() => toggleClosed(selected.status === "CLOSED")}
                disabled={closing}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border px-2 text-[11.5px] text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
              >
                {selected.status === "CLOSED" ? <><RotateCcw size={12} /> Reopen</> : <><CheckCircle2 size={12} /> Close thread</>}
              </button>
              {selected.userId && (
                <a
                  href={`/admin/customers/${selected.userId}`}
                  className="text-[11.5px] text-accent no-underline hover:underline"
                >
                  Open account →
                </a>
              )}
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
          <div className="border-t border-border p-3">
            {(images.length > 0 || uploadError) && (
              <div className="mb-2">
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {images.map((u) => (
                      <div key={u} className="relative">
                        <img src={u} alt="" className="h-14 w-14 rounded-lg object-cover" />
                        <button
                          onClick={() => setImages((p) => p.filter((x) => x !== u))}
                          title="Remove"
                          className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-critical text-white"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {uploadError && <p className="mt-1.5 text-[11.5px] text-critical">{uploadError}</p>}
              </div>
            )}
            <div className="flex items-center gap-2">
            <label
              title="Attach image"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center card-inset text-text-muted transition-colors hover:text-text-primary"
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
            </label>
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
              placeholder="Write a reply to the customer..."
              className="w-full card-inset px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
            <button
              onClick={sendReply}
              disabled={busy || uploading || (!reply.trim() && images.length === 0)}
              className="btn btn-primary btn-icon"
            >
              <Send size={15} />
            </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
