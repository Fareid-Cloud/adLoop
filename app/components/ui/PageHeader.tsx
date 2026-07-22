// app/components/ui/PageHeader.tsx
//
// كل صفحة كانت بتكتب عنوانها يدوي بأنماط مختلفة شوية - ده الشكل الموحّد
// الوحيد، بيتكرر في كل الأقسام (مبدأ §4 و§11 في الـ ADR).

import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string; // نص صغير فوق العنوان (زي "مساحة العمل")
  title: string;
  action?: ReactNode; // زرار أو عنصر تفاعلي على الجهة التانية من العنوان
}

export function PageHeader({ eyebrow, title, action }: PageHeaderProps) {
  return (
    <header className="mb-6 flex items-start justify-between">
      <div>
        {eyebrow && <div className="mb-1 text-sm text-text-muted">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
      </div>
      {action && <div>{action}</div>}
    </header>
  );
}
