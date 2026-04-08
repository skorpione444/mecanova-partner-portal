"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import type {
  OrderRequest,
  OrderRequestItem,
  OrderStatus,
} from "@mecanova/shared";
import { ACTIVE_ORDER_STATUSES, ORDER_STATUS_LABELS } from "@mecanova/shared";
import type { ActiveOrderStatus } from "@mecanova/shared";
import {
  ClipboardList,
  ArrowLeft,
  User,
  Building2,
  Calendar,
  Package,
  MessageSquare,
  RefreshCw,
  X,
  Check,
} from "lucide-react";

interface OrderDetail extends OrderRequest {
  partner_name: string;
  client_name: string | null;
  distributor_name: string | null;
  delivery_distributors: { distributor_id: string; name: string; cases: number }[];
  items: (OrderRequestItem & { product_name: string })[];
}

interface CancelReversalState {
  allocation: Record<string, Record<string, string>>; // [product_id][distributor_id]
  deliveries: { distributor_id: string; name: string; product_id: string; product_name: string; original_qty: number }[];
  allDistributors: { id: string; name: string }[];
  submitting: boolean;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [overriding, setOverriding] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "">("");
  const [cancelReversalModal, setCancelReversalModal] = useState<CancelReversalState | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: orderData } = await supabase
      .from("order_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (!orderData) {
      router.push("/orders");
      return;
    }

    // Get partner names
    const partnerIds = new Set<string>();
    partnerIds.add(orderData.partner_id);
    if (orderData.client_id) partnerIds.add(orderData.client_id);
    if (orderData.distributor_id) partnerIds.add(orderData.distributor_id);

    const { data: partners } = await supabase
      .from("partners")
      .select("id, name")
      .in("id", [...partnerIds]);
    const nameMap = new Map(
      (partners || []).map((p) => [p.id, p.name])
    );

    // Get order items
    const { data: items } = await supabase
      .from("order_request_items")
      .select("*")
      .eq("order_request_id", id);

    let enrichedItems: (OrderRequestItem & { product_name: string })[] = [];
    if (items && items.length > 0) {
      const productIds = items.map((i) => i.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds);
      const prodMap = new Map(
        (products || []).map((p) => [p.id, p.name])
      );
      enrichedItems = items.map((i) => ({
        ...i,
        product_name: prodMap.get(i.product_id) || "Unknown",
      }));
    }

    // Get delivery breakdown from inventory_movements
    const { data: deliveryMovs } = await supabase
      .from("inventory_movements")
      .select("distributor_id, qty_delta")
      .eq("order_request_id", id)
      .eq("movement_type", "order_deliver");

    const deliveryDistMap = new Map<string, number>();
    (deliveryMovs || []).forEach((m) => {
      deliveryDistMap.set(m.distributor_id, (deliveryDistMap.get(m.distributor_id) || 0) + Math.abs(m.qty_delta));
    });

    let deliveryDistributors: OrderDetail["delivery_distributors"] = [];
    if (deliveryDistMap.size > 0) {
      const movDistIds = [...deliveryDistMap.keys()].filter((did) => !nameMap.has(did));
      if (movDistIds.length > 0) {
        const { data: movDists } = await supabase.from("partners").select("id, name").in("id", movDistIds);
        (movDists || []).forEach((d) => nameMap.set(d.id, d.name));
      }
      deliveryDistributors = [...deliveryDistMap.entries()].map(([distributor_id, cases]) => ({
        distributor_id,
        name: nameMap.get(distributor_id) || "Unknown",
        cases,
      }));
    }

    setOrder({
      ...orderData,
      partner_name: nameMap.get(orderData.partner_id) || "Unknown",
      client_name: orderData.client_id
        ? nameMap.get(orderData.client_id) || null
        : null,
      distributor_name: orderData.distributor_id
        ? nameMap.get(orderData.distributor_id) || null
        : null,
      delivery_distributors: deliveryDistributors,
      items: enrichedItems,
    });
    setSelectedStatus(orderData.status);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOverrideStatus = async () => {
    if (!selectedStatus || !order || selectedStatus === order.status) return;
    setOverriding(true);

    const now = new Date().toISOString();
    const updateData: Record<string, string> = {
      status: selectedStatus,
      updated_at: now,
    };

    if (selectedStatus === "submitted") updateData.submitted_at = now;
    if (selectedStatus === "accepted") updateData.accepted_at = now;
    if (selectedStatus === "rejected") updateData.rejected_at = now;
    if (selectedStatus === "cancelled") updateData.cancelled_at = now;
    if (selectedStatus === "delivered") updateData.delivered_at = now;

    const becomesDelivered = selectedStatus === "delivered" && order.status !== "delivered";
    const cancellingDelivered = selectedStatus === "cancelled" && order.status === "delivered";
    const distId = order.distributor_id;

    // Deduct inventory when transitioning INTO delivered
    if (becomesDelivered && distId) {
      for (const item of order.items) {
        const { data: existing } = await supabase
          .from("inventory_status")
          .select("on_hand_qty")
          .eq("product_id", item.product_id)
          .eq("distributor_id", distId)
          .maybeSingle();
        const newQty = Math.max(0, (existing?.on_hand_qty ?? 0) - item.cases_qty);
        if (existing) {
          await supabase.from("inventory_status").update({
            on_hand_qty: newQty,
            status: newQty <= 0 ? "out" : "in_stock",
            updated_at: now,
          }).eq("product_id", item.product_id).eq("distributor_id", distId);
        }
        await supabase.from("inventory_movements").insert({
          distributor_id: distId,
          product_id: item.product_id,
          movement_type: "order_deliver",
          qty_delta: -item.cases_qty,
          order_request_id: order.id,
        });
      }
    }

    // When cancelling a delivered order: show reversal modal
    if (cancellingDelivered) {
      const { data: movs } = await supabase
        .from("inventory_movements")
        .select("distributor_id, product_id, qty_delta")
        .eq("order_request_id", id)
        .eq("movement_type", "order_deliver");

      if (movs && movs.length > 0) {
        // Group by (product_id, distributor_id)
        const deliveryMap: Record<string, Record<string, number>> = {};
        movs.forEach((m) => {
          if (!deliveryMap[m.product_id]) deliveryMap[m.product_id] = {};
          deliveryMap[m.product_id][m.distributor_id] = (deliveryMap[m.product_id][m.distributor_id] || 0) + Math.abs(m.qty_delta);
        });

        const movDistIds = [...new Set(movs.map((m) => m.distributor_id))];
        const { data: distNames } = await supabase.from("partners").select("id, name").in("id", movDistIds);
        const { data: allDists } = await supabase.from("partners").select("id, name").eq("partner_type", "distributor").order("name");
        const distNameMap = new Map((distNames || []).map((d) => [d.id, d.name]));

        const deliveries: CancelReversalState["deliveries"] = [];
        const defaultAllocation: Record<string, Record<string, string>> = {};
        Object.entries(deliveryMap).forEach(([product_id, distMap]) => {
          const item = order.items.find((i) => i.product_id === product_id);
          const product_name = item ? item.product_name : "Unknown";
          Object.entries(distMap).forEach(([distributor_id, original_qty]) => {
            deliveries.push({ distributor_id, name: distNameMap.get(distributor_id) || "Unknown", product_id, product_name, original_qty });
            if (!defaultAllocation[product_id]) defaultAllocation[product_id] = {};
            defaultAllocation[product_id][distributor_id] = String(original_qty);
          });
        });

        setCancelReversalModal({
          allocation: defaultAllocation,
          deliveries,
          allDistributors: (allDists || []) as { id: string; name: string }[],
          submitting: false,
        });
        setOverriding(false);
        return;
      }

      // Fallback: no movement rows — restore to single distributor
      if (distId) {
        for (const item of order.items) {
          const { data: existing } = await supabase
            .from("inventory_status")
            .select("on_hand_qty")
            .eq("product_id", item.product_id)
            .eq("distributor_id", distId)
            .maybeSingle();
          const newQty = (existing?.on_hand_qty ?? 0) + item.cases_qty;
          if (existing) {
            await supabase.from("inventory_status").update({
              on_hand_qty: newQty,
              status: newQty <= 0 ? "out" : "in_stock",
              updated_at: now,
            }).eq("product_id", item.product_id).eq("distributor_id", distId);
          } else {
            await supabase.from("inventory_status").insert({
              product_id: item.product_id, distributor_id: distId,
              on_hand_qty: newQty, status: "in_stock",
            });
          }
          await supabase.from("inventory_movements").insert({
            distributor_id: distId,
            product_id: item.product_id,
            movement_type: "order_cancel_reversal",
            qty_delta: item.cases_qty,
            order_request_id: order.id,
          });
        }
      }
    }

    await supabase.from("order_requests").update(updateData).eq("id", id);
    await load();
    setOverriding(false);
  };

  const handleCancelReversal = async () => {
    if (!cancelReversalModal || !order) return;
    setCancelReversalModal((prev) => prev ? { ...prev, submitting: true } : prev);

    const now = new Date().toISOString();
    const { allocation } = cancelReversalModal;

    for (const [product_id, distMap] of Object.entries(allocation)) {
      for (const [distributor_id, casesStr] of Object.entries(distMap)) {
        const qty = parseInt(casesStr) || 0;
        if (qty <= 0) continue;
        const { data: existing } = await supabase
          .from("inventory_status")
          .select("on_hand_qty")
          .eq("product_id", product_id)
          .eq("distributor_id", distributor_id)
          .maybeSingle();
        const newQty = (existing?.on_hand_qty ?? 0) + qty;
        if (existing) {
          await supabase.from("inventory_status").update({
            on_hand_qty: newQty,
            status: newQty <= 0 ? "out" : "in_stock",
            updated_at: now,
          }).eq("product_id", product_id).eq("distributor_id", distributor_id);
        } else {
          await supabase.from("inventory_status").insert({
            product_id, distributor_id,
            on_hand_qty: newQty, status: "in_stock",
          });
        }
        await supabase.from("inventory_movements").insert({
          distributor_id, product_id,
          movement_type: "order_cancel_reversal",
          qty_delta: qty,
          order_request_id: order.id,
        });
      }
    }

    await supabase.from("order_requests").update({
      status: "cancelled",
      cancelled_at: now,
      updated_at: now,
    }).eq("id", id);

    setCancelReversalModal(null);
    await load();
  };

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-6 w-48 mb-6" />
        <div className="mc-skeleton h-48 mb-4" />
        <div className="mc-skeleton h-32" />
      </div>
    );
  }

  if (!order) return null;

  const timelineEvents = [
    { label: "Created", date: order.created_at },
    order.submitted_at && { label: "Submitted", date: order.submitted_at },
    order.accepted_at && { label: "Accepted", date: order.accepted_at },
    order.rejected_at && { label: "Rejected", date: order.rejected_at },
    order.fulfilled_at && { label: "Fulfilled", date: order.fulfilled_at },
    order.cancelled_at && { label: "Cancelled", date: order.cancelled_at },
  ].filter(Boolean) as { label: string; date: string }[];

  return (
    <div>
      <Link
        href="/operations?tab=orders"
        className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4 transition-colors"
        style={{ color: "var(--mc-text-muted)" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = "var(--mc-cream)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "var(--mc-text-muted)")
        }
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Operations
      </Link>

      <PageHeader
        title={`Order ${id.slice(0, 8)}...`}
        icon={ClipboardList}
        actions={<StatusBadge status={order.status} large />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Order info */}
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Order Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <User
                  className="w-3.5 h-3.5 mt-0.5"
                  style={{ color: "var(--mc-text-muted)" }}
                />
                <div>
                  <p className="mc-label">Client</p>
                  <p className="text-sm">
                    {order.client_name || (
                      <span style={{ color: "var(--mc-text-muted)" }}>—</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Building2
                  className="w-3.5 h-3.5 mt-0.5"
                  style={{ color: "var(--mc-text-muted)" }}
                />
                <div>
                  <p className="mc-label">
                    {order.delivery_distributors.length > 1 ? "Fulfilled from" : "Distributor"}
                  </p>
                  {order.delivery_distributors.length > 0 ? (
                    <div className="space-y-0.5">
                      {order.delivery_distributors.map((d) => (
                        <p key={d.distributor_id} className="text-sm">
                          {d.name}
                          <span className="ml-1.5 text-[11px]" style={{ color: "var(--mc-text-muted)" }}>
                            {d.cases} cs
                          </span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm">
                      {order.distributor_name || (
                        <span style={{ color: "var(--mc-text-muted)" }}>—</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar
                  className="w-3.5 h-3.5 mt-0.5"
                  style={{ color: "var(--mc-text-muted)" }}
                />
                <div>
                  <p className="mc-label">Created</p>
                  <p className="text-sm">
                    {new Date(order.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              {order.notes && (() => {
                const groupMatch = order.notes.match(/\[group:([A-Z0-9]+)\]/);
                const splitMatch = order.notes.match(/\[split from #([A-Za-z0-9]+)\]/);
                const groupToken = groupMatch?.[1];
                const parentId = splitMatch?.[1];
                const displayNotes = order.notes
                  .replace(/\[group:[A-Z0-9]+\]\s*/g, "")
                  .replace(/\[split from #[A-Za-z0-9]+\]\s*/g, "")
                  .trim() || null;
                return (
                  <>
                    {(groupToken || parentId) && (
                      <div className="col-span-2 px-3 py-2" style={{ background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)" }}>
                        <p className="text-[11px]" style={{ color: "var(--mc-text-muted)" }}>
                          {parentId ? (
                            <>
                              Split from order{" "}
                              <span className="font-medium font-mono" style={{ color: "var(--mc-text-secondary)" }}>#{parentId}</span>
                              {groupToken && (
                                <> · Group <span className="font-medium font-mono" style={{ color: "var(--mc-text-secondary)" }}>{groupToken}</span></>
                              )}
                            </>
                          ) : (
                            <>
                              This order was split into parts
                              {groupToken && (
                                <> · Group <span className="font-medium font-mono" style={{ color: "var(--mc-text-secondary)" }}>{groupToken}</span></>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                    )}
                    {displayNotes && (
                      <div className="flex items-start gap-2 col-span-2">
                        <MessageSquare
                          className="w-3.5 h-3.5 mt-0.5"
                          style={{ color: "var(--mc-text-muted)" }}
                        />
                        <div>
                          <p className="mc-label">Notes</p>
                          <p className="text-sm">{displayNotes}</p>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Order items */}
          <div className="mc-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Package
                className="w-4 h-4"
                style={{ color: "var(--mc-text-muted)" }}
              />
              <h3
                className="text-xs font-semibold tracking-[0.08em] uppercase"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Items ({order.items.length})
              </h3>
            </div>
            {order.items.length === 0 ? (
              <p
                className="text-xs"
                style={{ color: "var(--mc-text-muted)" }}
              >
                No items in this order
              </p>
            ) : (
              <table className="mc-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          href={`/products/${item.product_id}`}
                          className="text-xs transition-colors"
                          style={{ color: "var(--mc-cream-muted)" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color = "var(--mc-cream)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color =
                              "var(--mc-cream-muted)")
                          }
                        >
                          {item.product_name}
                        </Link>
                      </td>
                      <td>{item.cases_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Admin Override */}
          <div className="mc-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw
                className="w-4 h-4"
                style={{ color: "var(--mc-warning)" }}
              />
              <h3
                className="text-xs font-semibold tracking-[0.08em] uppercase"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Admin Override
              </h3>
            </div>
            <p
              className="text-[10px] mb-3"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Override the order status. Use with caution.
            </p>
            <select
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(e.target.value as OrderStatus)
              }
              className="mc-input mc-select mb-3"
            >
              {ACTIVE_ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s as ActiveOrderStatus]}
                </option>
              ))}
            </select>
            <button
              onClick={handleOverrideStatus}
              disabled={
                overriding ||
                !selectedStatus ||
                selectedStatus === order.status
              }
              className="mc-btn mc-btn-danger w-full"
            >
              {overriding ? "Updating..." : "Override Status"}
            </button>
          </div>

          {/* Timeline */}
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Timeline
            </h3>
            <div className="space-y-3">
              {timelineEvents.map((event, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div
                    className="w-2 h-2 mt-1.5 flex-shrink-0"
                    style={{
                      background:
                        idx === timelineEvents.length - 1
                          ? "var(--mc-cream)"
                          : "var(--mc-border-warm)",
                    }}
                  />
                  <div>
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--mc-text-primary)" }}
                    >
                      {event.label}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: "var(--mc-text-muted)" }}
                    >
                      {new Date(event.date).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cancel Reversal Modal ─────────────────────────────────────────────── */}
      {cancelReversalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <div className="mc-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold mb-0.5" style={{ color: "var(--mc-text-primary)" }}>
                  Cancel Order — Restore Inventory
                </h3>
                <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                  Where should the cases be returned to?
                </p>
              </div>
              <button
                onClick={() => setCancelReversalModal(null)}
                disabled={cancelReversalModal.submitting}
                style={{ color: "var(--mc-text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Per-product reversal inputs */}
            {(() => {
              // Get unique products from deliveries
              const productIds = [...new Set(cancelReversalModal.deliveries.map((d) => d.product_id))];

              const hasOverReturn = productIds.some((pid) => {
                const originalTotal = cancelReversalModal.deliveries
                  .filter((d) => d.product_id === pid)
                  .reduce((s, d) => s + d.original_qty, 0);
                const returnTotal = Object.values(cancelReversalModal.allocation[pid] || {})
                  .reduce((s, v) => s + (parseInt(v) || 0), 0);
                return returnTotal > originalTotal;
              });

              const hasUnderReturn = productIds.some((pid) => {
                const originalTotal = cancelReversalModal.deliveries
                  .filter((d) => d.product_id === pid)
                  .reduce((s, d) => s + d.original_qty, 0);
                const returnTotal = Object.values(cancelReversalModal.allocation[pid] || {})
                  .reduce((s, v) => s + (parseInt(v) || 0), 0);
                return returnTotal < originalTotal;
              });

              return (
                <>
                  {productIds.map((pid) => {
                    const productDeliveries = cancelReversalModal.deliveries.filter((d) => d.product_id === pid);
                    const productName = productDeliveries[0]?.product_name || "Unknown";
                    const originalTotal = productDeliveries.reduce((s, d) => s + d.original_qty, 0);
                    const allocMap = cancelReversalModal.allocation[pid] || {};
                    const returnTotal = Object.values(allocMap).reduce((s, v) => s + (parseInt(v) || 0), 0);
                    const overReturn = returnTotal > originalTotal;
                    const underReturn = returnTotal < originalTotal;

                    return (
                      <div key={pid} className="mb-4 p-4" style={{ border: "1px solid var(--mc-border)", background: "var(--mc-surface-elevated)" }}>
                        <div className="flex items-baseline justify-between mb-3">
                          <p className="text-xs font-semibold" style={{ color: "var(--mc-text-primary)" }}>{productName}</p>
                          <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>Delivered: {originalTotal} cases</p>
                        </div>
                        <table className="table-fixed w-full mb-2">
                          <colgroup>
                            <col style={{ width: "55%" }} />
                            <col style={{ width: "45%" }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th className="text-left text-[10px] font-medium pb-1.5" style={{ color: "var(--mc-text-muted)" }}>Location</th>
                              <th className="text-right text-[10px] font-medium pb-1.5" style={{ color: "var(--mc-text-muted)" }}>Return (cases)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cancelReversalModal.allDistributors.map((dist) => {
                              const inputVal = allocMap[dist.id] ?? "0";
                              const originalForDist = productDeliveries.find((d) => d.distributor_id === dist.id)?.original_qty ?? 0;
                              return (
                                <tr key={dist.id}>
                                  <td className="text-[11px] py-1" style={{ color: "var(--mc-text-secondary)" }}>
                                    {dist.name}
                                    {originalForDist > 0 && (
                                      <span className="ml-1.5 text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                                        (sent {originalForDist}cs)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1 text-right">
                                    <input
                                      type="number"
                                      min={0}
                                      value={inputVal}
                                      onChange={(e) => setCancelReversalModal((prev) => {
                                        if (!prev) return prev;
                                        return {
                                          ...prev,
                                          allocation: {
                                            ...prev.allocation,
                                            [pid]: {
                                              ...(prev.allocation[pid] || {}),
                                              [dist.id]: e.target.value,
                                            },
                                          },
                                        };
                                      })}
                                      className="mc-input w-16 text-center"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                            <tr style={{ borderTop: "1px solid var(--mc-border)" }}>
                              <td className="text-[11px] pt-1.5 font-medium" style={{ color: "var(--mc-text-muted)" }}>Total</td>
                              <td className="text-[11px] pt-1.5 text-right font-semibold" style={{ color: overReturn || underReturn ? "var(--mc-error)" : "var(--mc-success)" }}>
                                {returnTotal} / {originalTotal}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        {overReturn && (
                          <p className="text-[10px] font-medium" style={{ color: "var(--mc-error)" }}>
                            Over by {returnTotal - originalTotal} case{returnTotal - originalTotal !== 1 ? "s" : ""} — cannot return more than were delivered
                          </p>
                        )}
                        {underReturn && (
                          <p className="text-[10px] font-medium" style={{ color: "var(--mc-error)" }}>
                            {originalTotal - returnTotal} case{originalTotal - returnTotal !== 1 ? "s" : ""} still need{originalTotal - returnTotal === 1 ? "s" : ""} to go somewhere — adjust the numbers above before confirming
                          </p>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={handleCancelReversal}
                      disabled={cancelReversalModal.submitting || hasOverReturn || hasUnderReturn}
                      className="mc-btn mc-btn-danger"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {cancelReversalModal.submitting ? "Cancelling..." : "Confirm Cancellation"}
                    </button>
                    <button
                      onClick={() => setCancelReversalModal(null)}
                      disabled={cancelReversalModal.submitting}
                      className="mc-btn mc-btn-ghost"
                    >
                      Close
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
