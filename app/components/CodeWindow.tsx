"use client";

// app/components/CodeWindow.tsx
//
// **كتلةُ الشيفرة تبدو طرفيّة، لا فقرةً سوداء في صفحة.**
//
// 🔴 الصفحتان اللتان كلُّ غرضهما أن يُنسَخ منهما شيءٌ ويُلصَق في محرّر أو
// طرفيّة (وسمُ التتبّع، وإعدادُ MCP) كانتا تعرضانه نصّاً أسود بلا تمييز:
// المفتاحُ كالقيمة، والرايةُ كالأمر. فيقرؤه الناظر حرفاً حرفاً ليعرف أين
// يبدأ مفتاحُه - وهو الشيء الوحيد الذي سيبدّله.
//
// التلوين هنا **دلاليّ**: يفصل الأمر عن رايته، والمفتاح عن قيمته، فيُرى
// موضعُ التبديل قبل أن يُقرأ السطر.
//
// ═══ لماذا مُلوِّنٌ مكتوبٌ هنا لا مكتبة ═══
//
// المطلوب لغتان اثنتان (سطرُ أوامر، وJSON) في كتلتين. ومكتبةُ تلوينٍ
// كاملة تزن أضعافَ الصفحتين معاً، وتُحمَّل في كلّ زيارة، لتلوّن سطراً.
//
// ⚠️ **ولا يُبنى HTML من نصّ**: الوسوم تُنتَج عناصرَ React، فالمفتاح الذي
// يُحقَن في السطر يبقى نصّاً مهما حوى - لا `dangerouslySetInnerHTML`.

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

type Lang = "bash" | "json";

/** قطعةٌ ملوّنة: النصّ وصنفُ لونه. */
interface Tok {
  text: string;
  cls?: string;
}

/**
 * تقطيعُ سطرِ أوامر: الأمر أوّلاً، ثمّ الرايات، ثمّ النصوص المقتبسة.
 * التعليقُ يبتلع بقيّة السطر.
 */
function tokenizeBash(line: string): Tok[] {
  const out: Tok[] = [];
  // `"..."` أو `'...'` أو راية `--x` أو تعليق `# ...` أو ما عدا ذلك
  const re = /("[^"]*"|'[^']*')|(^\s*#.*$)|(\B--?[\w-]+)|(\s+)|([^\s"']+)/g;
  let m: RegExpExecArray | null;
  let first = true;
  while ((m = re.exec(line))) {
    const [raw, str, comment, flag, space, word] = m;
    if (str) out.push({ text: raw, cls: "tok-str" });
    else if (comment) out.push({ text: raw, cls: "tok-comment" });
    else if (flag) out.push({ text: raw, cls: "tok-flag" });
    else if (space) out.push({ text: raw });
    else if (word) {
      // أوّلُ كلمةٍ غيرِ فراغٍ في السطر هي الأمر
      out.push({ text: raw, cls: first ? "tok-cmd" : undefined });
      first = false;
    }
  }
  return out;
}

/** تقطيعُ JSON: المفتاح، ثمّ النصّ، ثمّ الرقم/المنطقيّ، ثمّ الترقيم. */
function tokenizeJson(line: string): Tok[] {
  const out: Tok[] = [];
  const re = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\b-?\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)|([{}[\],:])|(\s+)|([^\s{}[\],:"]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const [raw, key, str, num, punct, space] = m;
    if (key) out.push({ text: raw, cls: "tok-key" });
    else if (str) out.push({ text: raw, cls: "tok-str" });
    else if (num) out.push({ text: raw, cls: "tok-num" });
    else if (punct) out.push({ text: raw, cls: "tok-punct" });
    else if (space) out.push({ text: raw });
    else out.push({ text: raw });
  }
  return out;
}

/** HTML/JS للوسم: تمييزُ الوسوم والسمات والنصوص يكفي لقراءته. */
function tokenizeMarkup(line: string): Tok[] {
  const out: Tok[] = [];
  const re = /(<\/?[\w-]+|\/?>)|([\w-]+=)|("[^"]*"|'[^']*')|(\/\/.*$)|(\s+)|([^\s<>="']+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const [raw, tag, attr, str, comment, space] = m;
    if (tag) out.push({ text: raw, cls: "tok-cmd" });
    else if (attr) out.push({ text: raw, cls: "tok-key" });
    else if (str) out.push({ text: raw, cls: "tok-str" });
    else if (comment) out.push({ text: raw, cls: "tok-comment" });
    else if (space) out.push({ text: raw });
    else out.push({ text: raw });
  }
  return out;
}

export function CodeWindow({
  code,
  lang = "bash",
  title,
  copyLabel,
  copiedLabel,
  showLineNumbers,
}: {
  code: string;
  lang?: Lang | "markup";
  /** اسمُ الملفّ أو الأمر - يقف في شريط النافذة */
  title?: string;
  copyLabel: string;
  copiedLabel: string;
  showLineNumbers?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");
  const pick = lang === "json" ? tokenizeJson : lang === "markup" ? tokenizeMarkup : tokenizeBash;

  // أرقامُ الأسطر لا تُعرض لسطرٍ واحد: عمودٌ فيه «1» وحده زينةٌ لا دلالة.
  const numbered = showLineNumbers ?? lines.length > 1;

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="code-window">
      <div className="code-bar">
        {/* نقاطُ النافذة: إشارةٌ متعارَفة إلى أنّ ما تحتها طرفيّة */}
        <span className="code-dot" style={{ background: "#ff5f56" }} />
        <span className="code-dot" style={{ background: "#ffbd2e" }} />
        <span className="code-dot" style={{ background: "#27c93f" }} />
        {title && (
          <span dir="ltr" className="code-block ms-1.5 text-[11px] text-[var(--code-gutter)]">
            {title}
          </span>
        )}
        <button
          onClick={copy}
          className="code-block ms-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--code-gutter)] transition-colors hover:text-[var(--code-fg)]"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>

      {/* الاتجاه لاتينيّ دائماً: الشيفرة لا تنعكس مع لغة الواجهة */}
      <pre
        dir="ltr"
        // نفس شريط القائمة الجانبية: رفيعٌ بلون الهوية، يظهر عند
        // الاقتراب. الشريطُ الرماديّ العريض كان أوّل ما يُرى في نافذةٍ
        // كلُّ غرضها أن تبدو طرفيّة.
        className="hover-scrollbar scrollbar-zone code-block overflow-x-auto p-3 text-[12px] leading-[1.7]"
      >
        <code>
          {lines.map((line, i) => (
            <div key={i} className="flex">
              {numbered && (
                <span className="code-gutter min-w-[2.25rem] shrink-0">{i + 1}</span>
              )}
              <span className={numbered ? "ps-3" : ""}>
                {pick(line).map((tk, j) => (
                  <span key={j} className={tk.cls}>
                    {tk.text}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
