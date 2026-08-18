"use client";

// app/components/SearchHighlight.tsx
//
// 🔴 **البحث كان يفتح الصفحة ويترك القارئ يدوّر.**
//
// نتيجةٌ اسمُها «حملة الشتاء» تفتح صفحة الحملات - وفيها أربعون صفّاً،
// فيبدأ يبحث بعينه عن الشيء الذي بحث عنه أصلاً. الرحلةُ إلى الصفحة نصفُ
// الطريق، والنصف الآخر أن ينزل عند العنصر نفسه ويُعلَّم.
//
// **يعمل بلا تعديلٍ في كلّ صفحة:** يكفي أن يحمل العنصر
// `data-search-id="<المعرّف>"`، وهو المعرّف نفسه الذي وضعه البحث في
// `?highlight=`. لا سياق ولا حالة عامّة - سمةٌ واحدة.

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function SearchHighlight() {
  const params = useSearchParams();
  const pathname = usePathname();
  const id = params.get("highlight");

  useEffect(() => {
    if (!id) return;

    // البيانات تصل بعد التصيير الأوّل في أغلب الصفحات، فالعنصر قد لا
    // يكون موجوداً بعد. المراقب ينتظره بدل مؤقّتٍ يخمّن متى يظهر.
    let cancelled = false;
    let observer: MutationObserver | null = null;

    function apply(el: Element) {
      if (cancelled) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("search-found");
      // يزول بعد ثوانٍ: علامةٌ تبقى تصير جزءاً من الصفحة، فتُقرأ حالةً
      // دائمة لا إشارةَ وصول.
      setTimeout(() => el.classList.remove("search-found"), 2600);
      observer?.disconnect();
    }

    const found = document.querySelector(`[data-search-id="${CSS.escape(id)}"]`);
    if (found) {
      apply(found);
      return;
    }

    observer = new MutationObserver(() => {
      const el = document.querySelector(`[data-search-id="${CSS.escape(id)}"]`);
      if (el) apply(el);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // لا ننتظر إلى الأبد: معرّفٌ لعنصرٍ لم يعد موجوداً يترك مراقباً
    // يعمل على كلّ تغيير في الصفحة بلا نهاية.
    const stop = setTimeout(() => observer?.disconnect(), 8000);
    return () => {
      cancelled = true;
      clearTimeout(stop);
      observer?.disconnect();
    };
  }, [id, pathname]);

  return null;
}
