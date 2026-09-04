"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, Pin, Trash2, Check, X, Send, Loader2, Globe, MessageCircle, Phone,
  ChevronLeft, AlertTriangle, Paperclip, MoreHorizontal, SlidersHorizontal,
  Pencil, Hash, MapPin, Mail, Plus, StickyNote, Clock, Archive, MailOpen,
} from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
// من `inboxChannels` لا من `inbox`: التاني بيجرّ `web-push` للمتصفّح.
import { CHANNEL_LABEL, type Channel } from "@/lib/inboxChannels";
import { countryName } from "@/lib/countries";
import { ImageLightbox } from "@/app/components/ui/ImageLightbox";

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

const STATUSES = ["OPEN", "ANSWERED", "CLOSED", "ARCHIVED"] as const;
const CHANNELS: Channel[] = ["WEB", "WHATSAPP", "MESSENGER"];
/** «مُتابَعة» تسميةُ `ANSWERED` على الشاشة: مش كلُّ متابعةٍ سؤالٌ منتظرٌ
 *  ردّاً - ممكن تبقى علامةَ حسابٍ مهمّ يُرجَع له. */
const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open", ANSWERED: "Follow-up", CLOSED: "Done", ARCHIVED: "Archive",
};

export function InboxClient({
  threads, active, history, counts, statusCounts, assigneeCounts, agents, tags, filters,
  activeAvatar, canDelete,
}: {
  threads: ThreadRow[];
  active: ActiveThread | null;
  /** صورةُ صاحب المحادثة المفتوحة - `null` لقناةٍ بلا حساب (واتساب). */
  activeAvatar: string | null;
  history: Array<{ id: string; subject: string; status: string; channel: string; lastMessageAt: string }>;
  counts: Record<string, number>;
  statusCounts: Record<string, number>;
  assigneeCounts: Record<string, number>;
  agents: Agent[];
  tags: string[];
  filters: { channel: string[]; status: string[]; unread: boolean; assigned: string[]; tag: string[]; q: string };
  /** المالكُ وحده بيشوف زرَّ الحذف النهائيّ - الدعمُ بيأرشف. */
  canDelete: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(filters.q);
  const [filterOpen, setFilterOpen] = useState(false);

  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.push(`/admin/support?${next.toString()}`);
  }

  /** بيضيف/بيشيل قيمةً من فلترٍ متعدّد. القائمةُ الفاضية بتتشال من الرابط
   *  خالص فيرجع لـ«بلا قيد» - لا `?channel=` فاضية تتقري قيداً على لا شيء. */
  function toggle(key: "channel" | "status" | "assigned" | "tag", value: string, current: string[]) {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    go({ [key]: next.join(",") || null, thread: null });
  }

  /** بيثبّت قيمةً واحدة مكان أيّ اختيارٍ سابق في نفس البُعد - للأعمدة
   *  الجانبية اللي بتتصرّف كتنقّلٍ لا كفلترٍ مركَّب. */
  function only(key: "channel" | "status" | "assigned" | "tag", value: string, current: string[]) {
    const same = current.length === 1 && current[0] === value;
    go({ [key]: same ? null : value, thread: null });
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
  // 🔴 **كان بيعيد رسم الصفحة كلّها كلّ عشر ثوانٍ - وده كان بيحرق حدَّ
  // نقل البيانات في قاعدة البيانات.**
  //
  // `router.refresh()` بيرجّع تصييرَ مكوّن الخادم من أوّله: الستّون محادثة
  // برسائلها، وتلاتُ تجميعاتٍ للعدّادات، وخمسمئة صفِّ وسوم، والمحادثةُ
  // المفتوحة كلّها. عشرةُ استعلامات كلّ عشر ثوانٍ - وأغلبُ ما بترجّعه نفسُ
  // البايتات اللي رجعت قبلها بعشر ثوانٍ.
  //
  // بقى: نبضةٌ رخيصة (`/api/admin/inbox/pulse`) كلّ عشرين ثانية بترجّع
  // رقمين، والتصييرُ الكامل بيحصل **لمّا الرقمين يتغيّروا وبس**. فصندوقٌ
  // هادي بيكلّف تجميعةً واحدة كلّ عشرين ثانية بدل عشرة استعلامات كلّ عشرة.
  // وواقفٌ تماماً والتبويبُ في الخلفية.
  const pulseRef = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/admin/inbox/pulse");
        if (!res.ok || !alive) return;
        const { n, t } = await res.json();
        const sig = `${n}:${t}`;
        // أوّلُ نبضةٍ بتسجّل الحالة وبس: التصييرُ اللي إحنا فيه أحدثُ
        // منها أصلاً، وطلبُه تاني بيخلّي كلَّ فتحةِ صفحة تتحمّل مرّتين.
        if (pulseRef.current !== null && pulseRef.current !== sig) router.refresh();
        pulseRef.current = sig;
      } catch {
        // شبكةٌ وقعت: النبضةُ الجاية هتلاقيها. مافيش رسالةُ خطأ لحاجةٍ
        // العميلُ لا طلبها ولا بيستنّاها.
      }
    };
    void tick();
    const id = setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  const total = Object.values(counts).reduce((a, z) => a + z, 0);
  // «الكلّ» في عمود الحالة لازم يستثني الأرشيف زيّ ما القائمةُ نفسها
  // بتستثنيه - رقمٌ أكبر من عدد الصفوف المعروضة بيتقري صفوفاً ضاعت.
  const statusAll = Object.entries(statusCounts)
    .filter(([k]) => k !== "ARCHIVED")
    .reduce((a, [, z]) => a + z, 0);

  // الرقائقُ المفعَّلة فوق القائمة - كلُّ واحدة بتتشال بدوسة. الفلتر
  // النشط لازم يبقى **مرئياً حيث النتيجة**، لا في عمودٍ تاني بره النظر:
  // قائمةٌ قصيرة بلا سببٍ ظاهر بتتقري "مافيش حاجة" لا "الفلتر ضيّق".
  // رقيقةٌ لكلّ **قيمة** لا لكلّ بُعد: اختيارُ قناتين بيبان قناتين تتشال
  // كلُّ واحدةٍ لوحدها، مش رقيقةً واحدة بتمسح الاتنين.
  const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
  for (const s of filters.status)
    chips.push({ key: `s:${s}`, label: STATUS_LABEL[s] ?? title(s), onClear: () => toggle("status", s, filters.status) });
  for (const c of filters.channel)
    chips.push({ key: `c:${c}`, label: CHANNEL_LABEL[c as Channel] ?? c, onClear: () => toggle("channel", c, filters.channel) });
  for (const a of filters.assigned) {
    const agent = agents.find((x) => x.id === a);
    chips.push({
      key: `a:${a}`,
      label: a === "UNASSIGNED" ? "Unassigned" : agent?.name ?? agent?.email ?? "Agent",
      onClear: () => toggle("assigned", a, filters.assigned),
    });
  }
  for (const t of filters.tag)
    chips.push({ key: `t:${t}`, label: t, onClear: () => toggle("tag", t, filters.tag) });
  if (filters.unread) chips.push({ key: "unread", label: "Unread", onClear: () => go({ unread: null }) });

  const noFilters =
    filters.channel.length === 0 && filters.status.length === 0 &&
    filters.assigned.length === 0 && filters.tag.length === 0 && !filters.unread;

  return (
    <div>
      {/* ═══ شريطٌ واحد فوق الأعمدة كلّها ═══
          🔴 كان البحثُ في العمود الأوّل والرقائقُ في التاني، فكلُّ عمودٍ
          بيبدأ عند ارتفاعٍ مختلف والشاتُ بيبان أوطى من قائمته بصفٍّ كامل.
          الشريطُ فوقهم بيخلّيهم يبدأوا من نفس السطر - وهو مكانُه الصحيح
          أصلاً: البحثُ والفلاترُ بيحكموا الأعمدة التلاتة لا عموداً منها. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute inset-inline-start-0 top-1/2 ms-2.5 -translate-y-1/2 text-text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chat"
            className="field field-sm field-icon-start h-8 w-full"
          />
        </div>

        {/* 🔴 **قائمةُ فلاتر حقيقية.** كانت أيقونةً بتمسح الكلّ وبس، وقبلها
            رمزاً بلا فعل. الفلاترُ كلُّها موجودة في العمود الأوّل، لكنّه
            بيختفي على الشاشات الضيّقة وبيتطلّب تمريراً - والقائمةُ هنا
            بتجمعهم في مكانٍ واحد مقسَّمٍ بالفئة، ومتعدّدةَ الاختيار. */}
        <div className="relative shrink-0">
          <button
            onClick={() => setFilterOpen((o) => !o)}
            title="Filters"
            className={`grid size-8 place-items-center rounded-lg transition-colors ${
              chips.length > 0
                ? "bg-critical/12 text-critical"
                : "text-text-faint hover:bg-surface-raised hover:text-text-primary"
            }`}
          >
            <SlidersHorizontal size={14} />
          </button>

          {/* 🔴 **لوحةٌ عريضةٌ بأعمدة، مش عمودٌ واحد طويل.**
              القائمةُ الرأسية كانت بتنزل أطولَ من الشاشة بمجرّد وجود
              موظَّفين ووسوم، فآخرُ فئةٍ فيها بتتقصّ - والفلترُ اللي
              مايتشافش مايتستعملش. الأعمدةُ بتخلّي الفئات الأربعة كلّها
              في مجال النظر مرّةً واحدة. */}
          {filterOpen && (
            <>
              <button className="fixed inset-0 z-30 cursor-default" aria-label="Close" onClick={() => setFilterOpen(false)} />
              <div className="absolute inset-inline-start-0 z-40 mt-1 w-[min(92vw,34rem)] overflow-hidden rounded-xl border border-border-visible bg-surface shadow-lg">
                <div className="grid max-h-[60vh] grid-cols-2 gap-x-1 overflow-y-auto p-1 sm:grid-cols-3">
                  <FilterSection label="Status">
                    {STATUSES.map((v) => (
                      <FilterCheck
                        key={v}
                        label={STATUS_LABEL[v]}
                        count={statusCounts[v] ?? 0}
                        checked={filters.status.includes(v)}
                        onToggle={() => toggle("status", v, filters.status)}
                      />
                    ))}
                  </FilterSection>

                  <FilterSection label="Channel">
                    {CHANNELS.map((c) => (
                      <FilterCheck
                        key={c}
                        label={CHANNEL_LABEL[c]}
                        count={counts[c] ?? 0}
                        checked={filters.channel.includes(c)}
                        onToggle={() => toggle("channel", c, filters.channel)}
                      />
                    ))}
                  </FilterSection>

                  {/* «مسنَد لـ» بيفتح على الفريق نفسه لا على «مسنَد/غير
                      مسنَد» وبس: السؤالُ العمليّ هو «إيه اللي على فلان». */}
                  <FilterSection label="Assigned to">
                    <FilterCheck
                      label="Unassigned"
                      count={assigneeCounts.UNASSIGNED ?? 0}
                      checked={filters.assigned.includes("UNASSIGNED")}
                      onToggle={() => toggle("assigned", "UNASSIGNED", filters.assigned)}
                    />
                    {agents.map((a) => (
                      <FilterCheck
                        key={a.id}
                        label={a.name ?? a.email.split("@")[0]}
                        count={assigneeCounts[a.id] ?? 0}
                        checked={filters.assigned.includes(a.id)}
                        onToggle={() => toggle("assigned", a.id, filters.assigned)}
                      />
                    ))}
                  </FilterSection>

                  <FilterSection label="Other">
                    <FilterCheck
                      label="Unread only"
                      checked={filters.unread}
                      onToggle={() => go({ unread: filters.unread ? null : "1" })}
                    />
                  </FilterSection>

                  {tags.length > 0 && (
                    <FilterSection label="Tags">
                      {tags.slice(0, 12).map((t) => (
                        <FilterCheck
                          key={t}
                          label={t}
                          checked={filters.tag.includes(t)}
                          onToggle={() => toggle("tag", t, filters.tag)}
                        />
                      ))}
                    </FilterSection>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                  <span className="text-[11.5px] text-text-faint">
                    {chips.length === 0 ? "No filters" : `${chips.length} active`}
                  </span>
                  <div className="flex items-center gap-1">
                    {chips.length > 0 && (
                      <button
                        onClick={() => go({ status: null, channel: null, unread: null, tag: null, assigned: null })}
                        className="rounded-lg px-2 py-1 text-[12px] text-critical transition-colors hover:bg-critical/10"
                      >
                        Clear all
                      </button>
                    )}
                    <button
                      onClick={() => setFilterOpen(false)}
                      className="rounded-lg px-2 py-1 text-[12px] text-text-muted transition-colors hover:bg-surface-raised"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={c.onClear}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-accent/8 px-2 py-1 text-[11.5px] text-accent transition-colors hover:bg-accent/15"
          >
            {c.label}
            <X size={11} />
          </button>
        ))}
      </div>

    <div
      className={`grid items-start gap-3 lg:grid-cols-[200px_minmax(0,300px)_minmax(0,1fr)] ${
        active ? "xl:grid-cols-[210px_320px_minmax(0,1fr)_270px]" : ""
      }`}
    >
      {/* ═══ ١) الفلاتر - والبحثُ على رأسها ═══
          البحث فوق عمود الفلاتر لا فوق القائمة، زيّ المرجع: هو أوسعُ
          فلترٍ فيهم، ووضعُه جوّه القائمة بيخلّيه يبان تابعاً للنتيجة
          المعروضة لا محدِّداً لها. */}
      <aside className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:overflow-visible lg:px-0 lg:pb-0">
        <Group label="Inbox">
          <Row
            active={noFilters}
            onClick={() => go({ channel: null, unread: null, assigned: null, status: null, tag: null, thread: null })}
            count={total}
          >
            All
          </Row>
          <Row active={filters.unread} onClick={() => go({ unread: filters.unread ? null : "1" })}>
            Unread
          </Row>
          <Row
            active={filters.assigned.includes("UNASSIGNED")}
            onClick={() => only("assigned", "UNASSIGNED", filters.assigned)}
          >
            Unassigned
          </Row>
        </Group>

        <Group label="Status">
          <Row active={filters.status.length === 0} onClick={() => go({ status: null, thread: null })} dot="muted" count={statusAll}>
            All
          </Row>
          {STATUSES.map((s) => (
            <Row
              key={s}
              active={filters.status.includes(s)}
              onClick={() => only("status", s, filters.status)}
              dot={s === "OPEN" ? "open" : s === "ANSWERED" ? "answered" : s === "CLOSED" ? "closed" : "muted"}
              count={statusCounts[s] ?? 0}
            >
              {STATUS_LABEL[s]}
            </Row>
          ))}
        </Group>

        <Group label="Channel">
          <Row active={filters.channel.length === 0} onClick={() => go({ channel: null, thread: null })} icon={Globe} count={total}>
            All
          </Row>
          {CHANNELS.map((c) => (
            <Row
              key={c}
              active={filters.channel.includes(c)}
              onClick={() => only("channel", c, filters.channel)}
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
              <Row key={t} active={filters.tag.includes(t)} onClick={() => only("tag", t, filters.tag)}>
                {t}
              </Row>
            ))}
          </Group>
        )}

        <Group label="Agents">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => only("assigned", a.id, filters.assigned)}
              className={`mb-0.5 flex w-full shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors ${
                filters.assigned.includes(a.id) ? "bg-critical/12" : "hover:bg-surface-raised"
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
        {threads.length === 0 ? (
          <p className="m-0 px-2 py-8 text-center text-[12.5px] text-text-faint">Nothing matches this view.</p>
        ) : (
          <div className="flex max-h-[calc(100dvh-12.5rem)] flex-col gap-1 overflow-y-auto p-1 -m-1">
            {threads.map((t) => (
              <ThreadRowItem key={t.id} row={t} activeId={active?.id ?? null} onOpen={() => go({ thread: t.id })} onChanged={() => router.refresh()} />
            ))}
          </div>
        )}
      </div>

      {/* ═══ ٣) المحادثة ═══ */}
      <div className="min-w-0">
        {active ? (
          // 🔴🔴 **`key` على معرّف المحادثة - وده أخطر سطر في الملفّ.**
          //
          // بدونه رياكت بيعيد استعمال نفس المكوّن عند التبديل، فالمكتوبُ
          // في مربّع الردّ **والصورةُ المرفوعة** بيفضلوا كما هم. يعني
          // تكتب ردّاً لعميل، تفتح تانياً، وتدوس إرسال على مربّعٍ شكلُه
          // فاضٍ - فيروح ردُّ الأوّل للتاني. تسريبُ بياناتٍ بين عميلين
          // بضغطةٍ واحدة، ومافيش حاجة في الشاشة بتحذّر منه.
          //
          // و`key` بيهدم المكوّن ويبنيه، فكلُّ حالته بتتصفّر مع المحادثة.
          <Conversation
            key={active.id}
            thread={active}
            agents={agents}
            avatarUrl={activeAvatar}
            onChanged={() => router.refresh()}
            onClose={() => go({ thread: null })}
          />
        ) : (
          <div className="grid h-[calc(100dvh-12.5rem)] place-items-center rounded-2xl border border-dashed border-border text-center">
            <p className="m-0 text-[12.5px] text-text-faint">Pick a conversation to read it.</p>
          </div>
        )}
      </div>

      {/* ═══ ٤) التفاصيل والملاحظات ═══ */}
      {active && (
        <aside className="min-w-0">
          <Details
            key={active.id}
            thread={active}
            history={history}
            tags={tags}
            avatarUrl={activeAvatar}
            canDelete={canDelete}
            onChanged={() => router.refresh()}
          />
        </aside>
      )}
    </div>
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
          // تينتٌ واحد بلا حلقة: الحلقةُ كانت بتترسم رمادية حوالين
          // التينت الأحمر فتبان طبقتين، والتينتُ وحده كافٍ للتمييز.
          ? "bg-critical/10"
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
            {/* الفعلُ بيتقلب حسب الحالة: عرضُ «علّم كمقروء» على صفٍّ
                مقروءٍ أصلاً خيارٌ مالوش أثر، وغيابُ عكسِه بيخلّي اللي
                فتح محادثةً بالغلط مالوش طريقٌ يرجّعها لانتباهه. */}
            {row.unread ? (
              <MenuItem onClick={() => patch({ markRead: true })} icon={Check}>Mark read</MenuItem>
            ) : (
              <MenuItem onClick={() => patch({ markUnread: true })} icon={MailOpen}>Mark unread</MenuItem>
            )}
            <MenuItem onClick={() => patch({ status: row.status === "ARCHIVED" ? "OPEN" : "ARCHIVED" })} icon={Archive}>
              {row.status === "ARCHIVED" ? "Bring back" : "Move to archive"}
            </MenuItem>
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
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/support/upload", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) { const d = await res.json(); setImages((p) => [...p, d.url]); }
    else { const d = await res.json().catch(() => null); setWarning(d?.error ?? "The image could not be uploaded."); }
  }

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
    if ((!reply.trim() && images.length === 0) || busy) return;
    setBusy(true);
    setWarning(null);
    const res = await fetch(`/api/admin/inbox/${thread.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ body: reply.trim(), imageUrls: images }),
    }).catch(() => null);
    setBusy(false);

    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setWarning(data?.error ?? "The reply could not be saved.");
      return;
    }
    setReply("");
    setImages([]);
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
    <>
    {zoom && <ImageLightbox src={zoom} onClose={() => setZoom(null)} />}
    <div className="card flex h-[calc(100dvh-12.5rem)] flex-col overflow-hidden">
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

        {/* 🔴 `btn-icon` وحدها بتاخد حدَّ `.btn` وخلفيّتها - فبيظهر مربّعٌ
            حوالين الأيقونة وهي مش زرّاً بمعنى الفعل. أيقونةٌ عارية بحالةِ
            مرورٍ فقط. */}
        <button
          onClick={() => patch({ pinned: !thread.pinned })}
          aria-label={thread.pinned ? "Unpin" : "Pin"}
          title={thread.pinned ? "Unpin" : "Pin"}
          className={`grid size-7 shrink-0 place-items-center rounded-lg transition-colors hover:bg-surface-raised ${
            thread.pinned ? "text-accent" : "text-text-faint hover:text-text-primary"
          }`}
        >
          <Pin size={15} />
        </button>

        {/* حالتان لا واحدة: «خلصت» و«محتاجة متابعة». كان فيه «إغلاق» وحده،
            فالمحادثةُ اللي مستنيّة ردَّ العميل مالهاش مكان - تفضل مفتوحة
            وتزاحم الجديد، أو تتقفل ويتنسى إنّها ناقصة.

            واللونُ في حالة المرور مقصود: زرٌّ ما بيتغيّرش تحت الماوس
            بيخلّي صاحبَه مش متأكّد إنّه فوق زرّ أصلاً. */}
        {/* أيقونةٌ لا مربّعٌ ملوّن: الإيموجي بيتغيّر شكلُه بين المنصّات
            وبيقرا كزخرفة. `Clock` بيقول «مستنّي» وهو المعنى بالظبط. */}
        <button
          onClick={() => patch({ status: thread.status === "ANSWERED" ? "OPEN" : "ANSWERED" })}
          title="Waiting on the customer"
          className={`flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] transition-colors active:scale-95 ${
            thread.status === "ANSWERED"
              ? "border-gap bg-gap text-white"
              : "border-border text-text-muted hover:border-gap/60 hover:bg-gap/10 hover:text-gap"
          }`}
        >
          <Clock size={12} /> Follow-up
        </button>

        {/* «خلصت» بتودّي للأرشيف مباشرةً: القرارُ واحد - المحادثة انتهت
            وماعادتش تزاحم الجديد. وفصلُهما كان بيخلّي كلّ محادثةٍ خالصة
            تحتاج دوستين، فالتانية بتتنسى ويفضل الصندوق مليان بالخالص. */}
        <button
          onClick={() =>
            patch(
              thread.status === "ARCHIVED"
                ? { status: "OPEN" }
                : { status: "ARCHIVED" }
            )
          }
          title={thread.status === "ARCHIVED" ? "Bring back to the inbox" : "Done — moves to the archive"}
          className={`flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] transition-colors active:scale-95 ${
            thread.status === "ARCHIVED"
              ? "border-verified bg-verified text-white"
              : "border-border text-text-muted hover:border-verified/60 hover:bg-verified/12 hover:text-verified"
          }`}
        >
          <Check size={12} /> {thread.status === "ARCHIVED" ? "Reopen" : "Done"}
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
                  <button
                            key={u}
                            onClick={() => setZoom(u)}
                            // 🔴 **حلقةٌ رمادية كانت تُرسَم حول الصورة عند المرور.**
                            // القاعدةُ العامّة في theme.css تعطيها لكلّ زرٍّ عريان،
                            // وهي هنا لا تُقرأ «هذا يُضغط» بل **إطاراً مرسوماً على
                            // الصورة** - وللصور إطارُها الخاصّ من حوافّها المدوّرة.
                            // واستجابةُ المرور الخاصّة تُخرجها من القاعدة تلقائياً.
                            className="block cursor-pointer transition-opacity hover:opacity-90"
                          >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="mt-1.5 max-h-56 rounded-lg" />
                  </button>
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
        {/* zbtnattach: كان اتشال واتحطّ مكانه سطرُ شرح - فالدعم بقى
            مايقدرش يبعت صورة أصلاً، وهي نصفُ الشغل في الدعم التقنيّ. */}
        <div className="mt-2 flex items-center justify-between gap-2">
          {/* المرفقاتُ جنب الشريط لا فوقه: صفٌّ زيادةٌ فوق المربّع بياكل
              من ارتفاع المحادثة الظاهرة في كلّ مرّة بتترفع فيها صورة. */}
          {images.length > 0 && (
            <span className="flex shrink-0 gap-1">
              {images.map((u) => (
                <span key={u} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="size-8 rounded-md object-cover" />
                  <button
                    onClick={() => setImages((p) => p.filter((x) => x !== u))}
                    aria-label="Remove"
                    className="absolute -end-1 -top-1 grid size-3.5 place-items-center rounded-full bg-critical text-white"
                  >
                    <X size={8} />
                  </button>
                </span>
              ))}
            </span>
          )}
          <label
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11.5px] text-text-faint transition-colors hover:bg-surface-raised hover:text-text-primary"
            title="Attach an image"
          >
            <Paperclip size={13} />
            {uploading ? "Uploading..." : "Attach"}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
          <button onClick={send} disabled={busy || (!reply.trim() && images.length === 0)} className="btn btn-primary btn-sm h-8 px-3">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span className="ms-1.5">Send</span>
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════

