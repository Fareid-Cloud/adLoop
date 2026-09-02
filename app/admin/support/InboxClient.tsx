"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, Pin, Trash2, Check, X, Send, Loader2, Tag, Globe,
  MessageCircle, Phone, ChevronLeft, Inbox as InboxIcon, AlertTriangle, Paperclip,
} from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
// من `inboxChannels` لا من `inbox`: التاني بيجرّ `web-push` للمتصفّح.
import { CHANNEL_LABEL, type Channel } from "@/lib/inboxChannels";
import { countryName } from "@/lib/countries";

// أيقونةُ القناة بتفرّق الصفوف من غير ما تاخد عرضاً - القائمة ضيّقة،
// وكلمةُ "WhatsApp" جنب كلّ اسم كانت هتاكل نصّ المعاينة.
const CHANNEL_ICON: Record<string, typeof Globe> = {
  WEB: Globe,
  WHATSAPP: Phone,
  MESSENGER: MessageCircle,
};

interface ThreadRow {
  id: string; channel: string; name: string; email: string; phone: string | null;
  subject: string; status: string; pinned: boolean; unread: boolean; tags: string[];
  assignedToId: string | null; assignedToName: string | null;
  lastMessageAt: string; messageCount: number; preview: string;
}

interface ActiveThread {
  id: string; channel: string; name: string; email: string; phone: string | null;
  country: string | null; subject: string; status: string; pinned: boolean;
  tags: string[]; assignedToId: string | null; userId: string | null;
  createdAt: string; lastMessageAt: string; category: string | null;
  messages: Array<{
    id: string; fromSupport: boolean; body: string; imageUrls: string[]; createdAt: string;
  }>;
}

