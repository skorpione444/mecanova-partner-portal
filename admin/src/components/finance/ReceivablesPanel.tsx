"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/EmptyState";
import { Receipt, Check } from "lucide-react";

const formatEUR = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

type Row = {
  kind: "order" | "invoice";
  id: string;
  ref: string;
  party: string;
  total: number;
  paid: number;
  dueDate: string | null;
  fullyPaid: boolean;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ReceivablesPanel() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaid, setShowPaid] = useState(false);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [ordRes, invRes] = await Promise.all([
      supabase
        .from("order_requests")
        .select(
          "id, status, delivered_at, payment_due_date, amount_due, amount_paid, paid_at, client:client_id(name), partner:partner_id(name)"
        )
        .eq("status", "delivered")
        .not("amount_due", "is", null),
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, amount, amount_paid, status, due_date, paid_at, client:client_id(name), distributor:distributor_id(name)"
        )
        .order("due_date", { ascending: true }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orders: Row[] = ((ordRes.data as any[]) ?? []).map((o) => {
      const total = Number(o.amount_due) || 0;
      const paid = Number(o.amount_paid) || 0;
      return {
        kind: "order" as const,
        id: o.id,
        ref: `#${o.id.slice(0, 8)}`,
        party: o.client?.name ?? o.partner?.name ?? "—",
        total,
        paid,
        dueDate: o.payment_due_date ?? null,
        fullyPaid: !!o.paid_at || (total > 0 && paid >= total),
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoices: Row[] = ((invRes.data as any[]) ?? []).map((i) => {
      const total = Number(i.amount) || 0;
      const paid = Number(i.amount_paid) || 0;
      return {
        kind: "invoice" as const,
        id: i.id,
        ref: i.invoice_number,
        party: i.client?.name ?? i.distributor?.name ?? "—",
        total,
        paid,
        dueDate: i.due_date ?? null,
        fullyPaid: i.status === "paid" || (total > 0 && paid >= total),
      };
    });

    const all = [...orders, ...invoices].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
    setRows(all);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePayment = async (row: Row, rawAmount: number) => {
    const key = row.kind + row.id;
    setSavingKey(key);
    const amount = Math.max(0, rawAmount);
    const fully = row.total > 0 && amount >= row.total;
    const nowIso = new Date().toISOString();
    if (row.kind === "order") {
      await supabase
        .from("order_requests")
        .update({ amount_paid: amount, paid_at: fully ? nowIso : null })
        .eq("id", row.id);
    } else {
      await supabase
        .from("invoices")
        .update({
          amount_paid: amount,
          status: fully ? "paid" : "sent",
          paid_at: fully ? nowIso : null,
        })
        .eq("id", row.id);
    }
    setEdit((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
    setSavingKey(null);
    await load();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="mc-skeleton h-20" />
        <div className="mc-skeleton h-64" />
      </div>
    );
  }

  const visible = rows.filter((r) => (showPaid ? true : !r.fullyPaid));
  const open = rows.filter((r) => !r.fullyPaid);
  const today = todayStr();
  const totalOutstanding = open.reduce((s, r) => s + Math.max(0, r.total - r.paid), 0);
  const overdueCount = open.filter((r) => r.dueDate && r.dueDate < today).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Outstanding", value: formatEUR(totalOutstanding), sub: "not yet collected" },
          { label: "Open items", value: String(open.length), sub: "orders + invoices" },
          { label: "Overdue", value: String(overdueCount), sub: "past due date" },
        ].map((s) => (
          <div key={s.label} className="mc-card p-5">
            <p
              className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-2"
              style={{ color: "var(--mc-text-muted)" }}
            >
              {s.label}
            </p>
            <p
              className="text-xl font-medium"
              style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-text-primary)" }}
            >
              {s.value}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--mc-text-muted)" }}>
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="mc-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Receivables
          </h3>
          <button
            onClick={() => setShowPaid((v) => !v)}
            className="ml-auto text-[10px] tracking-wide uppercase"
            style={{ color: "var(--mc-text-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            {showPaid ? "Hide paid" : "Show paid too"}
          </button>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nothing outstanding"
            description="Delivered orders and invoices waiting for payment will appear here, sorted by due date."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Party</th>
                  <th>Type</th>
                  <th>Ref</th>
                  <th>Due</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Paid</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Record payment</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const key = r.kind + r.id;
                  const pct =
                    r.total > 0 ? Math.round((r.paid / r.total) * 100) : r.fullyPaid ? 100 : 0;
                  const overdue = !r.fullyPaid && !!r.dueDate && r.dueDate < today;
                  const statusLabel = r.fullyPaid
                    ? "Paid"
                    : r.paid > 0
                      ? `Partial ${pct}%`
                      : overdue
                        ? "Overdue"
                        : "Open";
                  const statusColor = r.fullyPaid
                    ? "var(--mc-success)"
                    : overdue
                      ? "var(--mc-error)"
                      : r.paid > 0
                        ? "var(--mc-warning)"
                        : "var(--mc-text-muted)";
                  const editVal = edit[key] ?? String(r.paid || "");
                  return (
                    <tr key={key}>
                      <td className="text-xs" style={{ color: "var(--mc-text-primary)" }}>
                        {r.party}
                      </td>
                      <td className="text-[10px] uppercase tracking-wide" style={{ color: "var(--mc-text-muted)" }}>
                        {r.kind}
                      </td>
                      <td className="text-xs font-mono" style={{ color: "var(--mc-text-muted)" }}>
                        {r.ref}
                      </td>
                      <td
                        className="text-[11px] font-mono"
                        style={{ color: overdue ? "var(--mc-error)" : "var(--mc-text-muted)", whiteSpace: "nowrap" }}
                      >
                        {r.dueDate ?? "—"}
                      </td>
                      <td className="text-xs font-mono" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {formatEUR(r.total)}
                      </td>
                      <td
                        className="text-xs font-mono"
                        style={{ textAlign: "right", whiteSpace: "nowrap", color: "var(--mc-text-muted)" }}
                      >
                        {formatEUR(r.paid)}
                      </td>
                      <td>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 tracking-[0.05em] uppercase"
                          style={{ color: statusColor, whiteSpace: "nowrap" }}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 justify-end">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editVal}
                            onChange={(e) =>
                              setEdit((p) => ({ ...p, [key]: e.target.value }))
                            }
                            className="mc-input"
                            style={{ width: 90, height: 26, fontSize: "0.6875rem", textAlign: "right" }}
                          />
                          <button
                            onClick={() => savePayment(r, parseFloat(editVal) || 0)}
                            disabled={savingKey === key}
                            className="mc-btn mc-btn-ghost"
                            style={{ fontSize: 10, padding: "3px 8px" }}
                            title="Save recorded amount"
                          >
                            {savingKey === key ? "…" : "Save"}
                          </button>
                          <button
                            onClick={() => savePayment(r, r.total)}
                            disabled={savingKey === key}
                            className="mc-btn mc-btn-ghost"
                            style={{ fontSize: 10, padding: "3px 6px", color: "var(--mc-success)" }}
                            title="Mark fully paid"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
