"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@mecanova/shared";
import type { ActiveOrderStatus } from "@mecanova/shared";
import {
  Truck,
  Plus,
  ArrowRight,
} from "lucide-react";

interface OrderRow {
  id: string;
  status: string;
  created_at: string;
  item_count: number;
}

const STATUS_COLOR_MAP: Record<string, string> = {
  info: "var(--mc-info)",
  warning: "var(--mc-warning)",
  success: "var(--mc-success)",
  error: "var(--mc-error)",
};

const STATUS_BG_MAP: Record<string, string> = {
  info: "var(--mc-info-bg)",
  warning: "var(--mc-warning-bg)",
  success: "var(--mc-success-bg)",
  error: "var(--mc-error-bg)",
};

const STATUS_BORDER_MAP: Record<string, string> = {
  info: "var(--mc-info-light)",
  warning: "var(--mc-warning-light)",
  success: "var(--mc-success-light)",
  error: "var(--mc-error-light)",
};

export default function SupplyOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const loadOrders = useCallback(async () => {
    setLoading(true);

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

    const myPartnerId = profile.partner_id;
    if (!myPartnerId) {
      router.push("/orders");
      return;
    }

    // Get all orders where I am the client (buyer) — these are my supply orders
    const { data: allOrders } = await supabase
      .from("order_requests")
      .select("*")
      .eq("client_id", myPartnerId)
      .order("created_at", { ascending: false });

    if (!allOrders) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const orderIds = allOrders.map((o) => o.id);
    let itemCountMap = new Map<string, number>();
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from("order_request_items")
        .select("order_request_id")
        .in("order_request_id", orderIds);
      for (const item of items || []) {
        itemCountMap.set(item.order_request_id, (itemCountMap.get(item.order_request_id) || 0) + 1);
      }
    }

    setOrders(
      allOrders.map((o) => ({
        id: o.id,
        status: o.status,
        created_at: o.created_at,
        item_count: itemCountMap.get(o.id) || 0,
      }))
    );
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-48 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="mc-skeleton h-14" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Supply Orders"
        description={`${orders.length} orders to Mecanova`}
        icon={Truck}
        actions={
          <Link href="/supply-orders/new" className="mc-btn mc-btn-primary">
            <Plus className="w-3.5 h-3.5" />
            New Supply Order
          </Link>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No supply orders yet"
          description="Order products directly from Mecanova to restock your inventory"
          action={
            <Link href="/supply-orders/new" className="mc-btn mc-btn-primary">
              <Plus className="w-3.5 h-3.5" />
              Create Supply Order
            </Link>
          }
        />
      ) : (
        <div className="mc-card overflow-hidden">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Items</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const statusKey = order.status as ActiveOrderStatus;
                const colorKey = ORDER_STATUS_COLORS[statusKey] || "info";
                return (
                  <tr key={order.id}>
                    <td>
                      <span className="text-xs font-mono" style={{ color: "var(--mc-text-secondary)" }}>
                        {order.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td>
                      <span
                        className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                        style={{
                          background: STATUS_BG_MAP[colorKey],
                          border: `1px solid ${STATUS_BORDER_MAP[colorKey]}`,
                          color: STATUS_COLOR_MAP[colorKey],
                        }}
                      >
                        {ORDER_STATUS_LABELS[statusKey] || order.status}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                        {order.item_count} items
                      </span>
                    </td>
                    <td>
                      <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                        {new Date(order.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/supply-orders/${order.id}`}
                        className="inline-flex items-center gap-1 text-[11px] transition-colors"
                        style={{ color: "var(--mc-cream-subtle)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
