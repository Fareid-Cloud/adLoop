// app/components/ui/DataTable.tsx
//
// أول استخدام حقيقي لجدول بيانات في المنتج - بُني كمكوّن مشترك من الأول
// (مش هيتكرر مصمم من جديد في كل قسم) زي ما الـ ADR §4/§11 حدد. فرز بس
// الآن - الإجراءات الجماعية وتخصيص الأعمدة مؤجلة لحد ما يبقى فيه
// استخدام حقيقي يبررها (ADR §14).

"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  align?: "start" | "end";
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => number | string; // لو مش موجودة، العمود ده مش قابل للفرز
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedRows = [...rows];
  if (sortKey) {
    const col = columns.find((c) => c.key === sortKey);
    if (col?.sortValue) {
      sortedRows.sort((a, b) => {
        const va = col.sortValue!(a);
        const vb = col.sortValue!(b);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
  }

  function handleHeaderClick(col: Column<T>) {
    if (!col.sortValue) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("desc");
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleHeaderClick(col)}
                className={`px-4 py-3 text-xs font-medium text-text-faint ${
                  col.align === "end" ? "text-end" : "text-start"
                } ${col.sortValue ? "cursor-pointer select-none hover:text-text-muted" : ""}`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortValue &&
                    (sortKey === col.key ? (
                      sortDir === "asc" ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      )
                    ) : (
                      <ChevronsUpDown size={12} className="opacity-40" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-border last:border-0 ${
                onRowClick ? "cursor-pointer hover:bg-surface-raised" : ""
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-text-primary ${col.align === "end" ? "text-end" : "text-start"}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div className="px-4 py-10 text-center text-sm text-text-faint">لا توجد بيانات لعرضها.</div>
      )}
    </div>
  );
}
