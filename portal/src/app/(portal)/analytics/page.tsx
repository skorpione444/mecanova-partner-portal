"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import type { UserRole } from "@mecanova/shared";
import {
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Check,
  X,
  DollarSign,
  Package,
  Clock,
} from "lucide-react";

interface Analytics {
  totalOrders: number;
  acceptedCount: number;
  rejectedCount: number;
  deliveredCount: number;
  pendingCount: number;
  acceptRate: number;
  rejectRate: number;
  avgOrderSize: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  currency: string;
  topProducts: { name: string; totalCases: number }[];
  ordersByStatus: { status: string; count: number }[];
}

const STATUS_LABEL_MAP: Record<string, string> = {
  created: "Draft",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
  delivered: "Delivered",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

const STATUS_COLOR_MAP: Record<string, string> = {
  created: "var(--mc-text-muted)",
  submitted: "var(--mc-info)",
  accepted: "var(--mc-success)",
  rejected: "var(--mc-error)",
  delivered: "var(--mc-info)",
  fulfilled: "var(--mc-success)",
  cancelled: "var(--mc-text-muted)",
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const supabase = createClient();

  const loadAnalytics = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, partner_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.partner_id) { setLoading(false); return; }
    setRole(profile.role as UserRole);

    const isDistributor = profile.role === "distributor";
    const filterCol = isDistributor ? "distributor_id" : "client_id";

    // Load orders
    const { data: orders } = await supabase
      .from("order_requests")
      .select("id, status, created_at")
      .eq(filterCol, profile.partner_id);

    const relevantOrders = orders || [];

    const totalOrders = relevantOrders.length;
    const nonDraft = relevantOrders.filter(o => o.status !== "created");
    const acceptedCount = relevantOrders.filter(o => ["accepted", "delivered", "fulfilled"].includes(o.status)).length;
    const rejectedCount = relevantOrders.filter(o => o.status === "rejected").length;
    const deliveredCount = relevantOrders.filter(o => ["delivered", "fulfilled"].includes(o.status)).length;
    const pendingCount = relevantOrders.filter(o => o.status === "submitted").length;
    const acceptRate = nonDraft.length > 0 ? Math.round((acceptedCount / nonDraft.length) * 100) : 0;
    const rejectRate = nonDraft.length > 0 ? Math.round((rejectedCount / nonDraft.length) * 100) : 0;

    // Order items for average size and top products
    const orderIds = relevantOrders.map(o => o.id);
    let avgOrderSize = 0;
    let topProducts: { name: string; totalCases: number }[] = [];

    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from("order_request_items")
        .select("order_request_id, product_id, cases_qty")
        .in("order_request_id", orderIds);

      if (items && items.length > 0) {
        const totalCases = items.reduce((sum, i) => sum + i.cases_qty, 0);
        avgOrderSize = Math.round(totalCases / totalOrders);

        // Top products
        const productTotals = new Map<string, number>();
        items.forEach(i => {
          productTotals.set(i.product_id, (productTotals.get(i.product_id) || 0) + i.cases_qty);
        });

        const productIds = [...productTotals.keys()];
        if (productIds.length > 0) {
          const { data: prods } = await supabase
            .from("products")
            .select("id, name")
            .in("id", productIds);
          const prodMap = new Map((prods || []).map(p => [p.id, p.name]));

          topProducts = [...productTotals.entries()]
            .map(([id, total]) => ({ name: prodMap.get(id) || "Unknown", totalCases: total }))
            .sort((a, b) => b.totalCases - a.totalCases)
            .slice(0, 5);
        }
      }
    }

    // Orders by status
    const statusCounts = new Map<string, number>();
    relevantOrders.forEach(o => {
      statusCounts.set(o.status, (statusCounts.get(o.status) || 0) + 1);
    });
    const ordersByStatus = [...statusCounts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // Invoices
    const invoiceCol = isDistributor ? "distributor_id" : "client_id";
    const { data: invoices } = await supabase
      .from("invoices")
      .select("amount, currency, status")
      .eq(invoiceCol, profile.partner_id);

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let currency = "EUR";

    if (invoices && invoices.length > 0) {
      currency = invoices[0].currency || "EUR";
      totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
      totalPaid = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + Number(i.amount), 0);
      totalOutstanding = invoices.filter(i => i.status !== "paid").reduce((sum, i) => sum + Number(i.amount), 0);
    }

    setAnalytics({
      totalOrders,
      acceptedCount,
      rejectedCount,
      deliveredCount,
      pendingCount,
      acceptRate,
      rejectRate,
      avgOrderSize,
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      currency,
      topProducts,
      ordersByStatus,
    });

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const formatCurrency = (amount: number, cur: string) => {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur }).format(amount);
  };

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="mc-skeleton h-24" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="mc-skeleton h-48" />)}
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const isDistributor = role === "distributor";

  return (
    <div>
      <PageHeader
        title="Analytics"
        description={isDistributor ? "Performance overview of your distribution" : "Overview of your ordering activity"}
        icon={BarChart3}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 mc-stagger">
        <div className="mc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
              {isDistributor ? "Orders Received" : "Orders Placed"}
            </span>
          </div>
          <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-text-primary)" }}>
            {analytics.totalOrders}
          </p>
        </div>

        <div className="mc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-4 h-4" style={{ color: "var(--mc-success)" }} strokeWidth={1.5} />
            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
              Accepted Rate
            </span>
          </div>
          <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-success)" }}>
            {analytics.acceptRate}%
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
            {analytics.acceptedCount} of {analytics.totalOrders} orders
          </p>
        </div>

        <div className="mc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <X className="w-4 h-4" style={{ color: analytics.rejectRate > 0 ? "var(--mc-error)" : "var(--mc-text-muted)" }} strokeWidth={1.5} />
            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
              Rejected Rate
            </span>
          </div>
          <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: analytics.rejectRate > 0 ? "var(--mc-error)" : "var(--mc-text-primary)" }}>
            {analytics.rejectRate}%
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
            {analytics.rejectedCount} of {analytics.totalOrders} orders
          </p>
        </div>

        <div className="mc-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
              Avg Order Size
            </span>
          </div>
          <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-text-primary)" }}>
            {analytics.avgOrderSize}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
            cases per order
          </p>
        </div>
      </div>

      {/* Financial + Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Financial Summary */}
        <div className="mc-card p-5">
          <h3 className="text-xs font-semibold tracking-[0.08em] uppercase mb-4" style={{ color: "var(--mc-text-muted)" }}>
            {isDistributor ? "Revenue" : "Billing"}
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} strokeWidth={1.5} />
                <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
                  Total Invoiced
                </span>
              </div>
              <span className="text-sm font-semibold" style={{ color: "var(--mc-text-primary)" }}>
                {formatCurrency(analytics.totalInvoiced, analytics.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: "var(--mc-success)" }} strokeWidth={1.5} />
                <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
                  Paid
                </span>
              </div>
              <span className="text-sm font-semibold" style={{ color: "var(--mc-success)" }}>
                {formatCurrency(analytics.totalPaid, analytics.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: analytics.totalOutstanding > 0 ? "var(--mc-warning)" : "var(--mc-text-muted)" }} strokeWidth={1.5} />
                <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
                  Outstanding
                </span>
              </div>
              <span className="text-sm font-semibold" style={{ color: analytics.totalOutstanding > 0 ? "var(--mc-warning)" : "var(--mc-text-primary)" }}>
                {formatCurrency(analytics.totalOutstanding, analytics.currency)}
              </span>
            </div>
            {analytics.totalInvoiced > 0 && (
              <div className="pt-2" style={{ borderTop: "1px solid var(--mc-border-light)" }}>
                <div className="flex gap-1 h-2">
                  <div
                    style={{
                      width: `${(analytics.totalPaid / analytics.totalInvoiced) * 100}%`,
                      background: "var(--mc-success)",
                      minWidth: analytics.totalPaid > 0 ? "4px" : "0",
                    }}
                  />
                  <div
                    style={{
                      width: `${(analytics.totalOutstanding / analytics.totalInvoiced) * 100}%`,
                      background: "var(--mc-warning)",
                      minWidth: analytics.totalOutstanding > 0 ? "4px" : "0",
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px]" style={{ color: "var(--mc-success)" }}>
                    {Math.round((analytics.totalPaid / analytics.totalInvoiced) * 100)}% paid
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--mc-warning)" }}>
                    {Math.round((analytics.totalOutstanding / analytics.totalInvoiced) * 100)}% outstanding
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Orders by Status */}
        <div className="mc-card p-5">
          <h3 className="text-xs font-semibold tracking-[0.08em] uppercase mb-4" style={{ color: "var(--mc-text-muted)" }}>
            Orders by Status
          </h3>
          {analytics.ordersByStatus.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>No orders yet</p>
          ) : (
            <div className="space-y-3">
              {analytics.ordersByStatus.map(({ status, count }) => {
                const pct = analytics.totalOrders > 0 ? (count / analytics.totalOrders) * 100 : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
                        {STATUS_LABEL_MAP[status] || status}
                      </span>
                      <span className="text-xs font-mono" style={{ color: "var(--mc-text-muted)" }}>
                        {count} ({Math.round(pct)}%)
                      </span>
                    </div>
                    <div
                      className="h-1.5 w-full"
                      style={{ background: "var(--mc-surface-warm)" }}
                    >
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: STATUS_COLOR_MAP[status] || "var(--mc-text-muted)",
                          minWidth: count > 0 ? "4px" : "0",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Products + Additional KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="mc-card p-5">
          <h3 className="text-xs font-semibold tracking-[0.08em] uppercase mb-4" style={{ color: "var(--mc-text-muted)" }}>
            {isDistributor ? "Top Products by Volume" : "Most Ordered Products"}
          </h3>
          {analytics.topProducts.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>No order data yet</p>
          ) : (
            <div className="space-y-3">
              {analytics.topProducts.map((product, i) => {
                const maxCases = analytics.topProducts[0].totalCases;
                const pct = maxCases > 0 ? (product.totalCases / maxCases) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: "var(--mc-text-primary)" }}>
                        {product.name}
                      </span>
                      <span className="text-xs font-mono" style={{ color: "var(--mc-text-muted)" }}>
                        {product.totalCases} cases
                      </span>
                    </div>
                    <div
                      className="h-1.5 w-full"
                      style={{ background: "var(--mc-surface-warm)" }}
                    >
                      <div
                        className="h-full"
                        style={{
                          width: `${pct}%`,
                          background: "var(--mc-cream-subtle)",
                          minWidth: "4px",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Summary */}
        <div className="mc-card p-5">
          <h3 className="text-xs font-semibold tracking-[0.08em] uppercase mb-4" style={{ color: "var(--mc-text-muted)" }}>
            Activity Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
                {isDistributor ? "Delivered" : "Received"}
              </span>
              <p className="text-lg font-semibold mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                {analytics.deliveredCount}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
                {isDistributor ? "Pending Review" : "Awaiting Response"}
              </span>
              <p className="text-lg font-semibold mt-0.5" style={{ color: analytics.pendingCount > 0 ? "var(--mc-warning)" : "var(--mc-text-primary)" }}>
                {analytics.pendingCount}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
                {isDistributor ? "Collection Rate" : "Payment Rate"}
              </span>
              <p className="text-lg font-semibold mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                {analytics.totalInvoiced > 0 ? Math.round(analytics.totalPaid / analytics.totalInvoiced * 100) + "%" : "\u2014"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
                {isDistributor ? "Fulfillment Rate" : "Delivery Rate"}
              </span>
              <p className="text-lg font-semibold mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                {analytics.totalOrders > 0 ? Math.round((analytics.deliveredCount / analytics.totalOrders) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
