"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/orders/StatusBadge";
import { Inbox, CheckCircle2, History, ClipboardList, ArrowRight } from "lucide-react";

type FilterTab = "incoming" | "accepted" | "history";

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  client_id: string;
  client_name: string;
  items_count: number;
}

const TAB_CONFIG: {
  key: FilterTab;
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "incoming", label: "Incoming", icon: Inbox },
  { key: "accepted", label: "Accepted", icon: CheckCircle2 },
  { key: "history", label: "History", icon: History },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [tab, setTab] = useState<FilterTab>("incoming");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

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

      if (!profile) {
        setError("Profile not found.");
        setLoading(false);
        return;
      }

      if (profile.role !== "distributor" && profile.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      let query = supabase
        .from("order_requests")
        .select("id, created_at, status, client_id")
        .order("created_at", { ascending: false });

      if (tab === "incoming") {
        query = query.eq("status", "submitted");
      } else if (tab === "accepted") {
        query = query.eq("status", "accepted");
      } else {
        query = query.in("status", ["fulfilled", "rejected", "cancelled"]);
      }

      if (profile.role === "distributor" && profile.partner_id) {
        query = query.eq("distributor_id", profile.partner_id);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) {
        setError("Failed to load orders.");
        setLoading(false);
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const clientIds = [
        ...new Set(
          ordersData
            .map((o) => o.client_id)
            .filter((id): id is string => id !== null)
        ),
      ];
      const clientMap = new Map<string, string>();

      if (clientIds.length > 0) {
        const { data: partners } = await supabase
          .from("partners")
          .select("id, name")
          .in("id", clientIds);

        partners?.forEach((p) => clientMap.set(p.id, p.name));
      }

      const orderIds = ordersData.map((o) => o.id);
      const { data: items } = await supabase
        .from("order_request_items")
        .select("order_request_id")
        .in("order_request_id", orderIds);

      const countMap = new Map<string, number>();
      items?.forEach((i) => {
        countMap.set(
          i.order_request_id,
          (countMap.get(i.order_request_id) || 0) + 1
        );
      });

      setOrders(
        ordersData.map((o) => ({
          id: o.id,
          created_at: o.created_at,
          status: o.status,
          client_id: o.client_id ?? "",
          client_name:
            (o.client_id && clientMap.get(o.client_id)) ||
            o.client_id ||
            "—",
          items_count: countMap.get(o.id) || 0,
        }))
      );
      setLoading(false);
    };

    load();
  }, [tab, supabase, router]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const emptyMsg =
    tab === "incoming"
      ? "No incoming orders at the moment"
      : tab === "accepted"
      ? "No accepted orders right now"
      : "No order history yet";

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
          Orders
        </h1>
        <p
          className="mt-2 text-sm"
          style={{
            color: "var(--mc-text-tertiary)",
            fontFamily: "var(--font-manrope), sans-serif",
          }}
        >
          Review and manage order requests from buyers
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 w-fit"
        style={{ background: "var(--mc-secondary)" }}
      >
        {TAB_CONFIG.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200"
              style={{
                background: active ? "var(--mc-card)" : "transparent",
                color: active ? "var(--mc-text-primary)" : "var(--mc-text-tertiary)",
                boxShadow: active ? "var(--mc-shadow-sm)" : "none",
                fontFamily: "var(--font-manrope), sans-serif",
              }}
            >
              <Icon className="w-4 h-4" strokeWidth={active ? 2 : 1.5} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div
          className="mc-card p-4 flex items-center gap-3"
          style={{
            background: "var(--mc-error-bg)",
            borderColor: "var(--mc-error)",
            color: "var(--mc-error)",
          }}
        >
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="mc-card overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-6 py-4"
              style={{ borderBottom: "1px solid var(--mc-border)" }}
            >
              <div className="flex-1">
                <div className="mc-skeleton h-4 w-32 mb-2" />
                <div className="mc-skeleton h-3 w-48" />
              </div>
              <div className="mc-skeleton h-6 w-20" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="mc-card p-16 text-center">
          <ClipboardList
            className="w-10 h-10 mx-auto mb-4"
            style={{ color: "var(--mc-text-muted)" }}
            strokeWidth={1}
          />
          <p
            className="text-base font-medium mb-1"
            style={{
              color: "var(--mc-text-secondary)",
              fontFamily: "var(--font-jost), sans-serif",
            }}
          >
            {emptyMsg}
          </p>
          <p className="text-sm" style={{ color: "var(--mc-text-muted)" }}>
            Orders will appear here when buyers submit requests
          </p>
        </div>
      ) : (
        <div className="mc-card overflow-hidden">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Items</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="group">
                  <td>
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--mc-text-secondary)",
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: "0.8125rem",
                      }}
                    >
                      {formatDate(order.created_at)}
                    </span>
                  </td>
                  <td>
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--mc-text-primary)" }}
                    >
                      {order.client_name}
                    </span>
                  </td>
                  <td>
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--mc-text-secondary)",
                        fontFamily: "var(--font-jetbrains), monospace",
                      }}
                    >
                      {order.items_count}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/orders/${order.id}`}
                      className="mc-btn mc-btn-ghost py-1.5 px-3 text-xs gap-1.5 inline-flex"
                    >
                      View
                      <ArrowRight className="w-3 h-3" strokeWidth={2} />
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
