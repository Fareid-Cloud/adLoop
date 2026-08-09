"use client";

// app/components/MarkdownAnswer.tsx
//
// عرض جواب الوكيل.
//
// **الشكل مأخوذ عن مرجعٍ اختاره المالك** (لوحة الوكيل في Cometly): جملةُ
// حكمٍ قصيرة تُغمَّق فيها الأرقام الحاسمة، ثمّ **بطاقة بيانات** لها عنوان
// وسطرٌ يشرح ما تعرضه، وفيها جدولٌ صفُّه الأوّل مجموعٌ، وكلّ رقم يحمل
// جنبه تغيّرَه بلونٍ يقول أصعد أم هبط.
//
// وهذا ليس تنسيقاً فوق النصّ: المقارنة بين ستّ حملات لا تُقرأ في فقرة،
// والرقم بلا تغيّره لا يُقال عنه أهو خبرٌ جيّد أم سيّئ.
//
// **ولماذا عارضٌ مكتوب هنا لا مكتبة:** الأشكال المطلوبة قليلة ومعروفة،
// ومكتبة Markdown كاملة تجرّ معها دعم HTML الخام - وهو المدخل الذي يحوّل
// نصّاً يولّده نموذج إلى ثغرة حقن. ولا `dangerouslySetInnerHTML` في هذا
// الملفّ كلّه: كلّ مخرَج عقدةُ React، فالوسم في النصّ يبقى نصّاً. ليست
// حمايةً أُضيفت بل خاصّيةٌ في الطريقة نفسها.

import { Fragment, type ReactNode } from "react";
import { PlatformLogo } from "@/app/components/PlatformLogo";

export function MarkdownAnswer({ text }: { text: string }) {
  return <div className="min-w-0 space-y-3">{render(text)}</div>;
}

// ==================== الكتل ====================

interface Block {
  kind: "para" | "heading" | "list" | "table" | "rule";
  lines: string[];
  header?: string[];
  body?: string[][];
}

function render(text: string): ReactNode[] {
  const blocks = parse(text.replace(/\r\n/g, "\n").split("\n"));
  const out: ReactNode[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];

    // **بطاقة البيانات:** عنوان، فسطرٌ يشرحه اختياريّ، فجدول. تُجمَّع
    // الثلاثة في إطارٍ واحد لأنّها شيء واحد - وعرضُها منفصلةً يجعل
    // العنوان يبدو فاصلاً بين فقرتين لا اسماً لما تحته.
    if (b.kind === "heading") {
      const sub = blocks[i + 1]?.kind === "para" ? blocks[i + 1] : null;
      const tbl = blocks[i + (sub ? 2 : 1)];
      if (tbl?.kind === "table") {
        out.push(
          <DataCard
            key={i}
            title={b.lines[0]}
            subtitle={sub?.lines.join(" ") ?? null}
            header={tbl.header!}
            body={tbl.body!}
          />,
        );
        i += sub ? 2 : 1;
        continue;
      }
      out.push(
        <p key={i} className="text-[13.5px] font-bold text-text-primary">
          {inline(b.lines[0])}
        </p>,
      );
      continue;
    }

    if (b.kind === "table") {
      out.push(<DataCard key={i} title={null} subtitle={null} header={b.header!} body={b.body!} />);
      continue;
    }

    if (b.kind === "rule") {
      out.push(<hr key={i} className="border-border/70" />);
      continue;
    }

    if (b.kind === "list") {
      out.push(
        <ul key={i} className="space-y-1">
          {b.lines.map((it, n) => (
            <li key={n} className="flex min-w-0 items-start gap-2">
              <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
              <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-text-primary">
                {inline(it)}
              </span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    out.push(
      <p key={i} className="text-[13.5px] leading-[1.75] text-text-primary">
        {inline(b.lines.join(" "))}
      </p>,
    );
  }

  return out;
}

function parse(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ kind: "rule", lines: [] });
      i++;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", lines: [heading[2]] });
      i++;
      continue;
    }

    // جدول: سطر أنابيب يتلوه سطر محاذاة. بلا سطر المحاذاة ليس جدولاً بل
    // نصّاً فيه أنابيب - والتساهل هنا كان يحوّل جملةً عادية إلى جدولٍ مشوّه.
    if (isPipeRow(line) && isAlignRow(lines[i + 1] ?? "")) {
      const header = splitRow(line);
      const body: string[][] = [];
      let j = i + 2;
      while (j < lines.length && isPipeRow(lines[j])) { body.push(splitRow(lines[j])); j++; }
      blocks.push({ kind: "table", lines: [], header, body });
      i = j;
      continue;
    }

    if (isListItem(line)) {
      const items: string[] = [];
      while (i < lines.length && isListItem(lines[i])) {
        items.push(lines[i].replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ""));
        i++;
      }
      blocks.push({ kind: "list", lines: items });
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length && lines[i].trim() &&
      !isListItem(lines[i]) && !isPipeRow(lines[i]) && !/^#{1,4}\s/.test(lines[i])
    ) { para.push(lines[i]); i++; }
    blocks.push({ kind: "para", lines: para });
  }

  return blocks;
}

// ==================== بطاقة البيانات ====================

