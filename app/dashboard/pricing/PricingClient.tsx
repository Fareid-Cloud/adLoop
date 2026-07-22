// app/dashboard/pricing/PricingClient.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

export interface ProductHealthRow {
  id: string;
  name: string;
  currentPrice: number;
  suggestedPrice: number;
  gapPct: number;
  status: "SAFE" | "WARNING" | "CRITICAL";
  message: string;
  actualLossAlert: string | null;
}

export function PricingClient({
  workspaceId,
  products,
}: {
  workspaceId: string;
  products: ProductHealthRow[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", sku: "", currentPrice: "", cogs: "", outboundShippingCost: "", rtoRatePct: "", avgAdCostPerOrder: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/workspaces/${workspaceId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        sku: form.sku || null,
        currentPrice: parseFloat(form.currentPrice) || 0,
        cogs: parseFloat(form.cogs) || 0,
        outboundShippingCost: parseFloat(form.outboundShippingCost) || 0,
        rtoRatePct: parseFloat(form.rtoRatePct) || 0,
        avgAdCostPerOrder: parseFloat(form.avgAdCostPerOrder) || 0,
      }),
    });
    setSaving(false);
    setShowForm(false);
    setForm({ name: "", sku: "", currentPrice: "", cogs: "", outboundShippingCost: "", rtoRatePct: "", avgAdCostPerOrder: "" });
    router.refresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs text-white"
        >
          <Plus size={14} />
          منتج جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 rounded-2xl bg-surface p-5">
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="اسم المنتج"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="col-span-2 rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
            />
            <input
              placeholder="SKU (اختياري - لربط مبيعات سلة الحقيقية بالمنتج ده)"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="col-span-2 rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
            />
            <input
              placeholder="السعر الحالي"
              type="number"
              value={form.currentPrice}
              onChange={(e) => setForm({ ...form, currentPrice: e.target.value })}
              required
              className="rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
            />
            <input
              placeholder="تكلفة المنتج (COGS)"
              type="number"
              value={form.cogs}
              onChange={(e) => setForm({ ...form, cogs: e.target.value })}
              className="rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
            />
            <input
              placeholder="تكلفة الشحن"
              type="number"
              value={form.outboundShippingCost}
              onChange={(e) => setForm({ ...form, outboundShippingCost: e.target.value })}
              className="rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
            />
            <input
              placeholder="نسبة المرتجعات %"
              type="number"
              value={form.rtoRatePct}
              onChange={(e) => setForm({ ...form, rtoRatePct: e.target.value })}
              className="rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
            />
            <input
              placeholder="متوسط تكلفة الإعلان للطلب"
              type="number"
              value={form.avgAdCostPerOrder}
              onChange={(e) => setForm({ ...form, avgAdCostPerOrder: e.target.value })}
              className="rounded-xl bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-3 rounded-full bg-accent px-4 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {saving ? "جارٍ الإضافة..." : "إضافة"}
          </button>
        </form>
      )}

      {products.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface px-8 py-12 text-center text-text-muted">
          مفيش منتجات مضافة لسه
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map((p) => (
            <div key={p.id} className="rounded-2xl bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <StatusDot status={p.status} />
                    <span className="text-sm font-medium text-text-primary">{p.name}</span>
                  </div>
                  <p className="text-xs text-text-faint">{p.message}</p>
                  {p.actualLossAlert && (
                    <p className="mt-1 text-xs font-medium text-critical">{p.actualLossAlert}</p>
                  )}
                  <div className="mt-2 flex gap-4 font-mono text-xs">
                    <span className="text-text-muted">الحالي: {p.currentPrice}</span>
                    <span className="text-verified">المقترح: {p.suggestedPrice}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-text-faint hover:text-critical"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorClass =
    status === "CRITICAL" ? "bg-critical" : status === "WARNING" ? "bg-gap" : "bg-verified";
  return <span className={`h-2 w-2 rounded-full ${colorClass}`} />;
}
