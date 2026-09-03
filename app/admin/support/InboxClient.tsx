"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, Pin, Trash2, Check, X, Send, Loader2, Globe, MessageCircle, Phone,
  ChevronLeft, AlertTriangle, Paperclip, MoreHorizontal, SlidersHorizontal,
  Pencil, Hash, MapPin, Mail, Plus, StickyNote, Pause, Play,
} from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
// من `inboxChannels` لا من `inbox`: التاني بيجرّ `web-push` للمتصفّح.
import { CHANNEL_LABEL, type Channel } from "@/lib/inboxChannels";
import { countryName } from "@/lib/countries";

const CHANNEL_ICON: Record<string, typeof Globe> = {
  WEB: Globe,
  WHATSAPP: Phone,
  MESSENGER: MessageCircle,
};

interface ThreadRow {
  id: string; channel: string; name: string; email: string; phone: string | null;
  subject: string; status: string; pinned: boolean; unread: boolean; tags: string[];
  assignedToId: string | null; assignedToName: string | null;
  lastMessageAt: string; messageCount: number; unreadCount: number; preview: string;
  avatarUrl: string | null;
}

interface Note {
  id: string; body: string; createdAt: string;
  author: { name: string | null; email: string };
}

interface ActiveThread {
  id: string; channel: string; name: string; email: string; phone: string | null;
  country: string | null; subject: string; status: string; pinned: boolean;
  tags: string[]; assignedToId: string | null; userId: string | null;
  createdAt: string; lastMessageAt: string; category: string | null;
  messages: Array<{
    id: string; fromSupport: boolean; body: string; imageUrls: string[]; createdAt: string;
  }>;
  notes: Note[];
}

interface Agent { id: string; name: string | null; email: string; online: boolean }

