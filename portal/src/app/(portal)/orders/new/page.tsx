"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { ShoppingCart, ArrowLeft, Plus, Minus, Trash2 } from "lucide-react";

interface Distributor {
  id: string;
  name: string;
  is_default: boolean;
  contract_type: string;
}

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

export default function NewOrderPage() {
  const [loading, setLoading] = useState(true);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);
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

      if (!profile || profile.role !== "client" || !profile.partner_id) {
        router.push("/orders");
        return;
      }

      const { data: cd } = await supabase
        .from("client_distributors")
        .select("distributor_id, is_default, contract_type")
        .eq("client_id", profile.partner_id);

      if (!cd || cd.length === 0) {
        setError("No distributor has been assigned to your account. Please contact your account manager.");
        setLoading(false);
        return;
      }

      const distIds = cd.map((c) => c.distributor_id);
      const { data: distPartners } = await supabase
        .from("partners")
        .select("id, name")
        .in("id", distIds);

      const dists: Distributor[] = (distPartners || []).map((dp) => {
        const rel = cd.find((c) => c.distributor_id === dp.id);
        return {
          id: dp.id,
          name: dp.name,
          is_default: rel?.is_default || false,
          contract_type: rel?.contract_type || "allowed",
        };
      });

      setDistributors(dists);

      const defaultDist = dists.find((d) => d.is_default) || dists[0];
      setSelectedDistributor(defaultDist);

      if (defaultDist) {
        const { data: inv } = await supabase
          .from("inventory_status")
          .select("product_id")
          .eq("distributor_id", defaultDist.id);

        const productIds = (inv || []).map((i) => i.product_id);
        if (productIds.length > 0) {
          const { data: prods } = await supabase
            .from("products")
            .select("id, name, brand, category, sku, size_ml")
            .eq("active", true)
            .in("id", productIds)
            .order("name");
          setProducts(prods || []);
        }
      }

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
    if (!selectedDistributor || lines.length === 0) return;
    setSubmitting(true);
    setError(null);

    const { data: orderId, error: createErr } = await supabase.rpc("create_order", {
      p_distributor_id: selectedDistributor.id,
    });

    if (createErr || !orderId) {
      setError(createErr?.message || "Failed to create order");
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

    router.push("/orders");
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
        href="/orders"
        className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4 transition-colors"
        style={{ color: "var(--mc-text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Orders
      </Link>

      <PageHeader title="New Order" description="Create a new order request" icon={ShoppingCart} />

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
        {/* Distributor — READ ONLY for clients */}
        <div className="mc-card p-5">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Distributor
          </h3>
          {selectedDistributor ? (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 flex items-center justify-center text-[10px] font-semibold"
                style={{
                  background: "rgba(236, 223, 204, 0.06)",
                  border: "1px solid var(--mc-border)",
                  color: "var(--mc-cream-dark)",
                }}
              >
                {selectedDistributor.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--mc-text-primary)" }}>
                  {selectedDistributor.name}
                </p>
                <p className="text-[10px] tracking-wide uppercase" style={{ color: "var(--mc-text-muted)" }}>
                  {selectedDistributor.contract_type} distributor
                  {selectedDistributor.is_default && " · Default"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
              No distributor assigned
            </p>
          )}
          {distributors.length > 1 && (
            <p className="text-[10px] mt-2" style={{ color: "var(--mc-text-muted)" }}>
              Your account has {distributors.length} assigned distributors.
              Contact your account manager to change the default.
            </p>
          )}
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
              No products available from this distributor.
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
            disabled={submitting || lines.length === 0 || !selectedDistributor}
            className="mc-btn mc-btn-primary"
          >
            {submitting ? "Submitting..." : "Submit Order"}
          </button>
          <Link href="/orders" className="mc-btn mc-btn-ghost">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
