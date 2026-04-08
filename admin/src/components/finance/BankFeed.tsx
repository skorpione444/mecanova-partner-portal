"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { RefreshCw, X, Save, ChevronDown } from "lucide-react";

interface BankTransaction {
  id: string;
  holvi_transaction_id: string | null;
  transaction_date: string;
  description: string | null;
  amount: number;
  direction: "in" | "out";
  cost_type: string;
  category: string | null;
  assigned_to: string | null;
  notes: string | null;
  travel_reason: string | null;
  travel_who_met: string | null;
  synced_at: string;
}

const COST_TYPES = [
  { value: "infrastructure", label: "Infrastructure" },
  { value: "operational", label: "Operational" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
  { value: "uncategorized", label: "Uncategorized" },
];

const CATEGORIES: Record<string, { value: string; label: string }[]> = {
  infrastructure: [
    { value: "subscription", label: "Subscription" },
    { value: "bank_fee", label: "Bank Fee" },
    { value: "hosting", label: "Hosting / Domain" },
  ],
  operational: [
    { value: "logistics", label: "Logistics" },
    { value: "production", label: "Production" },
    { value: "travel", label: "Travel" },
    { value: "marketing", label: "Marketing" },
    { value: "other", label: "Other" },
  ],
  income: [
    { value: "sale", label: "Sale" },
    { value: "refund", label: "Refund" },
    { value: "other", label: "Other" },
  ],
  transfer: [{ value: "transfer", label: "Internal Transfer" }],
  uncategorized: [],
};

const formatEUR = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

interface TravelModalProps {
  tx: BankTransaction;
  onSave: (reason: string, whoMet: string, notes: string) => void;
  onClose: () => void;
}

function TravelModal({ tx, onSave, onClose }: TravelModalProps) {
  const [reason, setReason] = useState(tx.travel_reason ?? "");
  const [whoMet, setWhoMet] = useState(tx.travel_who_met ?? "");
  const [notes, setNotes] = useState(tx.notes ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="mc-card p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--mc-cream-subtle)" }}
          >
            Travel Notes
          </h3>
          <button onClick={onClose}>
            <X className="w-4 h-4" style={{ color: "var(--mc-text-muted)" }} strokeWidth={1.5} />
          </button>
        </div>

        <p className="text-[11px] mb-4" style={{ color: "var(--mc-text-muted)" }}>
          {tx.description} · {formatEUR(tx.amount)} · {tx.transaction_date}
        </p>

        <div className="space-y-4">
          <div>
            <label
              className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-1 block"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Reason for trip
            </label>
            <input
              type="text"
              className="mc-input w-full"
              placeholder="e.g. Partner meeting, trade show, client visit"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div>
            <label
              className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-1 block"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Who was met
            </label>
            <input
              type="text"
              className="mc-input w-full"
              placeholder="e.g. Marco at Hawesko, Frankfurt Messe team"
              value={whoMet}
              onChange={(e) => setWhoMet(e.target.value)}
            />
          </div>
          <div>
            <label
              className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-1 block"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Outcome / additional context
            </label>
            <textarea
              className="mc-input w-full"
              rows={3}
              placeholder="e.g. Follow-up meeting scheduled, interested in 500 bottle trial"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4" style={{ borderTop: "1px solid var(--mc-border-light)" }}>
          <button className="mc-btn mc-btn-ghost text-xs" onClick={onClose}>
            Cancel
          </button>
          <button
            className="mc-btn mc-btn-primary text-xs flex items-center gap-1.5"
            onClick={() => onSave(reason, whoMet, notes)}
          >
            <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BankFeed() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [travelModal, setTravelModal] = useState<BankTransaction | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    // New tables not yet in generated types — remove cast after `npm run sb:pull`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const query = db
      .from("bank_transactions")
      .select(
        "id, holvi_transaction_id, transaction_date, description, amount, direction, cost_type, category, assigned_to, notes, travel_reason, travel_who_met, synced_at"
      )
      .order("transaction_date", { ascending: false })
      .limit(200);

    if (filterType !== "all") {
      query.eq("cost_type", filterType);
    }

    const { data } = await query;
    setTransactions((data ?? []) as unknown as BankTransaction[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/holvi/sync", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setSyncMsg(`Synced ${json.fetched} transactions, ${json.new} new.`);
        load();
      } else {
        setSyncMsg(`Error: ${json.error}`);
      }
    } catch {
      setSyncMsg("Sync failed — check console.");
    }
    setSyncing(false);
  };

  const updateCategory = async (id: string, cost_type: string, category: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    await db
      .from("bank_transactions")
      .update({ cost_type, category: category || null })
      .eq("id", id);
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, cost_type, category: category || null } : t))
    );
  };

  const saveTravelNotes = async (
    id: string,
    travel_reason: string,
    travel_who_met: string,
    notes: string
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    await db
      .from("bank_transactions")
      .update({ travel_reason, travel_who_met, notes })
      .eq("id", id);
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, travel_reason, travel_who_met, notes } : t
      )
    );
    setTravelModal(null);
  };

  const uncategorizedCount = transactions.filter((t) => t.cost_type === "uncategorized").length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="mc-btn mc-btn-primary flex items-center gap-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} strokeWidth={1.5} />
          {syncing ? "Syncing…" : "Sync Now"}
        </button>

        <select
          className="mc-select text-xs"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All transactions</option>
          {COST_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {uncategorizedCount > 0 && (
          <span
            className="text-[10px] font-semibold px-2 py-1"
            style={{ background: "var(--mc-warning-bg)", color: "var(--mc-warning)" }}
          >
            {uncategorizedCount} need categorizing
          </span>
        )}

        {syncMsg && (
          <span className="text-[11px] ml-auto" style={{ color: "var(--mc-text-muted)" }}>
            {syncMsg}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="mc-card" style={{ overflowX: "auto" }}>
        {loading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="mc-skeleton h-10" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
              No transactions yet. Click &quot;Sync Now&quot; to pull from Holvi.
            </p>
          </div>
        ) : (
          <table className="mc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Dir</th>
                <th>Type</th>
                <th>Category</th>
                <th>Notes</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const cats = CATEGORIES[tx.cost_type] ?? [];
                const isTravel = tx.category === "travel";
                const hasTravelNotes = tx.travel_reason || tx.travel_who_met;

                return (
                  <tr
                    key={tx.id}
                    style={{
                      borderLeft:
                        tx.cost_type === "uncategorized"
                          ? "2px solid var(--mc-warning)"
                          : "2px solid transparent",
                    }}
                  >
                    <td
                      className="text-[11px] font-mono"
                      style={{ color: "var(--mc-text-muted)", whiteSpace: "nowrap" }}
                    >
                      {tx.transaction_date}
                    </td>
                    <td
                      className="text-xs"
                      style={{ color: "var(--mc-text-primary)", maxWidth: 240 }}
                    >
                      <span className="line-clamp-1">{tx.description || "–"}</span>
                    </td>
                    <td>
                      <span
                        className="text-[10px] font-semibold"
                        style={{
                          color: tx.direction === "in" ? "var(--mc-success)" : "var(--mc-error)",
                        }}
                      >
                        {tx.direction === "in" ? "IN" : "OUT"}
                      </span>
                    </td>
                    <td>
                      <div className="relative">
                        <select
                          className="mc-select text-[10px] pr-6 py-1"
                          value={tx.cost_type}
                          onChange={(e) =>
                            updateCategory(tx.id, e.target.value, tx.category ?? "")
                          }
                        >
                          {COST_TYPES.map((ct) => (
                            <option key={ct.value} value={ct.value}>
                              {ct.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td>
                      {cats.length > 0 ? (
                        <select
                          className="mc-select text-[10px] pr-6 py-1"
                          value={tx.category ?? ""}
                          onChange={(e) =>
                            updateCategory(tx.id, tx.cost_type, e.target.value)
                          }
                        >
                          <option value="">–</option>
                          {cats.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                          –
                        </span>
                      )}
                    </td>
                    <td>
                      {isTravel && (
                        <button
                          onClick={() => setTravelModal(tx)}
                          className="text-[10px] flex items-center gap-1"
                          style={{ color: hasTravelNotes ? "var(--mc-success)" : "var(--mc-info)" }}
                        >
                          <ChevronDown className="w-3 h-3" strokeWidth={1.5} />
                          {hasTravelNotes ? "Edit notes" : "Add notes"}
                        </button>
                      )}
                    </td>
                    <td
                      className="text-xs font-mono"
                      style={{
                        textAlign: "right",
                        color: tx.direction === "in" ? "var(--mc-success)" : "var(--mc-error)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tx.direction === "in" ? "+" : "−"}
                      {formatEUR(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {travelModal && (
        <TravelModal
          tx={travelModal}
          onClose={() => setTravelModal(null)}
          onSave={(reason, whoMet, notes) =>
            saveTravelNotes(travelModal.id, reason, whoMet, notes)
          }
        />
      )}
    </div>
  );
}