function Details({
  thread, history, tags, avatarUrl, canDelete, onChanged,
}: {
  thread: ActiveThread;
  avatarUrl: string | null;
  canDelete: boolean;
  history: Array<{ id: string; subject: string; status: string; channel: string; lastMessageAt: string }>;
  tags: string[];
  onChanged: () => void;
}) {
  const [newTag, setNewTag] = useState("");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [confirming, setConfirming] = useState(false);

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

      {/* الأرشفةُ رماديّة والحذفُ أحمر مصمت - الشكلُ بيقول الخطورة قبل
          ما النصّ يتقري. وكان الحذفُ أبيضَ بحدٍّ أحمر، وهو شكلُ الفعل
          الثانويّ لا شكلُ الفعل اللي مالوش رجعة. */}
      {thread.status !== "ARCHIVED" && (
        <button
          onClick={() => patch({ status: "ARCHIVED" })}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-surface-raised px-3 py-2 text-[12px] text-text-muted transition-colors hover:text-text-primary"
        >
          <Archive size={13} /> Move to archive
        </button>
      )}

      {/* 🔴 **الحذفُ النهائيّ للمالك وحده، وبخطوةِ تأكيد.**
          الدعمُ بيقدر يأرشف - وده كافٍ لشغله. والحذفُ بيمسح شكوى عميلٍ
          ممكن يرجع يسأل عنها، فمحتاج مَن يملك القرار ده لا مَن يعالجها. */}
      {canDelete && (
        confirming ? (
          <div className="rounded-xl border border-critical/40 bg-critical/8 p-2.5">
            <p className="m-0 mb-2 text-[11.5px] leading-relaxed text-text-primary">
              Delete this conversation for good? Its messages and notes go with it, and it cannot be brought back.
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => patch({ deleted: true })}
                className="flex-1 rounded-lg bg-critical px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 active:scale-95"
              >
                Delete permanently
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg px-3 py-1.5 text-[12px] text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-critical px-3 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90 active:scale-95"
          >
            <Trash2 size={13} /> Delete permanently
          </button>
        )
      )}
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

/** فئةٌ داخل قائمة الفلاتر - العنوانُ بيقول «دي مجموعةٌ واحدة يُختار منها». */
function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 py-1">
      <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
        {label}
      </div>
      {children}
    </div>
  );
}

/** بندٌ بمربّع اختيار - الشكلُ بيقول إنّ الاختيارَ متعدّد قبل ما يُجرَّب. */
function FilterCheck({
  label, count, checked, onToggle,
}: { label: string; count?: number; checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[12px] transition-colors hover:bg-surface-raised"
    >
      <span
        className={`grid size-3.5 shrink-0 place-items-center rounded border ${
          checked ? "border-critical bg-critical text-white" : "border-border-visible"
        }`}
      >
        {checked && <Check size={9} />}
      </span>
      <span className={`min-w-0 flex-1 truncate ${checked ? "text-text-primary" : "text-text-muted"}`}>{label}</span>
      {count !== undefined && count > 0 && (
        <span className="shrink-0 tabular-nums text-[11px] text-text-faint">{count}</span>
      )}
    </button>
  );
}
