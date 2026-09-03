"use client";

// app/components/ui/Portal.tsx
//
// يُصيّر المحتوى في جذر الصفحة لا في مكانه من الشجرة.
//
// **لماذا لم يكفِ `position: fixed`:** المثبَّت يهرب من `overflow` نعم،
// لكنّه **لا يهرب من `transform`**. أيّ سلفٍ عليه `transform` يصير الحاوية
// المرجعية لكلّ مثبَّت بداخله، فيُحسب موضعه منه ويُقصّ بحدوده - وهذا
// بالضبط حال الشريط الجانبيّ: عليه `translateX` ليعمل درجاً على الهاتف،
// وعليه `overflow-hidden` ليمنع فيض القائمة. فأيّ لوحة تُفتح من داخله
// (الدعم، شارة العرض) تُقصّ عند حدّه مهما كانت `fixed` أو `z-index`.
//
// البوّابة تخرج من الشجرة كلّها إلى `<body>`، فلا سلف يقصّها ولا يزحزحها.
// وهي الإجابة الوحيدة الكاملة عن «المفروض يكون فوق كلّ شيء».
//
// `mounted` لازم: الخادم لا `document` عنده، وتصيير البوّابة قبل الترطيب
// يُنتج اختلافاً بين ما عرضه الخادم وما بناه المتصفّح.

// 🔴 **والبوّابةُ بتخرج من السمة كمان، لا من القصّ وحده.**
//
// `data-accent` و`data-mode` بيتحطّوا على حاوياتٍ في الشجرة (شِلُّ لوحة
// المالك بيحطّ `red`)، والقواعدُ بتقرأهم بالنسب. والخروجُ إلى `<body>`
// بيخرج من تحتهم - فأيّ قائمةٍ أو لوحةٍ بتُفتح من اللوحة الحمراء كانت
// بترجع **زرقاء**: لونٌ شاذٌّ وسط شاشةٍ كلُّها حمراء، وهو ما ظهر في
// قوائم الاختيار.
//
// فبتُنسَخ السمةُ من أقرب سلفٍ يحملها إلى غلافِ البوّابة. نسخٌ لا وراثة،
// لأنّ الوراثة مقطوعةٌ بحكم مكان التصيير.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<{ accent?: string; mode?: string }>({});
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    // المرساةُ عنصرٌ حقيقيّ في الشجرة، فمنها نقرأ السمةَ السارية عليها.
    if (!anchor) return;
    setTheme({
      accent: anchor.closest("[data-accent]")?.getAttribute("data-accent") ?? undefined,
      mode: anchor.closest("[data-mode]")?.getAttribute("data-mode") ?? undefined,
    });
  }, [anchor]);

  return (
    <>
      {/* عنصرٌ صفرُ الحجم يبقى في مكانه من الشجرة ليُقرأ منه السياق. */}
      <span ref={setAnchor} className="hidden" aria-hidden />
      {mounted &&
        createPortal(
          <div data-accent={theme.accent} data-mode={theme.mode} className="contents">
            {children}
          </div>,
          document.body
        )}
    </>
  );
}
