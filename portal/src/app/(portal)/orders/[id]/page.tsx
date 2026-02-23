"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@mecanova/shared";
import type { ActiveOrderStatus } from "@mecanova/shared";
import { ShoppingCart, ArrowLeft } from "lucide-react";

interface OrderDetail {
  id: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
  accepted_at: string | null;
  notes: string | null;
  distributor_name: string | null;
  items: { product_name: string; cases_qty: number }[];
}

const STATUS_COLOR_MAP: Record<string, string> = {
  info: "var(--mc-info)", warning: "var(--mc-warning)", success: "var(--mc-success)", error: "var(--mc-error)",
};
const STATUS_BG_MAP: Record<string, string> = {
  info: "var(--mc-info-bg)", warning: "var(--mc-warning-bg)", success: "var(--mc-success-bg)", error: "var(--mc-error-bg)",
};
const STATUS_BORDER_MAP: Record<string, string> = {
  info: "var(--mc-info-light)", warning: "var(--mc-warning-light)", success: "var(--mc-success-light)", error: "var(--mc-error-light)",
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: o } = await supabase
        .from("order_requests")
        .select("*")
        .eq("id", id)
        .single();

      if (!o) { setLoading(false); return; }

      let distributor_name: string | null = null;
      if (o.distributor_id) {
        const { data: d } = await supabase.from("partners").select("name").eq("id", o.distributor_id).single();
        distributor_name = d?.name || null;
      }

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
        notes: o.notes,
        distributor_name,
        items: (items || []).map((i) => ({
          product_name: productMap.get(i.product_id) || "Unknown",
          cases_qty: i.cases_qty,
        })),
      });
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
        <Link href="/orders" className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4" style={{ color: "var(--mc-text-muted)" }}>
          <ArrowLeft className="w-3 h-3" /> Back to Orders
        </Link>
        <p className="text-sm" style={{ color: "var(--mc-text-muted)" }}>Order not found.</p>
      </div>
    );
  }

  const statusKey = order.status as ActiveOrderStatus;
  const colorKey = ORDER_STATUS_COLORS[statusKey] || "info";

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

      <PageHeader
        title={`Order ${order.id.slice(0, 8)}...`}
        description={order.distributor_name ? `Distributor: ${order.distributor_name}` : undefined}
        icon={ShoppingCart}
        actions={
          <span
            className="inline-flex px-3 py-1 text-[10px] font-medium tracking-wide uppercase"
            style={{
              background: STATUS_BG_MAP[colorKey],
              border: `1px solid ${STATUS_BORDER_MAP[colorKey]}`,
              color: STATUS_COLOR_MAP[colorKey],
            }}
          >
            {ORDER_STATUS_LABELS[statusKey] || order.status}
          </span>
        }
      />

      <div className="max-w-2xl space-y-5">
        <div className="mc-card p-5">
          <h3 className="text-xs font-semibold tracking-[0.08em] uppercase mb-3" style={{ color: "var(--mc-text-muted)" }}>
            Timeline
          </h3>
          <div className="space-y-2 text-xs" style={{ color: "var(--mc-text-secondary)" }}>
            <p>Created: {new Date(order.created_at).toLocaleString("en-GB")}</p>
            {order.submitted_at && <p>Submitted: {new Date(order.submitted_at).toLocaleString("en-GB")}</p>}
            {order.accepted_at && <p>Accepted: {new Date(order.accepted_at).toLocaleString("en-GB")}</p>}
          </div>
        </div>

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
