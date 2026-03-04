"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Truck, ArrowLeft, Plus, Minus, Trash2 } from "lucide-react";

interface AvailableProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  sku: string | null;
  size_ml: number | null;
}

interface OrderLine {
  product_id: string;
  product_name: string;
  cases_qty: number;
}

export default function NewSupplyOrderPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<AvailableProduct[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, partner_id")
        .eq("user_id", user.id)
        .single();

      if (!profile || profile.role !== "distributor") {
        router.push("/orders");
        return;
      }

      // Load all active products (Mecanova is the source of all products)
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, brand, category, sku, size_ml")
        .eq("active", true)
        .order("name");

      setProducts(prods || []);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLine = (product: AvailableProduct) => {
    if (lines.find((l) => l.product_id === product.id)) return;
    setLines([...lines, { product_id: product.id, product_name: product.name, cases_qty: 1 }]);
  };

  const updateQty = (productId: string, delta: number) => {
    setLines(
      lines.map((l) =>
        l.product_id === productId
          ? { ...l, cases_qty: Math.max(1, l.cases_qty + delta) }
          : l
      )
    );
  };

  const removeLine = (productId: string) => {
    setLines(lines.filter((l) => l.product_id !== productId));
  };

  const handleSubmit = async () => {
    if (lines.length === 0) return;
    setSubmitting(true);
    setError(null);

    const { data: orderId, error: createErr } = await supabase.rpc("create_supply_order");

    if (createErr || !orderId) {
      setError(createErr?.message || "Failed to create supply order");
      setSubmitting(false);
      return;
    }

    for (const line of lines) {
      const { error: itemErr } = await supabase
        .from("order_request_items")
        .insert({
          order_request_id: orderId,
          product_id: line.product_id,
          cases_qty: line.cases_qty,
        });
      if (itemErr) {
        setError(itemErr.message);
        setSubmitting(false);
        return;
      }
    }

    if (notes.trim()) {
      await supabase
        .from("order_requests")
        .update({ notes: notes.trim() })
        .eq("id", orderId);
    }

    const { error: submitErr } = await supabase.rpc("submit_order", {
      p_order_id: orderId,
    });

    if (submitErr) {
      setError(submitErr.message);
      setSubmitting(false);
      return;
    }

    router.push("/supply-orders");
  };

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-6 w-48 mb-6" />
        <div className="mc-skeleton h-64 max-w-2xl" />
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/supply-orders"
        className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4 transition-colors"
        style={{ color: "var(--mc-text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Supply Orders
      </Link>

      <PageHeader title="New Supply Order" description="Order products from Mecanova to restock your inventory" icon={Truck} />

      {error && (
        <div
          className="mb-5 px-4 py-3 text-xs"
          style={{
            background: "var(--mc-error-bg)",
            border: "1px solid var(--mc-error-light)",
            color: "var(--mc-error)",
          }}
        >
          {error}
        </div>
      )}

      <div className="max-w-3xl space-y-5">
        {/* Supplier info */}
        <div className="mc-card p-5">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Supplier
          </h3>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 flex items-center justify-center text-[10px] font-semibold"
              style={{
                background: "rgba(236, 223, 204, 0.06)",
                border: "1px solid var(--mc-border)",
                color: "var(--mc-cream-dark)",
              }}
            >
              M
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--mc-text-primary)" }}>
                Mecanova
              </p>
              <p className="text-[10px] tracking-wide uppercase" style={{ color: "var(--mc-text-muted)" }}>
                Direct supply
              </p>
            </div>
          </div>
        </div>

        {/* Product selection */}
        <div className="mc-card p-5">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Add Products
          </h3>
          {products.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
              No products available.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {products
                .filter((p) => !lines.find((l) => l.product_id === p.id))
                .map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addLine(product)}
                    className="flex items-center gap-3 p-3 text-left transition-all"
                    style={{
                      background: "var(--mc-surface-warm)",
                      border: "1px solid var(--mc-border-light)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--mc-cream-faint)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--mc-border-light)";
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--mc-cream-subtle)" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--mc-text-primary)" }}>
                        {product.name}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                        {product.brand || product.category}
                        {product.size_ml ? ` · ${product.size_ml}ml` : ""}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Order lines */}
        {lines.length > 0 && (
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Order Items ({lines.length})
            </h3>
            <div className="space-y-2">
              {lines.map((line) => (
                <div
                  key={line.product_id}
                  className="flex items-center gap-3 px-3 py-2"
                  style={{
                    background: "var(--mc-surface-warm)",
                    border: "1px solid var(--mc-border-light)",
                  }}
                >
                  <span className="text-xs font-medium flex-1" style={{ color: "var(--mc-text-primary)" }}>
                    {line.product_name}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(line.product_id, -1)}
                      className="w-6 h-6 flex items-center justify-center"
                      style={{ background: "var(--mc-dark-warm)", border: "1px solid var(--mc-border)" }}
                    >
                      <Minus className="w-3 h-3" style={{ color: "var(--mc-text-muted)" }} />
                    </button>
                    <span className="text-xs w-8 text-center font-mono" style={{ color: "var(--mc-text-primary)" }}>
                      {line.cases_qty}
                    </span>
                    <button
                      onClick={() => updateQty(line.product_id, 1)}
                      className="w-6 h-6 flex items-center justify-center"
                      style={{ background: "var(--mc-dark-warm)", border: "1px solid var(--mc-border)" }}
                    >
                      <Plus className="w-3 h-3" style={{ color: "var(--mc-text-muted)" }} />
                    </button>
                  </div>
                  <span className="text-[10px] w-16 text-right" style={{ color: "var(--mc-text-muted)" }}>
                    {line.cases_qty} {line.cases_qty === 1 ? "case" : "cases"}
                  </span>
                  <button
                    onClick={() => removeLine(line.product_id)}
                    className="text-[11px] transition-colors"
                    style={{ color: "var(--mc-text-muted)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-error)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mc-card p-5">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Notes (optional)
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mc-input"
            rows={3}
            placeholder="Any special instructions..."
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || lines.length === 0}
            className="mc-btn mc-btn-primary"
          >
            {submitting ? "Submitting..." : "Submit Supply Order"}
          </button>
          <Link href="/supply-orders" className="mc-btn mc-btn-ghost">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
