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
} from "lucide-react";

interface OrderDetail extends OrderRequest {
  partner_name: string;
  client_name: string | null;
  distributor_name: string | null;
  items: (OrderRequestItem & { product_name: string })[];
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [overriding, setOverriding] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "">("");
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

    setOrder({
      ...orderData,
      partner_name: nameMap.get(orderData.partner_id) || "Unknown",
      client_name: orderData.client_id
        ? nameMap.get(orderData.client_id) || null
        : null,
      distributor_name: orderData.distributor_id
        ? nameMap.get(orderData.distributor_id) || null
        : null,
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

    // Set the corresponding timestamp
    if (selectedStatus === "submitted") updateData.submitted_at = now;
    if (selectedStatus === "accepted") updateData.accepted_at = now;
    if (selectedStatus === "rejected") updateData.rejected_at = now;
    if (selectedStatus === "fulfilled") updateData.fulfilled_at = now;
    if (selectedStatus === "cancelled") updateData.cancelled_at = now;

    await supabase.from("order_requests").update(updateData).eq("id", id);
    await load();
    setOverriding(false);
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
        href="/orders"
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
        Back to Orders
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
                  <p className="mc-label">Distributor</p>
                  <p className="text-sm">
                    {order.distributor_name || (
                      <span style={{ color: "var(--mc-text-muted)" }}>—</span>
                    )}
                  </p>
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
              {order.notes && (
                <div className="flex items-start gap-2 col-span-2">
                  <MessageSquare
                    className="w-3.5 h-3.5 mt-0.5"
                    style={{ color: "var(--mc-text-muted)" }}
                  />
                  <div>
                    <p className="mc-label">Notes</p>
                    <p className="text-sm">{order.notes}</p>
                  </div>
                </div>
              )}
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
    </div>
  );
}

