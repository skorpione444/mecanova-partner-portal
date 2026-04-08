"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { TrendingUp, Factory, ArrowRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  in_stock: number;
  open_demand: number;
  available: number;
  monthly_rate: number;
  runway_months: number | null;
  runway_status: "critical" | "low" | "ok" | "no_demand";
}

interface BuyerPattern {
  client_id: string;
  client_name: string;
  product_labels: string;
  order_count: number;
  avg_qty: number;
  pattern: "recurring" | "on_demand" | "new";
  avg_interval_days: number | null;
  last_order_date: string;
  next_expected_date: string | null;
}

interface ReorderGroup {
  supplier_id: string;
  supplier_name: string;
  items: {
    product_id: string;
    product_name: string;
    runway_months: number;
    runway_status: "critical" | "low";
    suggested_cases: number;
  }[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RunwayBadge({ status, months }: { status: ProductRow["runway_status"]; months: number | null }) {
  if (status === "no_demand") {
    return <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>No demand</span>;
  }
  const color =
    status === "critical" ? "var(--mc-error)" :
    status === "low"      ? "var(--mc-warning)" :
                            "var(--mc-success)";
  const bg =
    status === "critical" ? "var(--mc-error-bg)" :
    status === "low"      ? "var(--mc-warning-bg)" :
                            "var(--mc-success-bg)";
  const border =
    status === "critical" ? "var(--mc-error-light)" :
    status === "low"      ? "var(--mc-warning-light)" :
                            "var(--mc-success-light)";
  const label =
    months === null ? "—" :
    months < 0.5    ? "< 2 wks" :
    months < 1      ? `${(months * 4).toFixed(0)} wks` :
                      `${months.toFixed(1)} mo`;

  return (
    <span
      className="inline-flex px-2 py-0.5 text-[10px] font-semibold tracking-wide"
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      {label}
    </span>
  );
}

function PatternBadge({ pattern, intervalDays }: { pattern: BuyerPattern["pattern"]; intervalDays: number | null }) {
  if (pattern === "new") {
    return <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>New buyer</span>;
  }
  if (pattern === "on_demand") {
    return (
      <span
        className="inline-flex px-2 py-0.5 text-[10px] tracking-wide"
        style={{
          background: "var(--mc-surface-elevated)",
          border: "1px solid var(--mc-border)",
          color: "var(--mc-text-muted)",
        }}
      >
        On demand
      </span>
    );
  }
  const intervalLabel =
    intervalDays && intervalDays >= 25 && intervalDays <= 35 ? "monthly" :
    intervalDays && intervalDays >= 80 && intervalDays <= 100 ? "quarterly" :
    intervalDays ? `every ${intervalDays}d` : "";
  return (
    <span
      className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide"
      style={{
        background: "rgba(107,143,110,0.12)",
        border: "1px solid var(--mc-success-light)",
        color: "var(--mc-success)",
      }}
    >
      Recurring{intervalLabel ? ` · ${intervalLabel}` : ""}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlanningHubPage() {
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [buyerPatterns, setBuyerPatterns] = useState<BuyerPattern[]>([]);
  const [reorderGroups, setReorderGroups] = useState<ReorderGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);

    // 1. Products
    const { data: products } = await supabase
      .from("products")
      .select("id, name, brand, supplier_id, active")
      .eq("active", true)
      .order("name");
    if (!products?.length) { setLoading(false); return; }

    // 2. Supplier names
    const supplierIds = [...new Set(products.map((p) => p.supplier_id).filter(Boolean))] as string[];
    const supplierMap = new Map<string, string>();
    if (supplierIds.length > 0) {
      const { data: sups } = await supabase.from("partners").select("id, name").in("id", supplierIds);
      (sups || []).forEach((s) => supplierMap.set(s.id, s.name));
    }

    // 3. Inventory (sum per product across all distributors)
    const { data: inventory } = await supabase.from("inventory_status").select("product_id, on_hand_qty");
    const stockMap = new Map<string, number>();
    (inventory || []).forEach((inv) => {
      stockMap.set(inv.product_id, (stockMap.get(inv.product_id) || 0) + inv.on_hand_qty);
    });

    // 4. Orders + items
    const { data: orders } = await supabase
      .from("order_requests")
      .select("id, client_id, status, created_at")
      .order("created_at");
    const { data: items } = await supabase
      .from("order_request_items")
      .select("order_request_id, product_id, cases_qty");

    const orderMap = new Map<string, { status: string; created_at: string; client_id: string | null }>();
    (orders || []).forEach((o) => orderMap.set(o.id, { status: o.status, created_at: o.created_at, client_id: o.client_id }));

    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ACTIVE_STATUSES = new Set(["submitted", "accepted", "delivered", "fulfilled"]);

    // Compute per product: open demand + trailing 90-day qty
    const openDemandMap = new Map<string, number>();
    const trailingMap = new Map<string, number>();

    (items || []).forEach((item) => {
      const order = orderMap.get(item.order_request_id);
      if (!order || !ACTIVE_STATUSES.has(order.status)) return;

      if (order.status === "submitted" || order.status === "accepted") {
        openDemandMap.set(item.product_id, (openDemandMap.get(item.product_id) || 0) + item.cases_qty);
      }
      if (new Date(order.created_at) >= ninetyDaysAgo) {
        trailingMap.set(item.product_id, (trailingMap.get(item.product_id) || 0) + item.cases_qty);
      }
    });

    // 5. Build product rows
    const rows: ProductRow[] = products.map((p) => {
      const in_stock = stockMap.get(p.id) || 0;
      const open_demand = openDemandMap.get(p.id) || 0;
      const available = Math.max(0, in_stock - open_demand);
      const monthly_rate = (trailingMap.get(p.id) || 0) / 3;

      let runway_months: number | null = null;
      let runway_status: ProductRow["runway_status"] = "no_demand";

      if (monthly_rate > 0) {
        runway_months = available / monthly_rate;
        if (runway_months < 1) runway_status = "critical";
        else if (runway_months < 3) runway_status = "low";
        else runway_status = "ok";
      }

      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        supplier_id: p.supplier_id,
        supplier_name: p.supplier_id ? (supplierMap.get(p.supplier_id) || null) : null,
        in_stock,
        open_demand,
        available,
        monthly_rate,
        runway_months,
        runway_status,
      };
    });
    setProductRows(rows);

    // 6. Buyer patterns
    const validOrders = (orders || []).filter((o) => ACTIVE_STATUSES.has(o.status));
    const clientOrdersMap = new Map<string, typeof validOrders>();
    validOrders.forEach((o) => {
      if (!o.client_id) return;
      const arr = clientOrdersMap.get(o.client_id) || [];
      arr.push(o);
      clientOrdersMap.set(o.client_id, arr);
    });

    const clientIds = [...clientOrdersMap.keys()];
    const clientMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clients } = await supabase.from("partners").select("id, name").in("id", clientIds);
      (clients || []).forEach((c) => clientMap.set(c.id, c.name));
    }

