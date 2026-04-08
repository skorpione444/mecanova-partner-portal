"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileText, ArrowDownLeft } from "lucide-react";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
  created_at: string;
  distributor: { name: string } | null;
  client: { name: string } | null;
}

interface IncomeTx {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  category: string | null;
  matched_invoice_id: string | null;
}

const formatEUR = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

const STATUS_COLORS: Record<string, string> = {
  paid: "var(--mc-success)",
  sent: "var(--mc-warning)",
  overdue: "var(--mc-error)",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 tracking-[0.05em] uppercase"
      style={{
        color: STATUS_COLORS[status] ?? "var(--mc-text-muted)",
        background:
          status === "paid"
            ? "var(--mc-success-bg)"
            : status === "overdue"
              ? "var(--mc-error-bg)"
              : "var(--mc-warning-bg)",
      }}
    >
      {status}
    </span>
  );
}

export default function RevenuePanel() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [incomeTxs, setIncomeTxs] = useState<IncomeTx[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    // New tables not yet in generated types — remove cast after `npm run sb:pull`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [invRes, txRes] = await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, amount, currency, status, due_date, created_at, distributor:distributor_id(name), client:client_id(name)"
        )
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("bank_transactions")
        .select("id, transaction_date, description, amount, category, matched_invoice_id")
        .eq("direction", "in")
        .order("transaction_date", { ascending: false })
        .limit(100),
    ]);

    setInvoices((invRes.data ?? []) as unknown as Invoice[]);
    setIncomeTxs((txRes.data ?? []) as unknown as IncomeTx[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="mc-skeleton h-20" />
        <div className="mc-skeleton h-64" />
        <div className="mc-skeleton h-48" />
      </div>
    );
  }

  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);

  const outstanding = invoices
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + i.amount, 0);

  const totalIncoming = incomeTxs.reduce((s, t) => s + t.amount, 0);

  // This month
  const now = new Date();
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const revenueThisMonth = invoices
    .filter((i) => i.status === "paid" && i.created_at.startsWith(thisMonthStr))
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Billed", value: formatEUR(totalRevenue + outstanding), sub: "all invoices" },
          { label: "Collected", value: formatEUR(totalRevenue), sub: "paid invoices" },
          { label: "Outstanding", value: formatEUR(outstanding), sub: "sent + overdue" },
          { label: "This Month", value: formatEUR(revenueThisMonth), sub: "paid this month" },
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

      {/* Invoices table */}
      <div className="mc-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Invoices
          </h3>
          <span className="ml-auto text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
            {invoices.length} total
          </span>
        </div>

        {invoices.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
            No invoices yet.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Distributor</th>
                  <th>Client</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="text-xs font-mono" style={{ color: "var(--mc-text-primary)" }}>
                      {inv.invoice_number}
                    </td>
                    <td className="text-xs" style={{ color: "var(--mc-text-primary)" }}>
                      {inv.distributor?.name ?? "–"}
                    </td>
                    <td className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                      {inv.client?.name ?? "–"}
                    </td>
                    <td
                      className="text-[11px] font-mono"
                      style={{ color: "var(--mc-text-muted)", whiteSpace: "nowrap" }}
                    >
                      {inv.due_date}
                    </td>
                    <td>
                      <StatusChip status={inv.status} />
                    </td>
                    <td
                      className="text-xs font-mono"
                      style={{ textAlign: "right", color: "var(--mc-success)", whiteSpace: "nowrap" }}
                    >
                      +{formatEUR(inv.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incoming bank transactions */}
      <div className="mc-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowDownLeft className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Incoming Transactions (Holvi)
          </h3>
          <span className="ml-auto text-sm font-medium" style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-success)" }}>
            {formatEUR(totalIncoming)}
          </span>
        </div>

        {incomeTxs.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
            No incoming transactions synced yet. Use the Bank Feed tab to sync from Holvi.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Matched Invoice</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {incomeTxs.map((tx) => (
                  <tr key={tx.id}>
                    <td className="text-[11px] font-mono" style={{ color: "var(--mc-text-muted)", whiteSpace: "nowrap" }}>
                      {tx.transaction_date}
                    </td>
                    <td className="text-xs" style={{ color: "var(--mc-text-primary)", maxWidth: 320 }}>
                      <span className="line-clamp-1">{tx.description || "–"}</span>
                    </td>
                    <td className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                      {tx.matched_invoice_id ? "✓ Matched" : "–"}
                    </td>
                    <td
                      className="text-xs font-mono"
                      style={{ textAlign: "right", color: "var(--mc-success)", whiteSpace: "nowrap" }}
                    >
                      +{formatEUR(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