export function InboxClient({
  threads, active, history, counts, agents, tags, filters,
}: {
  threads: ThreadRow[];
  active: ActiveThread | null;
  history: Array<{ id: string; subject: string; status: string; channel: string; lastMessageAt: string }>;
  counts: Record<string, number>;
  agents: Array<{ id: string; name: string | null; email: string }>;
  tags: string[];
  filters: { channel: string; status: string; unread: boolean; assigned: string; tag: string; q: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(filters.q);

  /** التنقّل بتعديل الرابط: الحالة في العنوان فالرابط يُبعَت ويُفتَح. */
  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.push(`/admin/support?${next.toString()}`);
  }

  // البحثُ بتأخير: كتابةُ كلمة كانت بتبعت طلباً لكلّ حرف.
  useEffect(() => {
    if (q === filters.q) return;
    const id = setTimeout(() => go({ q: q || null, thread: null }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const total = Object.values(counts).reduce((a, z) => a + z, 0);

  return (
    <div className="grid gap-3 lg:grid-cols-[190px_minmax(0,300px)_minmax(0,1fr)] xl:grid-cols-[200px_320px_minmax(0,1fr)_260px]">
      {/* ═══ ١) الفلاتر ═══
          على الموبايل بتتحوّل لشريطٍ أفقيّ بيتمرّر: عمودٌ كامل للفلاتر
          على تليفون بياكل الشاشة قبل ما حد يشوف رسالة. */}
      <aside className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:overflow-visible lg:px-0 lg:pb-0">
        <FilterGroup label="Inbox">
          <FilterLink active={filters.channel === "ALL" && !filters.unread && !filters.assigned} onClick={() => go({ channel: null, unread: null, assigned: null })} icon={InboxIcon} count={total}>
            All
          </FilterLink>
          <FilterLink active={filters.unread} onClick={() => go({ unread: filters.unread ? null : "1" })}>
            Unread
          </FilterLink>
          <FilterLink active={filters.assigned === "UNASSIGNED"} onClick={() => go({ assigned: filters.assigned === "UNASSIGNED" ? null : "UNASSIGNED" })}>
            Unassigned
          </FilterLink>
        </FilterGroup>

        <FilterGroup label="Channel">
          {(["WEB", "WHATSAPP", "MESSENGER"] as Channel[]).map((c) => {
            const Icon = CHANNEL_ICON[c];
            return (
              <FilterLink
                key={c}
                active={filters.channel === c}
                onClick={() => go({ channel: filters.channel === c ? null : c, thread: null })}
                icon={Icon}
                count={counts[c] ?? 0}
              >
                {CHANNEL_LABEL[c]}
              </FilterLink>
            );
          })}
        </FilterGroup>

        <FilterGroup label="Status">
          {["OPEN", "ANSWERED", "CLOSED"].map((s) => (
            <FilterLink key={s} active={filters.status === s} onClick={() => go({ status: filters.status === s ? null : s, thread: null })}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </FilterLink>
          ))}
        </FilterGroup>

        {tags.length > 0 && (
          <FilterGroup label="Tags">
            {tags.slice(0, 10).map((t) => (
              <FilterLink key={t} active={filters.tag === t} onClick={() => go({ tag: filters.tag === t ? null : t, thread: null })}>
                {t}
              </FilterLink>
            ))}
          </FilterGroup>
        )}
      </aside>

      {/* ═══ ٢) القائمة ═══ */}
      <div className="min-w-0">
        <div className="relative mb-2">
          <Search size={14} className="pointer-events-none absolute inset-inline-start-0 top-1/2 ms-2.5 -translate-y-1/2 text-text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, or anything said"
            className="field field-sm h-8 w-full ps-8"
          />
        </div>

        {threads.length === 0 ? (
          <p className="card pad-lg m-0 text-center text-[12.5px] text-text-muted">
            Nothing matches this view.
          </p>
        ) : (
          <div className="flex max-h-[calc(100dvh-16rem)] flex-col gap-1 overflow-y-auto pe-0.5">
            {threads.map((t) => (
              <ThreadButton key={t.id} row={t} activeId={active?.id ?? null} onOpen={() => go({ thread: t.id })} />
            ))}
          </div>
        )}
      </div>

      {/* ═══ ٣) المحادثة ═══ */}
      <div className="min-w-0">
        {active ? (
          <Conversation thread={active} agents={agents} onChanged={() => router.refresh()} onClose={() => go({ thread: null })} />
        ) : (
          <div className="card pad-lg grid min-h-[16rem] place-items-center text-center">
            <p className="m-0 text-[12.5px] text-text-muted">Pick a conversation to read it.</p>
          </div>
        )}
      </div>

      {/* ═══ ٤) تفاصيل المرسل - عمودٌ مستقلّ على الشاشات الواسعة وحدها ═══ */}
      {active && (
        <aside className="min-w-0 xl:block">
          <Details thread={active} history={history} tags={tags} onChanged={() => router.refresh()} />
        </aside>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 shrink-0 lg:mb-4">
      <div className="hidden px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint lg:block">
        {label}
      </div>
      <div className="flex gap-1 lg:block">{children}</div>
    </div>
  );
}

function FilterLink({
  children, active, onClick, icon: Icon, count,
}: {
  children: React.ReactNode; active: boolean; onClick: () => void;
  icon?: typeof Globe; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`mb-0.5 flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors lg:w-full ${
        active ? "bg-critical/12 font-medium text-critical" : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
      }`}
    >
      {Icon && <Icon size={13} className="shrink-0" />}
      <span className="truncate">{children}</span>
      {count !== undefined && count > 0 && (
        <span className="ms-auto shrink-0 tabular-nums text-[11px] text-text-faint">{count}</span>
      )}
    </button>
  );
}

function ThreadButton({ row, activeId, onOpen }: { row: ThreadRow; activeId: string | null; onOpen: () => void }) {
  const Icon = CHANNEL_ICON[row.channel] ?? Globe;
  return (
    <button
      onClick={onOpen}
      className={`w-full rounded-xl border p-2.5 text-start transition-colors ${
        row.id === activeId ? "border-accent bg-surface-raised" : "border-border bg-surface hover:bg-surface-raised"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="shrink-0 text-text-faint" />
        <span className={`truncate text-[12.5px] ${row.unread ? "font-semibold text-text-primary" : "text-text-primary"}`}>
          {row.name}
        </span>
        {row.pinned && <Pin size={10} className="shrink-0 text-accent" />}
        <span className="ms-auto shrink-0 text-[10.5px] text-text-faint">{ago(row.lastMessageAt)}</span>
        {/* نقطةٌ لا عدّاد: العدد على مستوى المحادثة بيحتاج تتبّعاً لكلّ
            رسالة، والسؤال هنا واحد - فيه جديد ولا لأ. */}
        {row.unread && <span className="size-1.5 shrink-0 rounded-full bg-critical" />}
      </div>
      <div className="mt-0.5 truncate text-[11.5px] text-text-muted">{row.preview || row.subject}</div>
      {(row.tags.length > 0 || row.assignedToName) && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {row.assignedToName && (
            <span className="rounded bg-accent/12 px-1.5 py-0.5 text-[10px] text-accent">{row.assignedToName}</span>
          )}
          {row.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-text-faint">{t}</span>
          ))}
        </div>
      )}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════

function Conversation({
  thread, agents, onChanged, onClose,
}: {
  thread: ActiveThread;
  agents: Array<{ id: string; name: string | null; email: string }>;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // فتحُ المحادثة بيعلّمها مقروءة - الفعلُ هو القراءة نفسها، فطلبُ دوسةٍ
  // إضافية عليه بيخلّي كلّ محادثة تفضل بتطلب انتباهاً اتصرف عليه فعلاً.
  useEffect(() => {
    fetch(`/api/admin/inbox/${thread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ markRead: true }),
    }).catch(() => {});
  }, [thread.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread.id, thread.messages.length]);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/admin/inbox/${thread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify(body),
    }).catch(() => null);
    onChanged();
  }

  async function send() {
    if (!reply.trim() || busy) return;
    setBusy(true);
    setWarning(null);
    const res = await fetch(`/api/admin/inbox/${thread.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ body: reply.trim() }),
    }).catch(() => null);
    setBusy(false);

    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setWarning(data?.error ?? "The reply could not be saved.");
      return;
    }
    setReply("");
    // الردُّ محفوظ حتى لو التوصيل فشل - فالتحذير بيتقال والمحادثة بتتحدّث،
    // مش بيتعامل كفشلٍ كامل يخلّي اللي كتب يكتب تاني.
    if (data?.delivery && !data.delivery.ok) {
      setWarning(
        data.delivery.reason === "window_closed"
          ? "Saved, but not delivered: Meta only allows a free reply within 24 hours of the customer's last message. After that it needs an approved template."
          : data.delivery.reason === "not_configured"
            ? "Saved, but not delivered: this channel is not connected yet."
            : "Saved, but delivery failed. The customer has not received it."
      );
    }
    onChanged();
  }

  return (
    <div className="card flex max-h-[calc(100dvh-14rem)] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <button onClick={onClose} className="btn-icon lg:hidden" aria-label="Back to list">
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-text-primary">{thread.name}</div>
          <div className="truncate text-[11px] text-text-faint">
            {CHANNEL_LABEL[thread.channel as Channel] ?? thread.channel}
            {thread.email && ` · ${thread.email}`}
          </div>
        </div>

        <select
          value={thread.assignedToId ?? ""}
          onChange={(e) => patch({ assignedToId: e.target.value || null })}
          className="field field-sm h-7 max-w-[9rem]"
          aria-label="Assign"
        >
          <option value="">Unassigned</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name ?? a.email}</option>
          ))}
        </select>

        <button onClick={() => patch({ pinned: !thread.pinned })} className="btn-icon" aria-label={thread.pinned ? "Unpin" : "Pin"} title={thread.pinned ? "Unpin" : "Pin"}>
          <Pin size={15} className={thread.pinned ? "text-accent" : ""} />
        </button>
        <button
          onClick={() => patch({ status: thread.status === "CLOSED" ? "OPEN" : "CLOSED" })}
          className="btn btn-sm h-7 px-2.5"
        >
          {thread.status === "CLOSED" ? "Reopen" : <><Check size={13} className="me-1" />Close</>}
        </button>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {thread.messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromSupport ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap ${
                m.fromSupport ? "bg-accent text-white" : "bg-surface-raised text-text-primary"
              }`}
            >
              {m.body}
              {m.imageUrls.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="" className="mt-1.5 max-h-56 rounded-lg" />
              ))}
              <div className={`mt-1 text-[10px] ${m.fromSupport ? "text-white/70" : "text-text-faint"}`}>
                {time(m.createdAt)}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {warning && (
        <div className="mx-3 mb-2 flex items-start gap-1.5 rounded-xl border border-gap/30 bg-gap/8 p-2 text-[11.5px] text-text-primary">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-gap" />
          {warning}
        </div>
      )}

      <div className="border-t border-border p-3">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            // Enter بيبعت، وShift+Enter بيسطّر. عكسُها بيخلّي كلّ ردٍّ
            // محتاج فأرة، وده أكتر فعلٍ متكرّر في الشاشة دي.
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="Write a reply…  (Enter to send, Shift+Enter for a new line)"
          rows={2}
          className="field w-full text-[12.5px]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-faint">
            <Paperclip size={11} className="me-1 inline" />
            Attachments need Blob storage enabled
          </span>
          <button onClick={send} disabled={busy || !reply.trim()} className="btn btn-primary btn-sm h-8 px-3">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span className="ms-1.5">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════

function Details({
  thread, history, tags, onChanged,
}: {
  thread: ActiveThread;
  history: Array<{ id: string; subject: string; status: string; channel: string; lastMessageAt: string }>;
  tags: string[];
  onChanged: () => void;
}) {
  const [newTag, setNewTag] = useState("");

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/admin/inbox/${thread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify(body),
    }).catch(() => null);
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="card pad">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint">Contact</div>
        <Row label="Name" value={thread.name} />
        {thread.email && <Row label="Email" value={thread.email} />}
        {thread.phone && <Row label="Phone" value={thread.phone} />}
        {thread.country && <Row label="Country" value={countryName(thread.country, "en")} />}
        <Row label="Channel" value={CHANNEL_LABEL[thread.channel as Channel] ?? thread.channel} />
        <Row label="First seen" value={new Date(thread.createdAt).toLocaleDateString("en-GB")} />
      </div>

      <div className="card pad">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
          <Tag size={10} /> Tags
        </div>
        <div className="flex flex-wrap gap-1">
          {thread.tags.map((t) => (
            <button
              key={t}
              onClick={() => patch({ tags: thread.tags.filter((x) => x !== t) })}
              className="flex items-center gap-1 rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-text-muted hover:text-critical"
            >
              {t} <X size={9} />
            </button>
          ))}
        </div>
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !newTag.trim()) return;
            e.preventDefault();
            patch({ tags: [...thread.tags, newTag.trim()] });
            setNewTag("");
          }}
          list="inbox-tags"
          placeholder="Add a tag…"
          className="field field-sm mt-1.5 h-7 w-full"
        />
        <datalist id="inbox-tags">
          {tags.map((t) => <option key={t} value={t} />)}
        </datalist>
      </div>

      {history.length > 0 && (
        <div className="card pad">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
            Earlier conversations
          </div>
          {/* التاريخُ بيغيّر الردّ: حدّ بيشتكي للمرّة التالتة مش زيّ حدّ
              بيكتب لأوّل مرّة، وبدونه الدعم بيعامل الاتنين واحد. */}
          <ul className="m-0 list-none space-y-1 p-0">
            {history.map((h) => (
              <li key={h.id}>
                <a href={`/admin/support?thread=${h.id}`} className="block truncate text-[11.5px] text-text-muted no-underline hover:text-text-primary">
                  {h.subject}
                  <span className="ms-1 text-text-faint">· {new Date(h.lastMessageAt).toLocaleDateString("en-GB")}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => patch({ deleted: true })}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12px] text-text-faint transition-colors hover:border-critical/40 hover:text-critical"
      >
        <Trash2 size={13} /> Remove from inbox
      </button>
      <p className="m-0 text-[10.5px] leading-relaxed text-text-faint">
        Hidden from the inbox, kept in the record. A complaint someone may come back about should not vanish
        because a row was tidied away.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="shrink-0 text-[11.5px] text-text-faint">{label}</span>
      <span className="min-w-0 truncate text-[12px] text-text-primary">{value}</span>
    </div>
  );
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