    const patterns: BuyerPattern[] = [];
    clientOrdersMap.forEach((clientOrders, clientId) => {
      const sorted = [...clientOrders].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const orderCount = sorted.length;
      const lastOrder = sorted[sorted.length - 1];

      // Avg qty across all this client's items
      const clientItems = (items || []).filter((item) => {
        const o = orderMap.get(item.order_request_id);
        return o?.client_id === clientId && ACTIVE_STATUSES.has(o.status);
      });
      const totalQty = clientItems.reduce((s, i) => s + i.cases_qty, 0);
      const avgQty = orderCount > 0 ? Math.round(totalQty / orderCount) : 0;

      // Product labels
      const productIds = [...new Set(clientItems.map((i) => i.product_id))];
      const productLabels = productIds
        .map((pid) => {
          const prod = products.find((p) => p.id === pid);
          return prod ? prod.name.split(" ").slice(-1)[0] : "?"; // last word of name
        })
        .join(", ");

      // Pattern detection (uses all orders, not just 90-day window)
      let pattern: BuyerPattern["pattern"] = "new";
      let avg_interval_days: number | null = null;
      let next_expected_date: string | null = null;

      if (orderCount >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          const diff =
            (new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime()) /
            86400000;
          intervals.push(diff);
        }
        avg_interval_days = Math.round(intervals.reduce((a, b) => a + b) / intervals.length);
        const maxI = Math.max(...intervals);
        const minI = Math.min(...intervals);
        const varianceRatio = avg_interval_days > 0 ? (maxI - minI) / avg_interval_days : 1;

        if (orderCount >= 3 && varianceRatio < 0.5) {
          pattern = "recurring";
          const nextDate = new Date(lastOrder.created_at);
          nextDate.setDate(nextDate.getDate() + avg_interval_days);
          next_expected_date = nextDate.toISOString().split("T")[0];
        } else {
          pattern = "on_demand";
        }
      }

      patterns.push({
        client_id: clientId,
        client_name: clientMap.get(clientId) || "Unknown",
        product_labels: productLabels,
        order_count: orderCount,
        avg_qty: avgQty,
        pattern,
        avg_interval_days,
        last_order_date: lastOrder.created_at,
        next_expected_date,
      });
    });

    setBuyerPatterns(patterns.sort((a, b) => a.client_name.localeCompare(b.client_name)));

    // 7. Reorder groups
    const reorderItems: (ReorderGroup["items"][number] & { supplier_id: string; supplier_name: string })[] = [];
    rows.forEach((row) => {
      if ((row.runway_status === "critical" || row.runway_status === "low") && row.supplier_id) {
        const target = 4; // cover 4 months
        const suggested_cases = Math.max(1, Math.round(row.monthly_rate * target - row.available));
        reorderItems.push({
          supplier_id: row.supplier_id,
          supplier_name: row.supplier_name || "Unknown Supplier",
          product_id: row.id,
          product_name: row.name,
          runway_months: row.runway_months ?? 0,
          runway_status: row.runway_status as "critical" | "low",
          suggested_cases,
        });
      }
    });

    const groupMap = new Map<string, ReorderGroup>();
    reorderItems.forEach((item) => {
      const g = groupMap.get(item.supplier_id) || {
        supplier_id: item.supplier_id,
        supplier_name: item.supplier_name,
        items: [],
      };
      g.items.push(item);
      groupMap.set(item.supplier_id, g);
    });
    setReorderGroups([...groupMap.values()]);

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-56 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="mc-skeleton h-14" />)}
        </div>
      </div>
    );
  }

  const criticalCount = productRows.filter((r) => r.runway_status === "critical").length;
  const lowCount = productRows.filter((r) => r.runway_status === "low").length;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Planning Hub"
        description={
          criticalCount > 0
            ? `${criticalCount} product${criticalCount > 1 ? "s" : ""} critically low — reorder needed`
            : lowCount > 0
            ? `${lowCount} product${lowCount > 1 ? "s" : ""} running low`
            : "All products sufficiently stocked"
        }
        icon={TrendingUp}
      />

      {/* ── Section 1: Stock Runway ── */}
      <div className="mc-card overflow-hidden mb-6">
        <div
          className="px-5 py-4"
          style={{ borderBottom: "1px solid var(--mc-border)" }}
        >
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Stock Runway
          </h3>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
            Months of supply remaining · based on trailing 90-day demand rate
          </p>
        </div>
        <table className="mc-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Supplier</th>
              <th>In Stock</th>
              <th>Open Orders</th>
              <th>Available</th>
              <th>Monthly Rate</th>
              <th>Runway</th>
            </tr>
          </thead>
          <tbody>
            {productRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link
                    href={`/products/${row.id}`}
                    className="text-xs font-medium transition-colors"
                    style={{ color: "var(--mc-cream-subtle)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                  >
                    {row.name}
                  </Link>
                  {row.brand && (
                    <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>{row.brand}</p>
                  )}
                </td>
                <td>
                  {row.supplier_id && row.supplier_name ? (
                    <Link
                      href={`/partners/${row.supplier_id}`}
                      className="inline-flex items-center gap-1 text-xs transition-colors"
                      style={{ color: "var(--mc-text-secondary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-secondary)")}
                    >
                      <Factory className="w-3 h-3 flex-shrink-0" />
                      {row.supplier_name}
                    </Link>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>—</span>
                  )}
                </td>
                <td>
                  <span className="text-xs">{row.in_stock} cs</span>
                </td>
                <td>
                  <span
                    className="text-xs"
                    style={{ color: row.open_demand > 0 ? "var(--mc-warning)" : "var(--mc-text-muted)" }}
                  >
                    {row.open_demand > 0 ? `${row.open_demand} cs` : "—"}
                  </span>
                </td>
                <td>
                  <span className="text-xs font-medium" style={{ color: "var(--mc-text-primary)" }}>
                    {row.available} cs
                  </span>
                </td>
                <td>
                  <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
                    {row.monthly_rate > 0 ? `${row.monthly_rate.toFixed(1)} cs/mo` : "—"}
                  </span>
                </td>
                <td>
                  <RunwayBadge status={row.runway_status} months={row.runway_months} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Sections 2 + 3: Two columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Buyer Demand Patterns */}
        <div className="lg:col-span-2 mc-card overflow-hidden">
          <div
            className="px-5 py-4"
            style={{ borderBottom: "1px solid var(--mc-border)" }}
          >
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Buyer Demand Patterns
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
              Auto-classified from order history · recurring buyers allow forward stock commitment
            </p>
          </div>
          {buyerPatterns.length === 0 ? (
            <p className="px-5 py-4 text-xs" style={{ color: "var(--mc-text-muted)" }}>No active buyers</p>
          ) : (
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Products</th>
                  <th>Orders</th>
                  <th>Avg Qty</th>
                  <th>Pattern</th>
                  <th>Next Expected</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {buyerPatterns.map((bp) => {
                  const isOverdue =
                    bp.next_expected_date && new Date(bp.next_expected_date) < new Date();
                  return (
                    <tr key={bp.client_id}>
                      <td>
                        <Link
                          href={`/partners/${bp.client_id}`}
                          className="text-xs font-medium transition-colors"
                          style={{ color: "var(--mc-cream-subtle)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                        >
                          {bp.client_name}
                        </Link>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
                          {bp.product_labels}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs">{bp.order_count}</span>
                      </td>
                      <td>
                        <span className="text-xs">{bp.avg_qty} cs</span>
                      </td>
                      <td>
                        <PatternBadge pattern={bp.pattern} intervalDays={bp.avg_interval_days} />
                      </td>
                      <td>
                        {bp.next_expected_date ? (
                          <span
                            className="text-xs"
                            style={{ color: isOverdue ? "var(--mc-warning)" : "var(--mc-text-secondary)" }}
                          >
                            {isOverdue ? "Overdue · " : ""}
                            {formatDate(bp.next_expected_date)}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/partners/${bp.client_id}`}
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
          )}
        </div>

        {/* Reorder Planner */}
        <div className="mc-card p-5">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-1"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Reorder Planner
          </h3>
          <p className="text-[10px] mb-4" style={{ color: "var(--mc-text-muted)" }}>
            Suggested orders to cover 4 months of demand
          </p>

          {reorderGroups.length === 0 ? (
            <div
              className="px-3 py-3 text-xs"
              style={{
                background: "var(--mc-success-bg)",
                border: "1px solid var(--mc-success-light)",
                color: "var(--mc-success)",
              }}
            >
              All products sufficiently stocked — no reorders needed.
            </div>
          ) : (
            <div className="space-y-5">
              {reorderGroups.map((group) => (
                <div key={group.supplier_id}>
                  <Link
                    href={`/partners/${group.supplier_id}`}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide mb-2 transition-colors"
                    style={{ color: "var(--mc-cream-subtle)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                  >
                    <Factory className="w-3 h-3" />
                    {group.supplier_name}
                  </Link>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.product_id}
                        className="px-3 py-2.5"
                        style={{
                          background: item.runway_status === "critical"
                            ? "var(--mc-error-bg)"
                            : "var(--mc-warning-bg)",
                          border: `1px solid ${item.runway_status === "critical"
                            ? "var(--mc-error-light)"
                            : "var(--mc-warning-light)"}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              href={`/products/${item.product_id}`}
                              className="text-xs font-medium transition-colors"
                              style={{ color: "var(--mc-text-primary)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-primary)")}
                            >
                              {item.product_name}
                            </Link>
                            <p className="text-[10px] mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
                              {item.runway_months < 0.5
                                ? "Stock critically low"
                                : `${item.runway_months.toFixed(1)} mo runway`}
                            </p>
                          </div>
                          <span
                            className="text-xs font-semibold flex-shrink-0"
                            style={{
                              color: item.runway_status === "critical"
                                ? "var(--mc-error)"
                                : "var(--mc-warning)",
                            }}
                          >
                            {item.suggested_cases} cs
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
