"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Server, Package } from "lucide-react";

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  cost_type: string;
  category: string | null;
  assigned_to: string | null;
  notes: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  subscription: "Subscription",
  bank_fee: "Bank Fee",
  hosting: "Hosting / Domain",
  logistics: "Logistics",
  production: "Production",
  travel: "Travel",
  marketing: "Marketing",
  other: "Other",
};

const formatEUR = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

function CategoryBadge({ category }: { category: string | null }) {
  const label = category ? (CATEGORY_LABELS[category] ?? category) : "–";
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 tracking-[0.05em] uppercase"
      style={{
        background: "var(--mc-surface-warm)",
        color: "var(--mc-text-muted)",
      }}
    >
      {label}
    </span>
  );
}

function CostSection({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: React.ElementType;
  rows: Transaction[];
}) {
  const total = rows.reduce((s, r) => s + r.amount, 0);

  // Group by category for bar chart
  const byCategory: Record<string, number> = {};
  for (const r of rows) {
    const key = r.category ?? "other";
    byCategory[key] = (byCategory[key] ?? 0) + r.amount;
  }
  const maxCat = Math.max(...Object.values(byCategory), 1);

  return (
    <div className="mc-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
        <h3
          className="text-xs font-semibold tracking-[0.08em] uppercase"
          style={{ color: "var(--mc-text-muted)" }}
        >
          {title}
        </h3>
        <span
          className="ml-auto text-sm font-medium"
          style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-text-primary)" }}
        >
          {formatEUR(total)}
        </span>
      </div>

      {/* Category breakdown bars */}
      {Object.keys(byCategory).length > 0 && (
        <div className="space-y-2 mb-5">
          {Object.entries(byCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, amount]) => (
              <div key={cat}>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "var(--mc-text-muted)" }}>
                    {formatEUR(amount)}
                  </span>
                </div>
                <div className="h-1.5 w-full" style={{ background: "var(--mc-surface-warm)" }}>
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${(amount / maxCat) * 100}%`,
                      background: "var(--mc-cream-subtle)",
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Transaction table */}
      {rows.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
          No transactions yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="mc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Assigned To</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-[11px] font-mono" style={{ color: "var(--mc-text-muted)", whiteSpace: "nowrap" }}>
                    {r.transaction_date}
                  </td>
                  <td
                    className="text-xs"
                    style={{ color: "var(--mc-text-primary)", maxWidth: 280 }}
                  >
                    <span className="line-clamp-1">{r.description || "–"}</span>
                    {r.notes && (
                      <span className="block text-[10px] mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
                        {r.notes}
                      </span>
                    )}
                  </td>
                  <td>
                    <CategoryBadge category={r.category} />
                  </td>
                  <td className="text-[11px]" style={{ color: "var(--mc-text-muted)", textTransform: "capitalize" }}>
                    {r.assigned_to ?? "company"}
                  </td>
                  <td
                    className="text-xs font-mono"
                    style={{ textAlign: "right", color: "var(--mc-error)", whiteSpace: "nowrap" }}
                  >
                    −{formatEUR(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CostBreakdown() {
  const [infraRows, setInfraRows] = useState<Transaction[]>([]);
  const [opRows, setOpRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    // New tables not yet in generated types — remove cast after `npm run sb:pull`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data } = await db
      .from("bank_transactions")
      .select("id, transaction_date, description, amount, cost_type, category, assigned_to, notes")
      .eq("direction", "out")
      .in("cost_type", ["infrastructure", "operational"])
      .order("transaction_date", { ascending: false })
      .limit(200);

    const rows = (data ?? []) as Transaction[];
    setInfraRows(rows.filter((r) => r.cost_type === "infrastructure"));
    setOpRows(rows.filter((r) => r.cost_type === "operational"));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="mc-skeleton h-64" />
        <div className="mc-skeleton h-64" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CostSection title="Technical Infrastructure" icon={Server} rows={infraRows} />
      <CostSection title="Operational Costs" icon={Package} rows={opRows} />
    </div>
  );
}
