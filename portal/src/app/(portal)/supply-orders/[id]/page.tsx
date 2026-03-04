"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Timeline from "@/components/orders/Timeline";
import StatusBadge from "@/components/orders/StatusBadge";
import { ORDER_STATUS_LABELS } from "@mecanova/shared";
import type { ActiveOrderStatus } from "@mecanova/shared";
import { Truck, ArrowLeft } from "lucide-react";

interface OrderDetail {
  id: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  items: { product_name: string; cases_qty: number }[];
}

export default function SupplyOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadOrder = useCallback(async () => {
    const { data: o } = await supabase
      .from("order_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (!o) { setLoading(false); return; }

    const { data: items } = await supabase
      .from("order_request_items")
      .select("product_id, cases_qty")
      .eq("order_request_id", id);

    const productIds = (items || []).map((i) => i.product_id);
    let productMap = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: prods } = await supabase.from("products").select("id, name").in("id", productIds);
      productMap = new Map((prods || []).map((p) => [p.id, p.name]));
    }

    setOrder({
      id: o.id,
      status: o.status,
      created_at: o.created_at,
      submitted_at: o.submitted_at,
      accepted_at: o.accepted_at,
      rejected_at: o.rejected_at,
      fulfilled_at: o.fulfilled_at,
      cancelled_at: o.cancelled_at,
      notes: o.notes,
      items: (items || []).map((i) => ({
        product_name: productMap.get(i.product_id) || "Unknown",
        cases_qty: i.cases_qty,
      })),
    });
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-6 w-48 mb-6" />
        <div className="mc-skeleton h-64 max-w-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <Link href="/supply-orders" className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4" style={{ color: "var(--mc-text-muted)" }}>
          <ArrowLeft className="w-3 h-3" /> Back to Supply Orders
        </Link>
        <p className="text-sm" style={{ color: "var(--mc-text-muted)" }}>Order not found.</p>
      </div>
    );
  }

  const timelineEvents = [
    { label: "Created", date: order.created_at },
    { label: "Submitted", date: order.submitted_at },
    { label: "Accepted", date: order.accepted_at },
    { label: "Rejected", date: order.rejected_at },
    { label: "Fulfilled", date: order.fulfilled_at },
    { label: "Cancelled", date: order.cancelled_at },
  ];

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

      <PageHeader
        title={`Supply Order ${order.id.slice(0, 8)}...`}
        description="Supplier: Mecanova"
        icon={Truck}
        actions={<StatusBadge status={order.status} />}
      />

      <div className="max-w-2xl space-y-5">
        {/* Timeline */}
        <div className="mc-card p-5">
          <h3 className="text-xs font-semibold tracking-[0.08em] uppercase mb-3" style={{ color: "var(--mc-text-muted)" }}>
            Timeline
          </h3>
          <Timeline events={timelineEvents} />
        </div>

        {/* Details */}
        <div className="mc-card p-5">
          <h3 className="text-xs font-semibold tracking-[0.08em] uppercase mb-3" style={{ color: "var(--mc-text-muted)" }}>
            Details
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span style={{ color: "var(--mc-text-muted)" }}>Status</span>
              <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                {ORDER_STATUS_LABELS[order.status as ActiveOrderStatus] || order.status}
              </p>
            </div>
            <div>
              <span style={{ color: "var(--mc-text-muted)" }}>Supplier</span>
              <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>Mecanova</p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="mc-card p-5">
          <h3 className="text-xs font-semibold tracking-[0.08em] uppercase mb-3" style={{ color: "var(--mc-text-muted)" }}>
            Items ({order.items.length})
          </h3>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2"
                style={{ background: "var(--mc-surface-warm)", border: "1px solid var(--mc-border-light)" }}
              >
                <span className="text-xs font-medium" style={{ color: "var(--mc-text-primary)" }}>
                  {item.product_name}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--mc-text-muted)" }}>
                  {item.cases_qty} {item.cases_qty === 1 ? "case" : "cases"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mc-card p-5">
            <h3 className="text-xs font-semibold tracking-[0.08em] uppercase mb-3" style={{ color: "var(--mc-text-muted)" }}>
              Notes
            </h3>
            <p className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
