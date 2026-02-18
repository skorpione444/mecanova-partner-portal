"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import type { OrderRequest } from "@mecanova/shared";
import { ACTIVE_ORDER_STATUSES } from "@mecanova/shared";
import { ClipboardList, Search, ArrowRight } from "lucide-react";

type OrderRow = OrderRequest & {
  partner_name: string;
  client_name: string | null;
  distributor_name: string | null;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const supabase = createClient();

  const loadOrders = useCallback(async () => {
    setLoading(true);

    const { data: ordersData } = await supabase
      .from("order_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (!ordersData || ordersData.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    // Collect all partner IDs
    const allIds = new Set<string>();
    ordersData.forEach((o) => {
      allIds.add(o.partner_id);
      if (o.client_id) allIds.add(o.client_id);
      if (o.distributor_id) allIds.add(o.distributor_id);
    });

    const { data: partners } = await supabase
      .from("partners")
      .select("id, name")
      .in("id", [...allIds]);

    const nameMap = new Map(
      (partners || []).map((p) => [p.id, p.name])
    );

    const enriched: OrderRow[] = ordersData.map((o) => ({
      ...o,
      partner_name: nameMap.get(o.partner_id) || "Unknown",
      client_name: o.client_id ? nameMap.get(o.client_id) || null : null,
      distributor_name: o.distributor_id
        ? nameMap.get(o.distributor_id) || null
        : null,
    }));

    setOrders(enriched);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filtered = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.partner_name.toLowerCase().includes(search.toLowerCase()) ||
      (o.client_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.distributor_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-48 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="mc-skeleton h-14" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        description={`${orders.length} total orders`}
        icon={ClipboardList}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: "var(--mc-text-muted)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mc-input pl-9"
            placeholder="Search by ID or partner..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="mc-input mc-select w-auto min-w-[150px]"
        >
          <option value="all">All Statuses</option>
          {ACTIVE_ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No orders found"
          description={
            search || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "No orders have been placed yet"
          }
        />
      ) : (
        <div className="mc-card overflow-hidden">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Partner</th>
                <th>Client</th>
                <th>Distributor</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span
                      className="text-xs font-mono"
                      style={{ color: "var(--mc-text-secondary)" }}
                    >
                      {order.id.slice(0, 8)}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs">{order.partner_name}</span>
                  </td>
                  <td>
                    <span
                      className="text-xs"
                      style={{ color: "var(--mc-text-muted)" }}
                    >
                      {order.client_name || "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      className="text-xs"
                      style={{ color: "var(--mc-text-muted)" }}
                    >
                      {order.distributor_name || "—"}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>
                    <span className="text-xs">
                      {new Date(order.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/orders/${order.id}`}
                      className="inline-flex items-center gap-1 text-[11px] transition-colors"
                      style={{ color: "var(--mc-cream-subtle)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--mc-cream)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color =
                          "var(--mc-cream-subtle)")
                      }
                    >
                      View <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

