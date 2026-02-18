"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/orders/StatusBadge";
import Timeline from "@/components/orders/Timeline";
import {
  ArrowLeft,
  XCircle,
  Building2,
  Calendar,
  Hash,
  MessageSquare,
  Package,
} from "lucide-react";

interface OrderDetail {
  id: string;
  created_at: string;
  status: string;
  distributor_id: string;
  distributor_name: string;
  notes: string | null;
  submitted_at: string | null;
  accepted_at: string | null;
  fulfilled_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
}

interface OrderItem {
  id: string;
  product_id: string;
  cases_qty: number;
  product_name: string;
}

export default function MyOrderDetailPage() {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const supabase = createClient();

  const loadOrder = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, partner_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "client" && profile.role !== "admin")) {
      router.push("/dashboard");
      return;
    }

    const { data: orderData, error: orderErr } = await supabase
      .from("order_requests")
      .select(
        "id, created_at, status, distributor_id, client_id, notes, submitted_at, accepted_at, fulfilled_at, rejected_at, cancelled_at"
      )
      .eq("id", orderId)
      .single();

    if (orderErr || !orderData) {
      setError("Order not found.");
      setLoading(false);
      return;
    }

    if (
      profile.role === "client" &&
      profile.partner_id &&
      orderData.client_id !== profile.partner_id
    ) {
      setError("You do not have permission to view this order.");
      setLoading(false);
      return;
    }

    let distName = orderData.distributor_id ?? "—";
    if (orderData.distributor_id) {
      const { data: partner } = await supabase
        .from("partners")
        .select("name")
        .eq("id", orderData.distributor_id)
        .single();
      if (partner) distName = partner.name;
    }

    setOrder({
      ...orderData,
      distributor_id: orderData.distributor_id ?? "",
      distributor_name: distName,
    });

    const { data: itemsData } = await supabase
      .from("order_request_items")
      .select("id, product_id, cases_qty")
      .eq("order_request_id", orderId);

    if (itemsData && itemsData.length > 0) {
      const productIds = itemsData.map((i) => i.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds);

      const pMap = new Map<string, string>();
      products?.forEach((p) => pMap.set(p.id, p.name));

      setItems(
        itemsData.map((i) => ({
          ...i,
          product_name: pMap.get(i.product_id) || i.product_id,
        }))
      );
    }

    setLoading(false);
  }, [orderId, supabase, router]);

  useEffect(() => {
    if (orderId) loadOrder();
  }, [orderId, loadOrder]);

  const handleCancel = async () => {
    if (!order) return;
    setCancelling(true);
    setError(null);

    const { error: cancelErr } = await supabase.rpc("cancel_order", {
      p_order_id: order.id,
    });

    if (cancelErr) {
      setError(cancelErr.message || "Failed to cancel order.");
      setCancelling(false);
      return;
    }

    await loadOrder();
    setCancelling(false);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="mc-skeleton h-8 w-48" />
        <div className="mc-card p-6">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="mc-skeleton h-4 w-16 mb-2" />
              <div className="mc-skeleton h-6 w-24" />
            </div>
            <div>
              <div className="mc-skeleton h-4 w-16 mb-2" />
              <div className="mc-skeleton h-5 w-32" />
            </div>
            <div>
              <div className="mc-skeleton h-4 w-16 mb-2" />
              <div className="mc-skeleton h-5 w-40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-6">
        {error && (
          <div
            className="mc-card p-4"
            style={{
              background: "var(--mc-error-bg)",
              borderColor: "var(--mc-error)",
              color: "var(--mc-error)",
            }}
          >
            <span className="text-sm">{error}</span>
          </div>
        )}
        <Link href="/my-orders" className="mc-btn mc-btn-ghost inline-flex">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Back to My Orders
        </Link>
      </div>
    );
  }

  const canCancel =
    order.status === "created" || order.status === "submitted";

  const timelineEvents = [
    { label: "Created", timestamp: order.created_at, status: "created" },
    { label: "Submitted", timestamp: order.submitted_at, status: "submitted" },
    { label: "Accepted", timestamp: order.accepted_at, status: "accepted" },
    { label: "Fulfilled", timestamp: order.fulfilled_at, status: "fulfilled" },
    { label: "Rejected", timestamp: order.rejected_at, status: "rejected" },
    { label: "Cancelled", timestamp: order.cancelled_at, status: "cancelled" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/my-orders"
            className="inline-flex items-center gap-1.5 text-sm mb-4 transition-colors duration-200"
            style={{
              color: "var(--mc-text-tertiary)",
              fontFamily: "var(--font-manrope), sans-serif",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--mc-text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--mc-text-tertiary)")
            }
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Back to My Orders
          </Link>
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-jost), sans-serif",
              color: "var(--mc-text-primary)",
            }}
          >
            Order Detail
          </h1>
          <p
            className="mt-1.5 flex items-center gap-1.5"
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: "0.75rem",
              color: "var(--mc-text-muted)",
            }}
          >
            <Hash className="w-3 h-3" strokeWidth={1.5} />
            {order.id}
          </p>
        </div>
        <StatusBadge status={order.status} large />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order header */}
          <div className="mc-card p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "var(--mc-secondary)",
                    color: "var(--mc-text-tertiary)",
                  }}
                >
                  <Building2 className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-1"
                    style={{ color: "var(--mc-text-muted)" }}
                  >
                    Distributor
                  </p>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--mc-text-primary)" }}
                  >
                    {order.distributor_name}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "var(--mc-secondary)",
                    color: "var(--mc-text-tertiary)",
                  }}
                >
                  <Calendar className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-1"
                    style={{ color: "var(--mc-text-muted)" }}
                  >
                    Created
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: "var(--mc-text-secondary)" }}
                  >
                    {formatDate(order.created_at)}
                  </p>
                </div>
              </div>
            </div>

            {order.notes && (
              <div
                className="mt-5 pt-5 flex items-start gap-3"
                style={{ borderTop: "1px solid var(--mc-border)" }}
              >
                <div
                  className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "var(--mc-secondary)",
                    color: "var(--mc-text-tertiary)",
                  }}
                >
                  <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-1"
                    style={{ color: "var(--mc-text-muted)" }}
                  >
                    Notes
                  </p>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--mc-text-secondary)" }}
                  >
                    {order.notes}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="mc-card p-6">
            <div className="flex items-center gap-2 mb-5">
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
              <span
                className="ml-auto text-xs px-2 py-0.5 font-medium"
                style={{
                  background: "var(--mc-secondary)",
                  color: "var(--mc-text-tertiary)",
                }}
              >
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
            </div>

            {items.length === 0 ? (
              <p
                className="text-sm"
                style={{ color: "var(--mc-text-muted)" }}
              >
                No items.
              </p>
            ) : (
              <div className="space-y-0">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-3.5"
                    style={{
                      borderBottom:
                        idx < items.length - 1
                          ? "1px solid var(--mc-border)"
                          : "none",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 flex items-center justify-center"
                        style={{
                          background: "var(--mc-secondary)",
                          color: "var(--mc-text-muted)",
                        }}
                      >
                        <Package className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--mc-text-primary)" }}
                      >
                        {item.product_name}
                      </span>
                    </div>
                    <span
                      className="text-sm font-medium px-3 py-1"
                      style={{
                        background: "var(--mc-secondary)",
                        color: "var(--mc-text-secondary)",
                        fontFamily:
                          "var(--font-jetbrains), monospace",
                      }}
                    >
                      {item.cases_qty} cases
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cancel action */}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="mc-btn mc-btn-danger gap-2"
            >
              <XCircle className="w-4 h-4" strokeWidth={1.5} />
              {cancelling ? "Cancelling…" : "Cancel Order"}
            </button>
          )}
        </div>

        {/* Right column: Timeline */}
        <div className="lg:col-span-1">
          <div className="mc-card p-6 lg:sticky lg:top-10">
            <h2
              className="text-base font-semibold mb-5"
              style={{
                fontFamily: "var(--font-jost), sans-serif",
                color: "var(--mc-text-primary)",
              }}
            >
              Timeline
            </h2>
            <Timeline events={timelineEvents} currentStatus={order.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
