"use client";

// app/components/MarkdownAnswer.tsx
//
// عرض جواب الوكيل.
//
// **لماذا عارضٌ مكتوب هنا لا مكتبة:** الجواب يحتاج ستّة أشكال بعينها -
// عنوان، فقرة، قائمة، جدول، غامق، وفاصل. ومكتبة Markdown كاملة تجرّ معها
// دعم HTML الخام، وهو المدخل الذي يحوّل نصّاً يولّده نموذج إلى ثغرة حقن.
//
// **وهذا العارض لا يستطيع الحقن أصلاً:** لا `dangerouslySetInnerHTML` في
// الملفّ كلّه. كلّ مخرَج عقدةُ React، فالوسم في النصّ يبقى نصّاً - ليست
// حمايةً أضفناها بل خاصّيةٌ في الطريقة نفسها.
//
// **والجدول يمرّر في غلافٍ يتمرّر أفقياً:** جدولٌ من خمسة أعمدة داخل بطاقة
// على الهاتف يدفع الصفحة كلّها يميناً - وهي بالضبط العلّة التي طاردناها في
// أماكن أخرى. يتمرّر الجدول وحده، ولا تتمرّر الصفحة.

import { Fragment, type ReactNode } from "react";

export function MarkdownAnswer({ text }: { text: string }) {
  return <div className="min-w-0 space-y-2.5">{render(text)}</div>;
}

// ==================== الكتل ====================

function render(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // فاصل
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push(<hr key={key++} className="border-border/70" />);
      i++;
      continue;
    }

    // عنوان
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(
        <p
          key={key++}
          className={
            level <= 2
              ? "text-[13.5px] font-bold text-text-primary"
              : "text-[12.5px] font-semibold text-text-secondary"
          }
        >
          {inline(heading[2])}
        </p>,
      );
      i++;
      continue;
    }

    // جدول: سطر أنابيب يتلوه سطر محاذاة. بلا سطر المحاذاة ليس جدولاً بل
    // نصّاً فيه أنابيب - والتساهل هنا كان يحوّل جملةً عادية إلى جدولٍ مشوّه.
    if (isPipeRow(line) && i + 1 < lines.length && isAlignRow(lines[i + 1])) {
      const header = splitRow(line);
      const body: string[][] = [];
      let j = i + 2;
      while (j < lines.length && isPipeRow(lines[j])) {
        body.push(splitRow(lines[j]));
        j++;
      }
      out.push(<Table key={key++} header={header} body={body} />);
      i = j;
      continue;
    }

    // قائمة - نقطية أو مرقّمة
    if (isListItem(line)) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length && isListItem(lines[j])) {
        items.push(lines[j].replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ""));
        j++;
      }
      out.push(
        <ul key={key++} className="space-y-1">
          {items.map((it, n) => (
            <li key={n} className="flex min-w-0 items-start gap-2">
              <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
              <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-text-primary">
                {inline(it)}
              </span>
            </li>
          ))}
        </ul>,
      );
      i = j;
      continue;
    }

    // سطر فارغ
    if (!line.trim()) {
      i++;
      continue;
    }

    // فقرة - تُجمع أسطرها المتتابعة حتى أوّل سطر فارغ أو أوّل كتلة
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isListItem(lines[i]) &&
      !isPipeRow(lines[i]) &&
      !/^#{1,4}\s/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(
      <p key={key++} className="text-[13px] leading-relaxed text-text-primary">
        {inline(para.join(" "))}
      </p>,
    );
  }

  return out;
}

function Table({ header, body }: { header: string[]; body: string[][] }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
        <thead>
          <tr>
            {header.map((h, n) => (
              <th
                key={n}
                className="border-b border-border px-2.5 py-1.5 text-start font-semibold text-text-secondary"
              >
                {inline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="border-b border-border/50 last:border-0">
              {/* صفٌّ أقصر من رأسه يحدث حين يقصّ السقف الجواب في منتصف
                  جدول - تُملأ الخلايا الناقصة بدل أن ينهار الجدول. */}
              {header.map((_, c) => (
                <td key={c} className="px-2.5 py-1.5 text-text-primary">
                  {inline(row[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
      parts.push(
        <strong key={key++} className="font-bold text-text-primary">
          {m[1]}
        </strong>,
      );
    } else {
      parts.push(
        <code key={key++} className="rounded bg-surface-2 px-1 font-mono text-[11.5px]">
          {m[2]}
        </code>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return parts.length > 0 ? parts : text;
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
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}
