"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import type { OrderRequest } from "@mecanova/shared";
import {
  Users,
  Package,
  ClipboardList,
  Warehouse,
  FileText,
  Truck,
  DollarSign,
  Contact,
  Scale,
  Settings,
  BarChart3,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

interface DashboardData {
  partnerCount: number;
  distributorCount: number;
  clientCount: number;
  supplierCount: number;
  productCount: number;
  activeOrderCount: number;
  lowStockCount: number;
  recentOrders: (OrderRequest & { partner_name?: string })[];
}

const MODULE_CARDS = [
  {
    href: "/kpis",
    label: "KPIs",
    desc: "Runway, pipeline & unit economics",
    icon: BarChart3,
  },
  {
    href: "/partners",
    label: "Partners",
    desc: "Distributors, buyers & suppliers",
    icon: Users,
  },
  {
    href: "/products",
    label: "Products",
    desc: "Catalogue & assets",
    icon: Package,
  },
  {
    href: "/orders",
    label: "Orders",
    desc: "All orders across partners",
    icon: ClipboardList,
  },
  {
    href: "/inventory",
    label: "Inventory",
    desc: "Stock levels & movements",
    icon: Warehouse,
  },
  {
    href: "/documents",
    label: "Documents",
    desc: "Compliance & files",
    icon: FileText,
  },
  {
    href: "/logistics",
    label: "Logistics",
    desc: "Shipping & customs",
    icon: Truck,
  },
  {
    href: "/finance",
    label: "Finance",
    desc: "Invoices & payments",
    icon: DollarSign,
  },
  {
    href: "/crm",
    label: "CRM",
    desc: "Contacts & relationships",
    icon: Contact,
  },
  {
    href: "/contracts",
    label: "Contracts",
    desc: "Legal agreements",
    icon: Scale,
  },
  {
    href: "/settings",
    label: "Settings",
    desc: "System configuration",
    icon: Settings,
  },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      // Fetch counts in parallel
      const [
        partnersRes,
        productsRes,
        activeOrdersRes,
        lowStockRes,
        recentOrdersRes,
      ] = await Promise.all([
        supabase.from("partners").select("id, partner_type"),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("active", true),
        supabase
          .from("order_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["submitted", "accepted", "created"]),
        supabase
          .from("inventory_status")
          .select("product_id", { count: "exact", head: true })
          .in("status", ["out"]),
        supabase
          .from("order_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const partners = partnersRes.data || [];
      const distributors = partners.filter(
        (p) => p.partner_type === "distributor"
      );
      const clients = partners.filter((p) => p.partner_type === "client");
      const suppliers = partners.filter((p) => p.partner_type === "supplier");

      // Get partner names for recent orders
      const recentOrders = recentOrdersRes.data || [];
      let enrichedOrders: (OrderRequest & { partner_name?: string })[] =
        recentOrders;

      if (recentOrders.length > 0) {
        const partnerIds = [
          ...new Set(recentOrders.map((o) => o.partner_id)),
        ];
        const { data: partnerNames } = await supabase
          .from("partners")
          .select("id, name")
          .in("id", partnerIds);

        const nameMap = new Map(
          (partnerNames || []).map((p) => [p.id, p.name])
        );
        enrichedOrders = recentOrders.map((o) => ({
          ...o,
          partner_name: nameMap.get(o.partner_id) || "Unknown",
        }));
      }

      setData({
        partnerCount: partners.length,
        distributorCount: distributors.length,
        clientCount: clients.length,
        supplierCount: suppliers.length,
        productCount: productsRes.count || 0,
        activeOrderCount: activeOrdersRes.count || 0,
        lowStockCount: lowStockRes.count || 0,
        recentOrders: enrichedOrders,
      });
      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <div className="mc-skeleton h-6 w-48 mb-2" />
          <div className="mc-skeleton h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="mc-skeleton h-24" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="mc-skeleton h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-lg font-medium mb-1"
          style={{
            fontFamily: "var(--font-jost), Jost, sans-serif",
            color: "var(--mc-text-primary)",
          }}
        >
          Dashboard
        </h1>
        <p className="text-xs" style={{ color: "var(--mc-text-tertiary)" }}>
          Overview of Mecanova operations
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 mc-stagger">
        <StatCard
          label="Total Partners"
          value={data?.partnerCount || 0}
          icon={Users}
          trend={`${data?.distributorCount || 0} distributors, ${data?.clientCount || 0} buyers, ${data?.supplierCount || 0} suppliers`}
        />
        <StatCard
          label="Active Products"
          value={data?.productCount || 0}
          icon={Package}
          color="info"
        />
        <StatCard
          label="Active Orders"
          value={data?.activeOrderCount || 0}
          icon={ClipboardList}
          color="warning"
        />
        <StatCard
          label="Low Stock Alerts"
          value={data?.lowStockCount || 0}
          icon={AlertTriangle}
          color={data?.lowStockCount ? "error" : "success"}
          trend={
            data?.lowStockCount
              ? "Items need attention"
              : "All stock levels healthy"
          }
        />
      </div>

      {/* Recent Orders */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-sm font-medium"
            style={{
              fontFamily: "var(--font-jost), Jost, sans-serif",
              color: "var(--mc-text-primary)",
            }}
          >
            Recent Orders
          </h2>
          <Link
            href="/orders"
            className="flex items-center gap-1 text-[11px] tracking-wide transition-colors"
            style={{ color: "var(--mc-cream-subtle)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--mc-cream)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--mc-cream-subtle)")
            }
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {data?.recentOrders.length === 0 ? (
          <div
            className="mc-card p-6 text-center text-xs"
            style={{ color: "var(--mc-text-muted)" }}
          >
            No orders yet
          </div>
        ) : (
          <div className="mc-card overflow-hidden">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Partner</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link
                        href={`/orders/${order.id}`}
                        className="transition-colors"
                        style={{ color: "var(--mc-cream-muted)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "var(--mc-cream)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color =
                            "var(--mc-cream-muted)")
                        }
                      >
                        {order.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td>{order.partner_name}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>
                      {new Date(order.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Module Quick Links */}
      <div>
        <h2
          className="text-sm font-medium mb-3"
          style={{
            fontFamily: "var(--font-jost), Jost, sans-serif",
            color: "var(--mc-text-primary)",
          }}
        >
          Modules
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mc-stagger">
          {MODULE_CARDS.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="mc-card mc-card-interactive p-4 group"
              >
                <Icon
                  className="w-5 h-5 mb-2"
                  style={{ color: "var(--mc-cream-subtle)" }}
                  strokeWidth={1.5}
                />
                <p
                  className="text-xs font-medium mb-0.5"
                  style={{ color: "var(--mc-text-primary)" }}
                >
                  {mod.label}
                </p>
                <p
                  className="text-[10px]"
                  style={{ color: "var(--mc-text-muted)" }}
                >
                  {mod.desc}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

