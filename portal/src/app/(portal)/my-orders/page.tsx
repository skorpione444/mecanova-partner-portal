"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/orders/StatusBadge";
import { Plus, ShoppingCart, ArrowRight } from "lucide-react";

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  distributor_id: string;
  distributor_name: string;
  items_count: number;
}

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
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

      if (profile.role !== "client" && profile.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      let query = supabase
        .from("order_requests")
        .select("id, created_at, status, distributor_id")
        .order("created_at", { ascending: false });

      if (profile.role === "client" && profile.partner_id) {
        query = query.eq("client_id", profile.partner_id);
      }

      const { data: ordersData, error: ordersErr } = await query;

      if (ordersErr) {
        setError("Failed to load orders.");
        setLoading(false);
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const distIds = [
        ...new Set(
          ordersData
            .map((o) => o.distributor_id)
            .filter((id): id is string => id !== null)
        ),
      ];
      const distMap = new Map<string, string>();

      if (distIds.length > 0) {
        const { data: partners } = await supabase
          .from("partners")
          .select("id, name")
          .in("id", distIds);

        partners?.forEach((p) => distMap.set(p.id, p.name));
      }

      const orderIds = ordersData.map((o) => o.id);
      const { data: itemsData } = await supabase
        .from("order_request_items")
        .select("order_request_id")
        .in("order_request_id", orderIds);

      const countMap = new Map<string, number>();
      itemsData?.forEach((i) => {
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
          distributor_id: o.distributor_id ?? "",
          distributor_name:
            (o.distributor_id && distMap.get(o.distributor_id)) ||
            o.distributor_id ||
            "—",
          items_count: countMap.get(o.id) || 0,
        }))
      );
      setLoading(false);
    };

    load();
  }, [supabase, router]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="mc-skeleton h-8 w-36 mb-3" />
            <div className="mc-skeleton h-5 w-48" />
          </div>
          <div className="mc-skeleton h-10 w-32" />
        </div>
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
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{
              fontFamily: "var(--font-jost), sans-serif",
              color: "var(--mc-text-primary)",
            }}
          >
            My Orders
          </h1>
          <p
            className="mt-2 text-sm"
            style={{
              color: "var(--mc-text-tertiary)",
              fontFamily: "var(--font-manrope), sans-serif",
            }}
          >
            Track your order requests
          </p>
        </div>
        <Link href="/orders/new" className="mc-btn mc-btn-amber gap-2">
          <Plus className="w-4 h-4" strokeWidth={2} />
          New Order
        </Link>
      </div>

      {/* Error */}
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

      {/* Content */}
      {orders.length === 0 ? (
        <div className="mc-card p-16 text-center">
          <ShoppingCart
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
            No orders yet
          </p>
          <p className="text-sm mb-6" style={{ color: "var(--mc-text-muted)" }}>
            Submit your first order request to get started
          </p>
          <Link href="/orders/new" className="mc-btn mc-btn-amber gap-2 inline-flex">
            <Plus className="w-4 h-4" strokeWidth={2} />
            Create Your First Order
          </Link>
        </div>
      ) : (
        <div className="mc-card overflow-hidden">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Distributor</th>
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
                        fontFamily:
                          "var(--font-jetbrains), monospace",
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
                      {order.distributor_name}
                    </span>
                  </td>
                  <td>
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--mc-text-secondary)",
                        fontFamily:
                          "var(--font-jetbrains), monospace",
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
                      href={`/my-orders/${order.id}`}
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
