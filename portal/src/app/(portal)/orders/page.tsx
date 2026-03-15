"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Link from "next/link";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@mecanova/shared";
import type { ActiveOrderStatus, UserRole } from "@mecanova/shared";
import {
  ShoppingCart,
  Plus,
  ArrowRight,
  Truck,
} from "lucide-react";

interface OrderRow {
  id: string;
  status: string;
  created_at: string;
  counterpart_name: string | null;
  item_count: number;
}

interface SupplyOrderRow {
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [tab, setTab] = useState<"client" | "buy">("client");
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

    if (!profile) return;
    const userRole = profile.role as UserRole;
    const myPartnerId = profile.partner_id;
    setRole(userRole);

    const { data: allOrders } = await supabase
      .from("order_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (!allOrders) {
      setOrders([]);
      setSupplyOrders([]);
      setLoading(false);
      return;
    }

    // For distributors viewing "Orders" page, filter out supply orders
    // (where they are the client ordering from Mecanova)
    const filteredOrders = userRole === "distributor"
      ? allOrders.filter((o) => o.distributor_id === myPartnerId)
      : allOrders;

    // Supply orders: orders where distributor is the client (buying from Mecanova)
    const supplyOrdersList = userRole === "distributor" && myPartnerId
      ? allOrders.filter((o) => o.client_id === myPartnerId)
      : [];

    // Resolve counterpart names:
    // - Clients see the distributor name
    // - Distributors see the client name
    const counterpartIds = [
      ...new Set(
        filteredOrders
          .map((o) => (userRole === "distributor" ? o.client_id : o.distributor_id))
          .filter(Boolean)
      ),
    ] as string[];

    let nameMap = new Map<string, string>();
    if (counterpartIds.length > 0) {
      const { data: partners } = await supabase
        .from("partners")
        .select("id, name")
        .in("id", counterpartIds);
      nameMap = new Map((partners || []).map((p) => [p.id, p.name]));
    }

    // Get item counts for all orders (client orders + supply orders)
    const allOrderIds = [
      ...filteredOrders.map((o) => o.id),
      ...supplyOrdersList.map((o) => o.id),
    ];
    let itemCountMap = new Map<string, number>();
    if (allOrderIds.length > 0) {
      const { data: items } = await supabase
        .from("order_request_items")
        .select("order_request_id")
        .in("order_request_id", allOrderIds);
      for (const item of items || []) {
        itemCountMap.set(item.order_request_id, (itemCountMap.get(item.order_request_id) || 0) + 1);
      }
    }

    setOrders(
      filteredOrders.map((o) => {
        const counterpartId = userRole === "distributor" ? o.client_id : o.distributor_id;
        return {
          id: o.id,
          status: o.status,
          created_at: o.created_at,
          counterpart_name: counterpartId ? nameMap.get(counterpartId) || null : null,
          item_count: itemCountMap.get(o.id) || 0,
        };
      })
    );

    setSupplyOrders(
      supplyOrdersList.map((o) => ({
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

  const isDistributor = role === "distributor";
  const counterpartLabel = isDistributor ? "Client" : "Distributor";

  const activeOrders = tab === "client" ? orders : supplyOrders;
  const pageTitle = tab === "buy" ? "Buy Products" : (isDistributor ? "Orders Received" : "Orders");
  const pageDescription = tab === "buy"
    ? `${supplyOrders.length} orders from Mecanova`
    : isDistributor
      ? `${orders.length} orders received from clients`
      : `${orders.length} orders`;

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
        title={pageTitle}
        description={pageDescription}
        icon={tab === "buy" ? Truck : ShoppingCart}
        actions={
          tab === "buy" ? (
            <Link href="/supply-orders/new" className="mc-btn mc-btn-primary">
              <Plus className="w-3.5 h-3.5" />
              New Order
            </Link>
          ) : role === "client" ? (
            <Link href="/orders/new" className="mc-btn mc-btn-primary">
              <Plus className="w-3.5 h-3.5" />
              New Order
            </Link>
          ) : undefined
        }
      />

      {isDistributor && (
        <div className="flex mb-5" style={{ border: "1px solid var(--mc-border)" }}>
          <button
            onClick={() => setTab("client")}
            className="px-4 py-1.5 text-[11px] font-medium tracking-wide transition-colors"
            style={{
              background: tab === "client" ? "var(--mc-cream-subtle)" : "transparent",
              color: tab === "client" ? "var(--mc-black)" : "var(--mc-text-muted)",
            }}
          >
            Client Orders
          </button>
          <button
            onClick={() => setTab("buy")}
            className="px-4 py-1.5 text-[11px] font-medium tracking-wide transition-colors"
            style={{
              background: tab === "buy" ? "var(--mc-cream-subtle)" : "transparent",
              color: tab === "buy" ? "var(--mc-black)" : "var(--mc-text-muted)",
            }}
          >
            Buy from Mecanova
          </button>
        </div>
      )}

      {activeOrders.length === 0 ? (
        <EmptyState
          icon={tab === "buy" ? Truck : ShoppingCart}
          title={
            tab === "buy"
              ? "No orders yet"
              : isDistributor
                ? "No orders received yet"
                : "No orders yet"
          }
          description={
            tab === "buy"
              ? "Order products directly from Mecanova to restock your inventory"
              : isDistributor
                ? "Orders from your clients will appear here"
                : "Your orders will appear here"
          }
          action={
            tab === "buy" ? (
              <Link href="/supply-orders/new" className="mc-btn mc-btn-primary">
                <Plus className="w-3.5 h-3.5" />
                Create Order
              </Link>
            ) : role === "client" ? (
              <Link href="/orders/new" className="mc-btn mc-btn-primary">
                <Plus className="w-3.5 h-3.5" />
                Create Order
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="mc-card overflow-hidden">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                {tab === "client" && <th>{counterpartLabel}</th>}
                <th>Items</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.map((order) => {
                const statusKey = order.status as ActiveOrderStatus;
                const colorKey = ORDER_STATUS_COLORS[statusKey] || "info";
                const isSupply = tab === "buy";
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
                    {tab === "client" && (
                      <td>
                        <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
                          {(order as OrderRow).counterpart_name || "—"}
                        </span>
                      </td>
                    )}
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
                        href={isSupply ? `/supply-orders/${order.id}` : `/orders/${order.id}`}
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
