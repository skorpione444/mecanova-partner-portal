"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/supabase/types";
import {
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  Package,
  MessageSquare,
  Building2,
} from "lucide-react";

interface Distributor {
  id: string;
  name: string;
  is_default: boolean;
}

interface OrderItem {
  product_id: string;
  quantity: number;
}

export default function NewOrderPage() {
  const [products, setProducts] = useState<Pick<Product, "id" | "name">[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const [distributorId, setDistributorId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([
    { product_id: "", quantity: 1 },
  ]);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, partner_id")
        .eq("user_id", user.id)
        .single();

      if (!profile || (profile.role !== "client" && profile.role !== "admin")) {
        router.push("/dashboard");
        return;
      }

      const { data: prods } = await supabase
        .from("products")
        .select("id, name")
        .eq("active", true)
        .order("name");

      if (prods) setProducts(prods);

      if (profile.partner_id) {
        const { data: cdData } = await supabase
          .from("client_distributors")
          .select("distributor_id, is_default")
          .eq("client_id", profile.partner_id);

        if (cdData && cdData.length > 0) {
          const distIds = cdData.map((cd) => cd.distributor_id);
          const { data: partners } = await supabase
            .from("partners")
            .select("id, name")
            .in("id", distIds);

          const partnerMap = new Map<string, string>();
          partners?.forEach((p) => partnerMap.set(p.id, p.name));

          const distList: Distributor[] = cdData.map((cd) => ({
            id: cd.distributor_id,
            name: partnerMap.get(cd.distributor_id) || cd.distributor_id,
            is_default: cd.is_default,
          }));

          setDistributors(distList);

          const def = distList.find((d) => d.is_default) || distList[0];
          if (def) setDistributorId(def.id);
        }
      }

      setLoading(false);
    };

    load();
  }, [supabase, router]);

  const addItem = () =>
    setItems([...items, { product_id: "", quantity: 1 }]);

  const removeItem = (idx: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (
    idx: number,
    field: keyof OrderItem,
    value: string | number
  ) => {
    const copy = [...items];
    copy[idx] = { ...copy[idx], [field]: value };
    setItems(copy);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const validItems = items.filter((i) => i.product_id && i.quantity > 0);

    if (validItems.length === 0) {
      setError("Add at least one product with a valid quantity.");
      setSubmitting(false);
      return;
    }

    if (!distributorId) {
      setError("Please select a distributor.");
      setSubmitting(false);
      return;
    }

    const { data: orderId, error: createErr } = await supabase.rpc(
      "create_order",
      { p_distributor_id: distributorId }
    );

    if (createErr || !orderId) {
      setError(createErr?.message || "Failed to create order.");
      setSubmitting(false);
      return;
    }

    const { error: itemsErr } = await supabase
      .from("order_request_items")
      .insert(
        validItems.map((i) => ({
          order_request_id: orderId,
          product_id: i.product_id,
          cases_qty: i.quantity,
        }))
      );

    if (itemsErr) {
      setError(`Failed to add items: ${itemsErr.message}`);
      setSubmitting(false);
      return;
    }

    const { error: submitErr } = await supabase.rpc("submit_order", {
      p_order_id: orderId,
    });

    if (submitErr) {
      setError(`Failed to submit order: ${submitErr.message}`);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/my-orders"), 1500);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="mc-skeleton h-8 w-48 mb-3" />
          <div className="mc-skeleton h-5 w-72" />
        </div>
        <div className="mc-card p-6 space-y-4">
          <div className="mc-skeleton h-11 w-72" />
          <div className="mc-skeleton h-20 w-full" />
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mc-card p-16 text-center mc-animate-page">
        <div
          className="w-14 h-14 flex items-center justify-center mx-auto mb-5"
          style={{
            background: "var(--mc-success-bg)",
            color: "var(--mc-success)",
          }}
        >
          <CheckCircle2 className="w-7 h-7" strokeWidth={1.5} />
        </div>
        <p
          className="text-xl font-semibold mb-2"
          style={{
            fontFamily: "var(--font-jost), sans-serif",
            color: "var(--mc-text-primary)",
          }}
        >
          Order Submitted
        </p>
        <p className="text-sm" style={{ color: "var(--mc-text-tertiary)" }}>
          Your order has been submitted for review. Redirecting…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{
            fontFamily: "var(--font-jost), sans-serif",
            color: "var(--mc-text-primary)",
          }}
        >
          New Order Request
        </h1>
        <p
          className="mt-2 text-sm"
          style={{
            color: "var(--mc-text-tertiary)",
            fontFamily: "var(--font-manrope), sans-serif",
          }}
        >
          Submit a new order for review by your distributor
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Distributor & Notes */}
        <div className="mc-card p-6 space-y-5">
          {distributors.length > 0 && (
            <div>
              <label className="mc-label flex items-center gap-2">
                <Building2
                  className="w-3.5 h-3.5"
                  style={{ color: "var(--mc-text-muted)" }}
                  strokeWidth={1.5}
                />
                Distributor
              </label>
              <select
                value={distributorId}
                onChange={(e) => setDistributorId(e.target.value)}
                required
                className="mc-input mc-select max-w-md"
              >
                <option value="">Select distributor</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mc-label flex items-center gap-2">
              <MessageSquare
                className="w-3.5 h-3.5"
                style={{ color: "var(--mc-text-muted)" }}
                strokeWidth={1.5}
              />
              Notes
              <span
                className="font-normal"
                style={{ color: "var(--mc-text-muted)" }}
              >
                (optional)
              </span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mc-input resize-none"
              placeholder="Special requirements or delivery notes…"
            />
          </div>
        </div>

        {/* Order Items */}
        <div className="mc-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Package
                className="w-4 h-4"
                style={{ color: "var(--mc-text-tertiary)" }}
                strokeWidth={1.5}
              />
              <h2
                className="text-base font-semibold"
                style={{
                  fontFamily: "var(--font-jost), sans-serif",
                  color: "var(--mc-text-primary)",
                }}
              >
                Order Items
              </h2>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mc-btn mc-btn-ghost py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex gap-3 items-end p-3 transition-colors duration-200"
                style={{
                  background: "var(--mc-muted)",
                  border: "1px solid var(--mc-border)",
                }}
              >
                <div className="flex-1">
                  {idx === 0 && (
                    <label className="mc-label text-xs">Product</label>
                  )}
                  <select
                    value={item.product_id}
                    onChange={(e) =>
                      updateItem(idx, "product_id", e.target.value)
                    }
                    required
                    className="mc-input mc-select"
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  {idx === 0 && (
                    <label className="mc-label text-xs">Cases</label>
                  )}
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(
                        idx,
                        "quantity",
                        parseInt(e.target.value) || 1
                      )
                    }
                    required
                    className="mc-input text-center"
                    style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                    }}
                  />
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="mc-btn p-2.5 transition-colors duration-200"
                    style={{
                      color: "var(--mc-text-muted)",
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--mc-error)";
                      e.currentTarget.style.background = "var(--mc-error-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--mc-text-muted)";
                      e.currentTarget.style.background = "transparent";
                    }}
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mc-card p-4 mc-animate-fade"
            style={{
              background: "var(--mc-error-bg)",
              borderColor: "var(--mc-error)",
              color: "var(--mc-error)",
            }}
          >
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="mc-btn mc-btn-amber gap-2"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" strokeWidth={1.5} />
                Submit Order
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mc-btn mc-btn-ghost"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
