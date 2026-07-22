"use client";

// شات الدعم: العميل يفتح محادثة (خطوات: بيانات التواصل ← الموضوع ← التفاصيل
// والصور ← إرسال)، توصل إشعار لصاحب المنتج بالإيميل، والرد يظهر هنا مع
// إشعار (نقطة حمراء). المحادثة محفوظة في قاعدة البيانات عبر الأجهزة.
import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Paperclip, Send } from "lucide-react";

interface Msg { id: string; fromSupport: boolean; body: string; imageUrls: string[]; createdAt: string; }
interface Thread { id: string; subject: string; status: string; messages: Msg[]; }

const COUNTRIES = ["السعودية", "مصر", "الإمارات", "الكويت", "قطر", "البحرين", "عُمان", "الأردن", "المغرب", "أخرى"];
const INPUT = "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent";

export function SupportChat({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<Thread | null>(null);
  const [unread, setUnread] = useState(0);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name, email, phone: "", country: COUNTRIES[0], subject: "", text: "" });
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/support");
    if (res.ok) { const d = await res.json(); setThread(d.thread); setUnread(d.unread ?? 0); }
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 25000); return () => clearInterval(i); }, [load]);

  useEffect(() => {
    if (open && thread && unread > 0) {
      fetch("/api/support/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: thread.id }) }).then(() => setUnread(0));
    }
  }, [open, thread, unread]);

  useEffect(() => { bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight); }, [thread, open]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/support/upload", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) { const d = await res.json(); setImages((p) => [...p, d.url]); }
  }

  async function submitIntake() {
    setBusy(true);
    const res = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, imageUrls: images }) });
    setBusy(false);
    if (res.ok) { const d = await res.json(); setThread(d.thread); setImages([]); setStep(0); }
  }

  async function sendReply() {
    if (!reply.trim() || !thread) return;
    setBusy(true);
    const res = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: thread.id, text: reply }) });
    setBusy(false);
    if (res.ok) { setReply(""); load(); }
  }

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {open ? (
        <div className="flex h-[520px] w-[360px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-surface-raised px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-text-primary">الدعم الفني</div>
              <div className="text-[11px] text-text-faint">عادةً نرد خلال ساعات العمل</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text-primary"><X size={18} /></button>
          </div>

          <div ref={bodyRef} className="flex-1 overflow-y-auto p-4">
            {thread ? (
              <div className="flex flex-col gap-2.5">
                <div className="mb-1 rounded-lg bg-verified/10 px-3 py-2 text-[12px] text-verified">
                  تم استلام رسالتك، سيتواصل معك مسؤول الدعم الفني قريباً.
                </div>
                {thread.messages.map((m) => (
                  <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] ${m.fromSupport ? "self-start bg-surface-raised text-text-primary" : "self-end bg-accent text-white"}`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.imageUrls?.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="mt-1.5 max-h-32 rounded-lg" /></a>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="mb-1 text-[13px] text-text-muted">
                  اترك رسالتك وسنعود إليك عبر هذه المحادثة نفسها.
                </div>
                {step === 0 && (
                  <>
                    <input className={INPUT} placeholder="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <input className={INPUT} placeholder="البريد الإلكتروني" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <input className={INPUT} placeholder="رقم الهاتف (اختياري)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </>
                )}
                {step === 1 && (
                  <>
                    <select className={INPUT} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input className={INPUT} placeholder="موضوع الرسالة" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                  </>
                )}
                {step === 2 && (
                  <>
                    <textarea rows={4} className={INPUT} placeholder="اكتب تفاصيل استفسارك أو مشكلتك..." value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-text-muted">
                      <Paperclip size={14} /> {uploading ? "جارٍ الرفع..." : "إرفاق صورة (اختياري)"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                    </label>
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {images.map((u) => <img key={u} src={u} alt="" className="h-12 w-12 rounded-lg object-cover" />)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* التذييل: أزرار الخطوات أو مربع الرد */}
          <div className="border-t border-border p-3">
            {thread ? (
              <div className="flex items-center gap-2">
                <input className={INPUT} placeholder="اكتب رداً..." value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply()} />
                <button onClick={sendReply} disabled={busy} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-50"><Send size={15} /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                {step > 0 ? (
                  <button onClick={() => setStep(step - 1)} className="rounded-xl px-3 py-2 text-sm text-text-muted hover:text-text-primary">السابق</button>
                ) : <span />}
                {step < 2 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    disabled={(step === 0 && (!form.name.trim() || !form.email.trim())) || (step === 1 && !form.subject.trim())}
                    className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >التالي</button>
                ) : (
                  <button onClick={submitIntake} disabled={busy || !form.text.trim()} className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
                    {busy ? "جارٍ الإرسال..." : "إرسال"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="relative flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform hover:scale-105">
          <MessageCircle size={20} />
          {unread > 0 && <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">{unread}</span>}
        </button>
      )}
    </div>
  );
}