function DataCard({
  title, subtitle, header, body,
}: {
  title: string | null;
  subtitle: string | null;
  header: string[];
  body: string[][];
}) {
  return (
    <div className="card-inset overflow-hidden rounded-2xl border border-border">
      {(title || subtitle) && (
        <div className="px-4 pt-3.5">
          {title && <p className="text-[13.5px] font-semibold text-text-primary">{inline(title)}</p>}
          {subtitle && <p className="mt-0.5 text-[11.5px] text-text-muted">{inline(subtitle)}</p>}
        </div>
      )}

      {/* الجدول وحده يتمرّر أفقياً - لا الصفحة. جدولٌ من خمسة أعمدة داخل
          بطاقة على الهاتف كان يدفع الصفحة كلّها يميناً. */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[440px] border-collapse text-[12.5px]">
          <thead>
            <tr>
              {header.map((h, n) => (
                <th
                  key={n}
                  className={`whitespace-nowrap px-4 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] ${
                    n === 0 ? "text-start" : "text-end"
                  } ${
                    // العمود الأوّل بعد الاسم هو المؤشّر الذي بُني عليه
                    // الحكم - يُلوَّن ليُعرف أنّ الترتيب عليه لا على غيره.
                    n === 1 ? "text-accent" : "text-text-faint"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => {
              // صفّ المجموع يُكتب أوّلاً بخطٍّ غامق: القارئ يريد الحصيلة
              // قبل التفصيل، والبحث عنها في آخر جدولٍ طويل يقلب الترتيب.
              const isSummary = /^\*\*.+\*\*$/.test(row[0] ?? "");
              return (
                <tr
                  key={r}
                  className={
                    isSummary
                      ? "border-y border-border bg-surface-raised/40"
                      : "border-b border-border/45 last:border-0"
                  }
                >
                  {header.map((_, c) => (
                    <td
                      key={c}
                      className={`px-4 py-2.5 align-middle ${c === 0 ? "text-start" : "text-end"}`}
                    >
                      {c === 0 ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <PlatformMark name={row[0] ?? ""} />
                          <span
                            className={`truncate ${
                              isSummary ? "font-bold text-text-primary" : "text-text-primary"
                            }`}
                          >
                            {inline(stripBold(row[0] ?? ""))}
                          </span>
                        </span>
                      ) : (
                        <Cell text={row[c] ?? ""} bold={isSummary} />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * خلية رقم: القيمة، ثمّ تغيّرها في شارة ملوّنة.
 *
 * الاصطلاح `«قيمة ‎+12.4%»` - آخر كلمة إن كانت نسبةً بإشارة صارت شارة.
 * ولا صيغة جديدة يتعلّمها النموذج: هكذا يُكتب التغيّر أصلاً.
 */
function Cell({ text, bold }: { text: string; bold: boolean }) {
  const m = /^(.*?)\s+([+-][\d.]+%)$/.exec(text.trim());
  const value = m ? m[1] : text;
  const delta = m ? m[2] : null;
  const up = delta?.startsWith("+");

  return (
    <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
      <span className={`tabular-nums ${bold ? "font-bold text-text-primary" : "text-text-primary"}`}>
        {inline(stripBold(value))}
      </span>
      {delta && (
        <span
          className={`rounded-md px-1.5 py-[1px] text-[10.5px] font-medium tabular-nums ${
            up ? "bg-verified/12 text-verified" : "bg-critical/12 text-critical"
          }`}
        >
          {delta}
          {up ? " ↑" : " ↓"}
        </span>
      )}
    </span>
  );
}

/** شعار المنصّة حين يبدأ اسم الصفّ بها - تُقرأ الصفوف بالنظر لا بالقراءة */
function PlatformMark({ name }: { name: string }) {
  const n = stripBold(name).toLowerCase();
  const platform =
    n.includes("google") || n.includes("جوجل") ? "GOOGLE_ADS"
      : n.includes("meta") || n.includes("ميتا") || n.includes("facebook") || n.includes("instagram") ? "META_ADS"
      : n.includes("tiktok") || n.includes("تيك توك") ? "TIKTOK_ADS"
      : null;
  if (!platform) return null;
  return (
    <span className="shrink-0">
      <PlatformLogo platform={platform} size={14} />
    </span>
  );
}

// ==================== داخل السطر ====================

/** `**غامق**` و`` `شفري` `` - وما عداهما يبقى نصّاً كما كُتب */
function inline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    if (m[1] !== undefined) {
      parts.push(<strong key={key++} className="font-bold text-text-primary">{m[1]}</strong>);
    } else {
      parts.push(
        <code key={key++} className="rounded bg-surface-2 px-1 font-mono text-[11.5px]">{m[2]}</code>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return parts.length > 0 ? parts : text;
}

function stripBold(s: string): string {
  return s.replace(/^\*\*(.+)\*\*$/, "$1");
}

// ==================== أدوات التعرّف ====================

function isListItem(line: string): boolean {
  return /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
}

function isPipeRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().length > 1;
}

function isAlignRow(line: string): boolean {
  return /^\s*\|(?:\s*:?-{2,}:?\s*\|)+\s*$/.test(line.trim());
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}
