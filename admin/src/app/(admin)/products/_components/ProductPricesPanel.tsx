"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProductPrice } from "@mecanova/shared";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

type Unit = "bottle" | "case";
type Currency = "EUR" | "USD" | "MXN";

const CURRENCY_SYMBOL: Record<string, string> = { EUR: "€", USD: "$", MXN: "MX$" };

function fmt(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  productId: string;
  /** Resolved bottles-per-case used for new entries + the "required" gate. */
  bottlesPerCase: number | null;
  editable: boolean;
  onChanged?: () => void;
}

export default function ProductPricesPanel({ productId, bottlesPerCase, editable, onChanged }: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<ProductPrice[]>([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<Unit>("bottle");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("product_prices")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setRows((data as ProductPrice[]) || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const factorReady = !!bottlesPerCase && bottlesPerCase > 0;

  const addPrice = async () => {
    setError(null);
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value < 0) {
      setError("Enter a valid price.");
      return;
    }
    if (!factorReady) {
      setError("Set 'Bottles per Case' in Specs first.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }
    const { error: insertError } = await supabase.from("product_prices").insert({
      product_id: productId,
      amount: value,
      unit,
      currency,
      bottles_per_case: bottlesPerCase as number,
      notes: notes.trim() || null,
      created_by: user.id,
    });
    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }
    setAmount("");
    setNotes("");
    setSaving(false);
    await load();
    onChanged?.();
  };

  const deletePrice = async (id: string) => {
    if (!confirm("Delete this price entry? This cannot be undone.")) return;
    await supabase.from("product_prices").delete().eq("id", id);
    setRows((prev) => prev.filter((r) => r.id !== id));
    onChanged?.();
  };

  return (
    <div>
      {/* Add form */}
      {editable && (
        factorReady ? (
          <div
            className="p-4 mb-4"
            style={{ background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)" }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="mc-label" htmlFor="pp-amount">Price</label>
                <input
                  id="pp-amount"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mc-input"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mc-label" htmlFor="pp-unit">Per</label>
                <select
                  id="pp-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Unit)}
                  className="mc-input mc-select"
                >
                  <option value="bottle">Bottle</option>
                  <option value="case">Case</option>
                </select>
              </div>
              <div>
                <label className="mc-label" htmlFor="pp-currency">Currency</label>
                <select
                  id="pp-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="mc-input mc-select"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="MXN">MXN</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addPrice}
                  disabled={saving || !amount.trim()}
                  className="mc-btn mc-btn-primary w-full"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {saving ? "Adding…" : "Add price"}
                </button>
              </div>
            </div>
            <div className="mt-3">
              <label className="mc-label" htmlFor="pp-notes">Note (optional)</label>
              <input
                id="pp-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mc-input"
                placeholder="e.g. 2026 contract, MOQ 50 cases…"
              />
            </div>
            <p className="text-[10px] mt-2" style={{ color: "var(--mc-text-muted)" }}>
              The other unit is calculated automatically using {bottlesPerCase} bottles / case.
            </p>
            {error && (
              <p className="text-[11px] mt-2" style={{ color: "var(--mc-error)" }}>{error}</p>
            )}
          </div>
        ) : (
          <div
            className="flex items-start gap-2 p-3 mb-4 text-xs"
            style={{
              background: "var(--mc-error-bg)",
              border: "1px solid var(--mc-error-light)",
              color: "var(--mc-error)",
            }}
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Set <strong>Bottles per Case</strong> in the Specs section above and save the
              product before adding prices, so each price can be shown per bottle and per case.
            </span>
          </div>
        )
      )}

      {/* List — newest first */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="mc-skeleton h-12" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs py-6 text-center" style={{ color: "var(--mc-text-muted)" }}>
          No prices recorded yet.
        </p>
      ) : (
        <div style={{ border: "1px solid var(--mc-border)" }}>
          {rows.map((row, i) => {
            const factor = row.bottles_per_case || 0;
            const perBottle = row.unit === "bottle"
              ? row.amount
              : factor > 0 ? row.amount / factor : null;
            const perCase = row.unit === "case"
              ? row.amount
              : factor > 0 ? row.amount * factor : null;
            const sym = CURRENCY_SYMBOL[row.currency] ?? row.currency;
            return (
              <div
                key={row.id}
                className="px-4 py-3 flex items-start gap-3"
                style={{
                  borderBottom: i < rows.length - 1 ? "1px solid var(--mc-border)" : "none",
                  background: i === 0 ? "rgba(236,223,204,0.04)" : "transparent",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: "var(--mc-cream)" }}
                    >
                      {sym}{perBottle != null ? fmt(perBottle) : "—"}
                      <span className="text-[10px] font-normal ml-1" style={{ color: "var(--mc-text-muted)" }}>
                        / bottle
                      </span>
                    </span>
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: "var(--mc-cream)" }}
                    >
                      {sym}{perCase != null ? fmt(perCase) : "—"}
                      <span className="text-[10px] font-normal ml-1" style={{ color: "var(--mc-text-muted)" }}>
                        / case
                      </span>
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                      {row.currency} · entered per {row.unit} · {factor} btl/case
                      {i === 0 ? " · latest" : ""}
                    </span>
                  </div>
                  {row.notes && (
                    <p className="text-xs mt-1" style={{ color: "var(--mc-text-secondary)", whiteSpace: "pre-wrap" }}>
                      {row.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10px] tabular-nums" style={{ color: "var(--mc-text-muted)" }}>
                    {new Date(row.created_at).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => deletePrice(row.id)}
                      className="mc-btn mc-btn-danger"
                      style={{ fontSize: 11 }}
                      title="Delete price"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