export function InboxClient({
  threads, active, history, counts, statusCounts, agents, tags, filters, activeAvatar,
}: {
  threads: ThreadRow[];
  active: ActiveThread | null;
  /** صورةُ صاحب المحادثة المفتوحة - `null` لقناةٍ بلا حساب (واتساب). */
  activeAvatar: string | null;
  history: Array<{ id: string; subject: string; status: string; channel: string; lastMessageAt: string }>;
  counts: Record<string, number>;
  statusCounts: Record<string, number>;
  agents: Agent[];
  tags: string[];
  filters: { channel: string; status: string; unread: boolean; assigned: string; tag: string; q: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(filters.q);

  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.push(`/admin/support?${next.toString()}`);
  }

  useEffect(() => {
    if (q === filters.q) return;
    const id = setTimeout(() => go({ q: q || null, thread: null }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // 🔴 **الصندوق كان ساكناً حتى تُعاد الصفحة.**
  //
  // رسالةٌ جديدة بتوصل القاعدة وبتظهر في الترتيب - لكن على شاشةٍ مفتوحة
  // مافيش حاجة بتقول لها. فالدعم قاعد قدّام صندوقٍ فيه جديد وهو مش شايفه،
  // وهو بالظبط الوقت اللي بيتقاس عليه.
  //
  // تحديثٌ كلّ عشر ثوانٍ، **ويقف لمّا التبويب يبقى في الخلفية**: تبويبٌ
  // متروكٌ مفتوح يومين مايستهلكش استعلاماً كلّ عشر ثوانٍ بلا أحد يقرؤه.
  // (ده استطلاعٌ لا بثّ - الحلّ الصحيح SSE، لكنّه بنيةٌ أكبر بكتير من
  // المكسب هنا وعدد المستخدمين اللي بيفتحوا الصندوق قليل.)
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, 10_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  const total = Object.values(counts).reduce((a, z) => a + z, 0);
  const statusAll = Object.values(statusCounts).reduce((a, z) => a + z, 0);

  // الرقائقُ المفعَّلة فوق القائمة - كلُّ واحدة بتتشال بدوسة. الفلتر
  // النشط لازم يبقى **مرئياً حيث النتيجة**، لا في عمودٍ تاني بره النظر:
  // قائمةٌ قصيرة بلا سببٍ ظاهر بتتقري "مافيش حاجة" لا "الفلتر ضيّق".
  const chips: Array<{ label: string; clear: Record<string, string | null> }> = [];
  if (filters.status !== "ALL") chips.push({ label: title(filters.status), clear: { status: null } });
  if (filters.channel !== "ALL") chips.push({ label: CHANNEL_LABEL[filters.channel as Channel] ?? filters.channel, clear: { channel: null } });
  if (filters.unread) chips.push({ label: "Unread", clear: { unread: null } });
  if (filters.tag) chips.push({ label: filters.tag, clear: { tag: null } });
  if (filters.assigned === "UNASSIGNED") chips.push({ label: "Unassigned", clear: { assigned: null } });
  else if (filters.assigned) {
    const a = agents.find((x) => x.id === filters.assigned);
    if (a) chips.push({ label: a.name ?? a.email, clear: { assigned: null } });
  }

  return (
    // 🔴 الشبكة بتتغيّر بوجود محادثةٍ مفتوحة لا بعرض الشاشة وحده.
    // كانت بتحجز عمودَ التفاصيل دايماً، فلمّا مفيش محادثة مفتوحة بيفضل
    // العمود فاضياً ويضغط عمودَ المحادثة ويسيب فراغاً ميّتاً على اليمين.
    <div
      className={`grid gap-3 lg:grid-cols-[200px_minmax(0,300px)_minmax(0,1fr)] ${
        active ? "xl:grid-cols-[210px_320px_minmax(0,1fr)_270px]" : ""
      }`}
    >
      {/* ═══ ١) الفلاتر - والبحثُ على رأسها ═══
          البحث فوق عمود الفلاتر لا فوق القائمة، زيّ المرجع: هو أوسعُ
          فلترٍ فيهم، ووضعُه جوّه القائمة بيخلّيه يبان تابعاً للنتيجة
          المعروضة لا محدِّداً لها. */}
      <aside className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:overflow-visible lg:px-0 lg:pb-0">
        <div className="relative mb-4 hidden lg:block">
          <Search size={14} className="pointer-events-none absolute inset-inline-start-0 top-1/2 ms-2.5 -translate-y-1/2 text-text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chat"
            className="field field-sm field-icon-start h-9 w-full"
          />
        </div>

        <Group label="Inbox">
          <Row
            active={filters.channel === "ALL" && !filters.unread && !filters.assigned && filters.status === "ALL"}
            onClick={() => go({ channel: null, unread: null, assigned: null, status: null, tag: null })}
            count={total}
          >
            All
          </Row>
          <Row active={filters.unread} onClick={() => go({ unread: filters.unread ? null : "1" })}>
            Unread
          </Row>
          <Row
            active={filters.assigned === "UNASSIGNED"}
            onClick={() => go({ assigned: filters.assigned === "UNASSIGNED" ? null : "UNASSIGNED" })}
          >
            Unassigned
          </Row>
        </Group>

        <Group label="Status">
          <Row active={filters.status === "ALL"} onClick={() => go({ status: null, thread: null })} dot="muted" count={statusAll}>
            All
          </Row>
          {(["OPEN", "ANSWERED", "CLOSED"] as const).map((s) => (
            <Row
              key={s}
              active={filters.status === s}
              onClick={() => go({ status: filters.status === s ? null : s, thread: null })}
              dot={s === "OPEN" ? "open" : s === "ANSWERED" ? "answered" : "closed"}
              count={statusCounts[s] ?? 0}
            >
              {title(s)}
            </Row>
          ))}
        </Group>

        <Group label="Channel">
          <Row active={filters.channel === "ALL"} onClick={() => go({ channel: null, thread: null })} icon={Globe} count={total}>
            All
          </Row>
          {(["WEB", "WHATSAPP", "MESSENGER"] as Channel[]).map((c) => (
            <Row
              key={c}
              active={filters.channel === c}
              onClick={() => go({ channel: filters.channel === c ? null : c, thread: null })}
              icon={CHANNEL_ICON[c]}
              count={counts[c] ?? 0}
            >
              {CHANNEL_LABEL[c]}
            </Row>
          ))}
        </Group>

        {tags.length > 0 && (
          <Group label="Tags">
            {tags.slice(0, 10).map((t) => (
              <Row key={t} active={filters.tag === t} onClick={() => go({ tag: filters.tag === t ? null : t, thread: null })}>
                {t}
              </Row>
            ))}
          </Group>
        )}

        <Group label="Agents">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => go({ assigned: filters.assigned === a.id ? null : a.id, thread: null })}
              className={`mb-0.5 flex w-full shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors ${
                filters.assigned === a.id ? "bg-critical/12" : "hover:bg-surface-raised"
              }`}
            >
              <Avatar name={a.name ?? a.email} online={a.online} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-text-primary">{a.name ?? a.email.split("@")[0]}</span>
                {/* «نشِط» هنا = نشاطٌ خلال خمس دقائق، مش presence بسوكت.
                    الفرق مهم: ادّعاءُ «أونلاين» على حدّ قافل من ساعة
                    بيخلّي الفريق يستنّى ردّاً مش جايّ. */}
                <span className="block text-[10.5px] text-text-faint">{a.online ? "Active now" : "Away"}</span>
              </span>
            </button>
          ))}
        </Group>
      </aside>

      {/* ═══ ٢) القائمة ═══ */}
      <div className="min-w-0">
        <div className="mb-2 lg:hidden">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute inset-inline-start-0 top-1/2 ms-2.5 -translate-y-1/2 text-text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chat" className="field field-sm field-icon-start h-8 w-full" />
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-border text-text-faint">
            <SlidersHorizontal size={13} />
          </span>
          {chips.length === 0 ? (
            <span className="text-[11.5px] text-text-faint">No filters</span>
          ) : (
            chips.map((c) => (
              <button
                key={c.label}
                onClick={() => go(c.clear)}
                className="flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/8 px-2 py-1 text-[11.5px] text-accent"
              >
                {c.label}
                <X size={11} />
              </button>
            ))
          )}
        </div>

        {threads.length === 0 ? (
          <p className="m-0 px-2 py-8 text-center text-[12.5px] text-text-faint">Nothing matches this view.</p>
        ) : (
          <div className="flex max-h-[calc(100dvh-14rem)] flex-col gap-1 overflow-y-auto pe-0.5">
            {threads.map((t) => (
              <ThreadRowItem key={t.id} row={t} activeId={active?.id ?? null} onOpen={() => go({ thread: t.id })} onChanged={() => router.refresh()} />
            ))}
          </div>
        )}
      </div>

      {/* ═══ ٣) المحادثة ═══ */}
      <div className="min-w-0">
        {active ? (
          <Conversation thread={active} agents={agents} avatarUrl={activeAvatar} onChanged={() => router.refresh()} onClose={() => go({ thread: null })} />
        ) : (
          <div className="grid h-[calc(100dvh-11rem)] place-items-center rounded-2xl border border-dashed border-border text-center">
            <p className="m-0 text-[12.5px] text-text-faint">Pick a conversation to read it.</p>
          </div>
        )}
      </div>

      {/* ═══ ٤) التفاصيل والملاحظات ═══ */}
      {active && (
        <aside className="min-w-0">
          <Details thread={active} history={history} tags={tags} avatarUrl={activeAvatar} onChanged={() => router.refresh()} />
        </aside>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════

function title(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/** صورةُ الحساب لو رفعها صاحبُها، وإلّا حروفُ الاسم.
 *
 *  الحروفُ مش بديلٌ أدنى: عميلٌ جايّ من واتساب مالوش صورة عندنا أصلاً،
 *  ولونٌ ثابت مشتقٌّ من الاسم بيفرّق الصفوف أسرع من قراءتها. */
function Avatar({
  name, online, size = 28, src,
}: { name: string; online?: boolean; size?: number; src?: string | null }) {
  const initials =
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  // لونٌ ثابت لكلّ اسم: عشوائيٌّ لكن **مستقرّ**، فالصفّ بيفضل بلونه بين
  // الفتحات ويتعرف عليه بالعين قبل القراءة.
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span
          className="grid h-full w-full place-items-center rounded-full font-semibold text-white"
          style={{ backgroundColor: `hsl(${hue} 55% 45%)`, fontSize: Math.round(size * 0.36) }}
        >
          {initials}
        </span>
      )}
      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-surface ${
            online ? "bg-verified" : "bg-text-faint"
          }`}
        />
      )}
    </span>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 shrink-0">
      <div className="hidden px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint lg:block">
        {label}
      </div>
      <div className="flex gap-1 lg:block">{children}</div>
    </div>
  );
}

const DOT: Record<string, string> = {
  open: "bg-accent",
  answered: "bg-verified",
  closed: "bg-text-faint",
  muted: "bg-border-visible",
};

function Row({
  children, active, onClick, icon: Icon, count, dot,
}: {
  children: React.ReactNode; active: boolean; onClick: () => void;
  icon?: typeof Globe; count?: number; dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`mb-0.5 flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors lg:w-full ${
        active ? "bg-critical/12 font-medium text-critical" : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
      }`}
    >
      {dot && <span className={`size-1.5 shrink-0 rounded-full ${DOT[dot]}`} />}
      {Icon && <Icon size={13} className="shrink-0" />}
      <span className="truncate">{children}</span>
      {count !== undefined && (
        <span className="ms-auto shrink-0 tabular-nums text-[11px] text-text-faint">{count}</span>
      )}
    </button>
  );
}

function ThreadRowItem({
  row, activeId, onOpen, onChanged,
}: { row: ThreadRow; activeId: string | null; onOpen: () => void; onChanged: () => void }) {
  const Icon = CHANNEL_ICON[row.channel] ?? Globe;
  const [menu, setMenu] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setMenu(false);
    await fetch(`/api/admin/inbox/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify(body),
    }).catch(() => null);
    onChanged();
  }

  return (
    // 🔴 **حدٌّ على كلّ صفّ + ظلُّ البطاقة = خطّان حوالين كلّ شيء.**
    // القائمةُ فيها ستّون صفّاً، وحدٌّ دائم على كلٍّ منها بيحوّلها لشبكةٍ
    // من المربّعات بدل قائمةٍ تُقرأ. الفصلُ بالمسافة والخلفية يكفي،
    // والحدُّ بيتحجز للصفّ المفتوح وحده - فيبقى له معنى لمّا يظهر.
    <div
      className={`group/row relative rounded-xl transition-colors ${
        row.id === activeId
          ? "bg-accent/8 ring-1 ring-accent/40"
          : "bg-surface hover:bg-surface-raised"
      }`}
    >
      <button onClick={onOpen} className="flex w-full items-start gap-2.5 p-2.5 text-start">
        <Avatar name={row.name} size={36} src={row.avatarUrl} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <Icon size={11} className="shrink-0 text-text-faint" />
            <span className={`truncate text-[12.5px] ${row.unread ? "font-semibold text-text-primary" : "text-text-primary"}`}>
              {row.name}
            </span>
            {row.pinned && <Pin size={10} className="shrink-0 text-accent" />}
            <span className="ms-auto shrink-0 pe-4 text-[10.5px] text-text-faint">{ago(row.lastMessageAt)}</span>
          </span>
          <span className="mt-0.5 block truncate pe-6 text-[11.5px] text-text-muted">{row.preview || row.subject}</span>
          {(row.tags.length > 0 || row.assignedToName) && (
            <span className="mt-1 flex flex-wrap items-center gap-1">
              {row.assignedToName && (
                <span className="rounded bg-accent/12 px-1.5 py-0.5 text-[10px] text-accent">{row.assignedToName}</span>
              )}
              {row.tags.slice(0, 3).map((t) => (
                <span key={t} className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-text-faint">{t}</span>
              ))}
            </span>
          )}
        </span>
      </button>

      {/* عدّادٌ أحمر زيّ المرجع - والرقمُ **غيرُ المقروء** لا كلّ الرسائل. */}
      {row.unreadCount > 0 && (
        <span className="pointer-events-none absolute bottom-2.5 end-2.5 grid min-w-[18px] place-items-center rounded-md bg-critical px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {row.unreadCount > 99 ? "99+" : row.unreadCount}
        </span>
      )}

      <button
        onClick={() => setMenu((m) => !m)}
        aria-label="More"
        className="absolute end-2 top-2 rounded p-0.5 text-text-faint opacity-0 transition-opacity hover:text-text-primary focus-visible:opacity-100 group-hover/row:opacity-100"
      >
        <MoreHorizontal size={14} />
      </button>

      {menu && (
        <>
          {/* طبقةٌ شفّافة بتقفل القائمة عند أيّ دوسة بره - من غيرها بتفضل
              مفتوحة وانت بتتنقّل، وبتغطّي الصفّ اللي تحتها. */}
          <button className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setMenu(false)} />
          <div className="absolute end-2 top-8 z-20 w-40 overflow-hidden rounded-xl border border-border-visible bg-surface py-1 shadow-lg">
            <MenuItem onClick={() => patch({ pinned: !row.pinned })} icon={Pin}>
              {row.pinned ? "Unpin" : "Pin to top"}
            </MenuItem>
            <MenuItem onClick={() => patch({ markRead: true })} icon={Check}>Mark read</MenuItem>
            <MenuItem onClick={() => patch({ status: row.status === "CLOSED" ? "OPEN" : "CLOSED" })} icon={row.status === "CLOSED" ? Play : Pause}>
              {row.status === "CLOSED" ? "Reopen" : "Close"}
            </MenuItem>
            <MenuItem onClick={() => patch({ deleted: true })} icon={Trash2} danger>Remove</MenuItem>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  children, onClick, icon: Icon, danger,
}: { children: React.ReactNode; onClick: () => void; icon: typeof Pin; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-start text-[12px] transition-colors hover:bg-surface-raised ${
        danger ? "text-critical" : "text-text-muted hover:text-text-primary"
      }`}
    >
      <Icon size={12} className="shrink-0" />
      {children}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════

function Conversation({
  thread, agents, avatarUrl, onChanged, onClose,
}: {
  thread: ActiveThread; agents: Agent[]; avatarUrl: string | null;
  onChanged: () => void; onClose: () => void;
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

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

  const lastInbound = [...thread.messages].reverse().find((m) => !m.fromSupport);
  const windowOpen =
    thread.channel === "WEB" ||
    (!!lastInbound && Date.now() - new Date(lastInbound.createdAt).getTime() < 24 * 3600_000);

  return (
    <div className="card flex h-[calc(100dvh-11rem)] flex-col overflow-hidden">
      {/* رأسٌ زيّ المرجع: أفتار + اسم + حالة، والأفعال يمين.
          🔴 **الأفعال بتنزل سطراً تحت قبل ما الاسم يتقصّ.** كانت في نفس
          الصفّ بـ`flex-wrap`، فالاسم (وهو الوحيد اللي بيقدر ينكمش) كان
          بياخد الباقي - وعلى عمودٍ متوسّط بقى «Ab…» و«We…». الاسمُ هو
          هويّة الشاشة كلّها، فهو آخر شيء يُقصّ لا أوّله. */}
      <div className="border-b border-border p-3">
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="btn-icon lg:hidden" aria-label="Back">
          <ChevronLeft size={16} />
        </button>
        <Avatar name={thread.name} size={36} src={avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-text-primary">{thread.name}</div>
          <div className="truncate text-[11px] text-text-faint">
            {CHANNEL_LABEL[thread.channel as Channel] ?? thread.channel}
            {" · "}
            {/* حالةُ نافذة الردّ، لا حالةُ اتّصال العميل: دي الحقيقة اللي
                بتفرق فعلاً - تقدر تردّ دلوقتي ولا لأ. */}
            <span className={windowOpen ? "text-verified" : "text-gap"}>
              {windowOpen ? "Can reply" : "Reply window closed"}
            </span>
          </div>
        </div>

      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <select
          value={thread.assignedToId ?? ""}
          onChange={(e) => patch({ assignedToId: e.target.value || null })}
          className="field field-sm h-7 min-w-0 flex-1 sm:max-w-[11rem] sm:flex-none"
          aria-label="Assign"
        >
          <option value="">Unassigned</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name ?? a.email}</option>)}
        </select>

        <button onClick={() => patch({ pinned: !thread.pinned })} className="btn-icon shrink-0" aria-label={thread.pinned ? "Unpin" : "Pin"}>
          <Pin size={15} className={thread.pinned ? "text-accent" : ""} />
        </button>
        <button onClick={() => patch({ status: thread.status === "CLOSED" ? "OPEN" : "CLOSED" })} className="btn btn-sm h-7 shrink-0 px-2.5">
          {thread.status === "CLOSED" ? "Reopen" : <><Check size={13} className="me-1" />Close</>}
        </button>
      </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {thread.messages.map((m, i) => (
          <Fragment key={m.id}>
          {/* فاصلُ الجلسة: نفس العميل ونفس المحادثة، وفجوةٌ في الوقت بتقول
              «ده موضوعٌ تاني». الفصلُ لمحادثاتٍ منفصلة كان بيفرّق تاريخ
              الشخص الواحد على صفوفٍ مالهاش سياقٌ مشترك. */}
          {startsNewSession(thread.messages[i - 1]?.createdAt, m.createdAt) && (
            <div className="my-1 flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <span className="shrink-0 text-[10.5px] text-text-faint">{sessionDate(m.createdAt)}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          )}
          <div className={`flex ${m.fromSupport ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">
              <div
                className={`rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap ${
                  m.fromSupport ? "bg-accent text-white" : "bg-surface-raised text-text-primary"
                }`}
              >
                {m.body}
                {m.imageUrls.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt="" className="mt-1.5 max-h-56 rounded-lg" />
                ))}
              </div>
              {/* الوقت **تحت** الفقاعة لا جوّاها، زيّ المرجع: جوّاها بياكل
                  من عرض النصّ ويكسر السطر الأخير بلا داعٍ. */}
              <div className={`mt-0.5 text-[10px] text-text-faint ${m.fromSupport ? "text-end" : ""}`}>
                {time(m.createdAt)}
              </div>
            </div>
          </div>
          </Fragment>
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
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="Write a reply…  (Enter to send, Shift+Enter for a new line)"
          rows={2}
          className="field w-full text-[12.5px]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[11px] text-text-faint">
            <Paperclip size={12} />
            Attachments from the customer show inline
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
  thread, history, tags, avatarUrl, onChanged,
}: {
  thread: ActiveThread;
  avatarUrl: string | null;
  history: Array<{ id: string; subject: string; status: string; channel: string; lastMessageAt: string }>;
  tags: string[];
  onChanged: () => void;
}) {
  const [newTag, setNewTag] = useState("");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/admin/inbox/${thread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify(body),
    }).catch(() => null);
    onChanged();
  }

  async function addNote() {
    if (!note.trim() || savingNote) return;
    setSavingNote(true);
    const res = await fetch(`/api/admin/inbox/${thread.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ body: note.trim() }),
    }).catch(() => null);
    setSavingNote(false);
    if (res?.ok) { setNote(""); onChanged(); }
  }

  async function removeNote(noteId: string) {
    await fetch(`/api/admin/inbox/${thread.id}/notes?noteId=${encodeURIComponent(noteId)}`, {
      method: "DELETE",
      headers: getCsrfHeader(),
    }).catch(() => null);
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-surface p-3">
        <div className="mb-2 flex items-center gap-2">
          <Avatar name={thread.name} size={36} src={avatarUrl} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">{thread.name}</span>
        </div>
        <Field icon={Globe} label="Channel" value={CHANNEL_LABEL[thread.channel as Channel] ?? thread.channel} />
        <Field icon={Hash} label="ID" value={thread.id.slice(-12)} />
        {thread.email && <Field icon={Mail} label="Email" value={thread.email} />}
        {thread.phone && <Field icon={Phone} label="Phone" value={thread.phone} />}
        {thread.country && <Field icon={MapPin} label="Country" value={countryName(thread.country, "en")} />}
        <Field icon={Plus} label="First seen" value={new Date(thread.createdAt).toLocaleDateString("en-GB")} />
      </div>

      <div className="rounded-xl bg-surface p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
          <Pencil size={10} /> Tags
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
        <datalist id="inbox-tags">{tags.map((t) => <option key={t} value={t} />)}</datalist>
      </div>

      {/* ═══ الملاحظات - يقرؤها الفريق والعميل لا ═══ */}
      <div className="rounded-xl bg-surface p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
          <StickyNote size={10} /> Notes
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/Cmd+Enter مش Enter وحده: الملاحظة أطول من الردّ عادةً،
            // وEnter وحده كان هيقطعها عند أوّل سطر جديد.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addNote(); }
          }}
          rows={2}
          placeholder="Write a note… (only your team sees this)"
          className="field w-full text-[12px]"
        />
        <button onClick={addNote} disabled={savingNote || !note.trim()} className="btn btn-sm mt-1.5 h-7 w-full">
          {savingNote ? <Loader2 size={12} className="animate-spin" /> : "Add note"}
        </button>

        {thread.notes.length > 0 && (
          <ul className="m-0 mt-2.5 list-none space-y-2 border-t border-border p-0 pt-2.5">
            {thread.notes.map((n) => (
              <li key={n.id} className="group/note flex gap-2">
                <Avatar name={n.author.name ?? n.author.email} size={22} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-[11.5px] font-medium text-text-primary">
                      {n.author.name ?? n.author.email.split("@")[0]}
                    </span>
                    <span className="shrink-0 text-[10px] text-text-faint">{dateTime(n.createdAt)}</span>
                    <button
                      onClick={() => removeNote(n.id)}
                      aria-label="Delete note"
                      className="ms-auto shrink-0 rounded p-0.5 text-text-faint opacity-0 transition-opacity hover:text-critical focus-visible:opacity-100 group-hover/note:opacity-100"
                    >
                      <X size={11} />
                    </button>
                  </div>
                  <p className="m-0 whitespace-pre-wrap text-[11.5px] leading-relaxed text-text-muted">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {history.length > 0 && (
        <div className="rounded-xl bg-surface p-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
            Earlier conversations
          </div>
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

function Field({ icon: Icon, label, value }: { icon: typeof Globe; label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <Icon size={12} className="shrink-0 translate-y-0.5 text-text-faint" />
      <span className="shrink-0 text-[11.5px] text-text-faint">{label}</span>
      <span className="ms-auto min-w-0 truncate text-[12px] text-text-primary">{value}</span>
    </div>
  );
}

/** ساعتان - نفس عتبةِ الودجت عند العميل، فالجلسة واحدةٌ عند الطرفين. */
const SESSION_GAP_MS = 2 * 60 * 60 * 1000;

function startsNewSession(previous: string | undefined, current: string): boolean {
  if (!previous) return false;
  return new Date(current).getTime() - new Date(previous).getTime() > SESSION_GAP_MS;
}

function sessionDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function dateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
