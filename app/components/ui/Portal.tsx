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

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
