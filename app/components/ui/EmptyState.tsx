// app/components/ui/EmptyState.tsx

import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-card border border-dashed border-border bg-surface px-8 py-12 text-center">
      <div className="mb-1 text-text-muted">{title}</div>
      {description && <div className="text-sm text-text-faint">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
