"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import type { OrderRequest, InventoryStatus } from "@mecanova/shared";
import { ACTIVE_ORDER_STATUSES, INVENTORY_ADJUSTMENT_LABELS } from "@mecanova/shared";
import {
  Layers,
  Factory,
  ArrowRight,
  Search,
  Save,
  History,
  Plus,
  X,
  TrendingUp,
  Warehouse,
  ClipboardList,
  Truck,
  Check,
  MoveRight,
} from "lucide-react";

type Tab = "planning" | "stock" | "orders" | "supply";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  in_stock: number;
  in_transit: number;
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

type InventoryRow = InventoryStatus & {
  distributor_name: string;
  product_name: string;
};

type OrderRow = OrderRequest & {
  partner_name: string;
  client_name: string | null;
  distributor_name: string | null;
  delivery_distributors: { name: string; cases: number }[];
  items: { product_id: string; product_name: string; cases_qty: number; price_per_case: number | null }[];
};

interface FulfillmentModalState {
  order: OrderRow;
  action: "accept" | "deliver";
  stockRows: {
    product_id: string;
    product_name: string;
    ordered_qty: number;
    bottles_per_case: number | null;
    locations: { distributor_id: string; name: string; on_hand_qty: number }[];
    total_available: number;
  }[];
  // allocation[product_id][distributor_id] = cases string
  allocation: Record<string, Record<string, string>>;
  loading: boolean;
  submitting: boolean;
}

interface SupplyOrder {
  id: string;
  product_id: string;
  supplier_id: string;
  distributor_id: string | null;
  cases_ordered: number;
  unit_cost_eur: number | null;
  expected_arrival_date: string | null;
  arrived_at: string | null;
  status: "pending" | "arrived" | "cancelled";
  notes: string | null;
  created_at: string;
  product_name: string;
  supplier_name: string;
  distributor_name: string | null;
}

type TransportMethod = "car" | "train" | "dhl" | "other";

interface StockTransfer {
  id: string;
  product_id: string;
  from_dist_id: string;
  to_dist_id: string;
  cases_qty: number;
  transport_method: TransportMethod;
  transport_note: string | null;
  logistics_cost_eur: number | null;
  expected_arrival_date: string | null;
  arrived_at: string | null;
  status: "in_transit" | "arrived" | "cancelled";
  notes: string | null;
  created_at: string;
  product_name: string;
  from_dist_name: string;
  to_dist_name: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RunwayBadge({
  status,
  months,
}: {
  status: ProductRow["runway_status"];
  months: number | null;
}) {
  if (status === "no_demand")
    return (
      <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
        No demand
      </span>
    );
  const color =
    status === "critical"
      ? "var(--mc-error)"
      : status === "low"
      ? "var(--mc-warning)"
      : "var(--mc-success)";
  const bg =
    status === "critical"
      ? "var(--mc-error-bg)"
      : status === "low"
      ? "var(--mc-warning-bg)"
      : "var(--mc-success-bg)";
  const border =
    status === "critical"
      ? "var(--mc-error-light)"
      : status === "low"
      ? "var(--mc-warning-light)"
      : "var(--mc-success-light)";
  const label =
    months === null
      ? "—"
      : months < 0.5
      ? "< 2 wks"
      : months < 1
      ? `${(months * 4).toFixed(0)} wks`
      : `${months.toFixed(1)} mo`;
  return (
    <span
      className="inline-flex px-2 py-0.5 text-[10px] font-semibold tracking-wide"
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      {label}
    </span>
  );
}

function PatternBadge({
  pattern,
  intervalDays,
}: {
  pattern: BuyerPattern["pattern"];
  intervalDays: number | null;
}) {
  if (pattern === "new")
    return (
      <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
        New buyer
      </span>
    );
  if (pattern === "on_demand")
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
  const intervalLabel =
    intervalDays && intervalDays >= 25 && intervalDays <= 35
      ? "monthly"
      : intervalDays && intervalDays >= 80 && intervalDays <= 100
      ? "quarterly"
      : intervalDays
      ? `every ${intervalDays}d`
      : "";
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

function StockBadge({ status }: { status: string }) {
  const s =
    status === "in_stock"
      ? { bg: "var(--mc-success-bg)", border: "var(--mc-success-light)", color: "var(--mc-success)", label: "In Stock" }
      : { bg: "var(--mc-error-bg)", border: "var(--mc-error-light)", color: "var(--mc-error)", label: "Out" };
  return (
    <span
      className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function SupplyStatusBadge({ status }: { status: SupplyOrder["status"] }) {
  const s =
    status === "arrived"
      ? { bg: "var(--mc-success-bg)", border: "var(--mc-success-light)", color: "var(--mc-success)", label: "Arrived" }
      : status === "cancelled"
      ? { bg: "var(--mc-error-bg)", border: "var(--mc-error-light)", color: "var(--mc-error)", label: "Cancelled" }
      : { bg: "var(--mc-warning-bg)", border: "var(--mc-warning-light)", color: "var(--mc-warning)", label: "Pending" };
  return (
    <span
      className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-5 py-3 text-xs font-medium tracking-wide transition-all"
      style={{
        borderBottom: `2px solid ${active ? "var(--mc-cream)" : "transparent"}`,
        color: active ? "var(--mc-cream)" : "var(--mc-text-muted)",
        background: "transparent",
      }}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={active ? 2 : 1.5} />
      {children}
    </button>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

function OperationsPageContent() {
  const searchParams = useSearchParams();

  const initialTab = (() => {
    const t = searchParams.get("tab") as Tab | null;
    return t === "stock" || t === "orders" || t === "supply" ? t : "planning";
  })();

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // ── Planning ──
  const [targetMonths, setTargetMonths] = useState(4);
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [buyerPatterns, setBuyerPatterns] = useState<BuyerPattern[]>([]);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [planningLoaded, setPlanningLoaded] = useState(false);

  // ── Stock ──
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [movements, setMovements] = useState<
    {
      id: string;
      distributor_name: string;
      product_name: string;
      movement_type: string;
      qty_delta: number;
      created_at: string;
    }[]
  >([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockLoaded, setStockLoaded] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState("all");
  const [stockDistributorFilter, setStockDistributorFilter] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMovements, setShowMovements] = useState(false);
  const [allKnownDistributors, setAllKnownDistributors] = useState<{ id: string; name: string }[]>([]);
  const [inTransitTransfers, setInTransitTransfers] = useState<StockTransfer[]>([]);

  // ── Orders ──
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersStatusFilter, setOrdersStatusFilter] = useState("all");
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [newOrderSubmitting, setNewOrderSubmitting] = useState(false);
  const [allClients, setAllClients] = useState<{ id: string; name: string }[]>([]);
  const [allOrderDistributors, setAllOrderDistributors] = useState<{ id: string; name: string; is_mecanova: boolean }[]>([]);
  const [allOrderProducts, setAllOrderProducts] = useState<{ id: string; name: string }[]>([]);
  const [newOrder, setNewOrder] = useState<{
    client_id: string;
    items: { product_id: string; cases_qty: string; price_per_case: string }[];
    notes: string;
    isSample: boolean;
  }>({
    client_id: "",
    items: [{ product_id: "", cases_qty: "", price_per_case: "" }],
    notes: "",
    isSample: false,
  });
  const [fulfillmentModal, setFulfillmentModal] = useState<FulfillmentModalState | null>(null);
  const [showDestructionForm, setShowDestructionForm] = useState(false);
  const [destructionSubmitting, setDestructionSubmitting] = useState(false);
  const [newDestruction, setNewDestruction] = useState({ distributor_id: "", product_id: "", cases_qty: "", reason: "broken" });
  const [destructionAvailableStock, setDestructionAvailableStock] = useState<number | null>(null);
  const [cancelDestructionModal, setCancelDestructionModal] = useState<{
    order: OrderRow;
    restore_to_distributor_id: string;
    submitting: boolean;
  } | null>(null);

  // ── Supply orders ──
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>([]);
  const [supplyLoading, setSupplyLoading] = useState(false);
  const [supplyLoaded, setSupplyLoaded] = useState(false);
  const [supplyStatusFilter, setSupplyStatusFilter] = useState("all");
  const [showSupplyForm, setShowSupplyForm] = useState(false);
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; supplier_id: string | null }[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [allDistributors, setAllDistributors] = useState<{ id: string; name: string }[]>([]);
  const [newSupply, setNewSupply] = useState({
    product_id: "",
    supplier_id: "",
    distributor_id: "",
    cases_ordered: "",
    unit_cost_eur: "",
    expected_arrival_date: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // ── Stock transfers ──
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>([]);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [newTransfer, setNewTransfer] = useState<{
    product_id: string;
    from_dist_id: string;
    to_dist_id: string;
    cases_qty: string;
    transport_method: TransportMethod;
    transport_note: string;
    logistics_cost_eur: string;
    expected_arrival_date: string;
    notes: string;
  }>({
    product_id: "",
    from_dist_id: "",
    to_dist_id: "",
    cases_qty: "",
    transport_method: "other",
    transport_note: "",
    logistics_cost_eur: "",
    expected_arrival_date: "",
    notes: "",
  });
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferSourceStock, setTransferSourceStock] = useState<number | null>(null);
  const [transferArrivalError, setTransferArrivalError] = useState<{ id: string; shortfall: number } | null>(null);
  const [activeSupplyTab, setActiveSupplyTab] = useState<"supply_orders" | "internal_transfers">("supply_orders");

  const supabase = createClient();

  // ── Transfer source stock lookup ──
  useEffect(() => {
    if (!newTransfer.product_id || !newTransfer.from_dist_id) {
      setTransferSourceStock(null);
      return;
    }
    supabase
      .from("inventory_status")
      .select("on_hand_qty")
      .eq("product_id", newTransfer.product_id)
      .eq("distributor_id", newTransfer.from_dist_id)
      .maybeSingle()
      .then(({ data }) => setTransferSourceStock(data?.on_hand_qty ?? 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newTransfer.product_id, newTransfer.from_dist_id]);

  // ── Reorder groups — derived from productRows + targetMonths ──
  const reorderGroups = useMemo(() => {
    const items: {
      supplier_id: string;
      supplier_name: string;
      product_id: string;
      product_name: string;
      runway_months: number;
      runway_status: "critical" | "low";
      suggested_cases: number;
    }[] = [];
    productRows.forEach((row) => {
      if (
        (row.runway_status === "critical" || row.runway_status === "low") &&
        row.supplier_id
      ) {
        const suggested_cases = Math.max(
          1,
          Math.round(row.monthly_rate * targetMonths - row.available)
        );
        items.push({
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
    const map = new Map<
      string,
      { supplier_id: string; supplier_name: string; items: typeof items }
    >();
    items.forEach((item) => {
      const g = map.get(item.supplier_id) || {
        supplier_id: item.supplier_id,
        supplier_name: item.supplier_name,
        items: [],
      };
      g.items.push(item);
      map.set(item.supplier_id, g);
    });
    return [...map.values()];
  }, [productRows, targetMonths]);

  // ─── Data loaders ─────────────────────────────────────────────────────────

  const loadPlanning = useCallback(async () => {
    setPlanningLoading(true);

    const { data: products } = await supabase
      .from("products")
      .select("id, name, brand, supplier_id")
      .eq("active", true)
      .order("name");

    if (!products?.length) {
      setPlanningLoading(false);
      setPlanningLoaded(true);
      return;
    }

    const supplierIds = [
      ...new Set(products.map((p) => p.supplier_id).filter(Boolean)),
    ] as string[];
    const supplierMap = new Map<string, string>();
    if (supplierIds.length > 0) {
      const { data: sups } = await supabase
        .from("partners")
        .select("id, name")
        .in("id", supplierIds);
      (sups || []).forEach((s) => supplierMap.set(s.id, s.name));
    }

    const { data: inventory } = await supabase
      .from("inventory_status")
      .select("product_id, on_hand_qty");
    const stockMap = new Map<string, number>();
    (inventory || []).forEach((inv) => {
      stockMap.set(inv.product_id, (stockMap.get(inv.product_id) || 0) + inv.on_hand_qty);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inTransitData } = await (supabase as any)
      .from("stock_transfers")
      .select("product_id, cases_qty")
      .eq("status", "in_transit");
    const inTransitMap = new Map<string, number>();
    (inTransitData || []).forEach((t: { product_id: string; cases_qty: number }) => {
      inTransitMap.set(t.product_id, (inTransitMap.get(t.product_id) || 0) + t.cases_qty);
    });

    const { data: ordersRaw } = await supabase
      .from("order_requests")
      .select("id, client_id, status, created_at")
      .order("created_at");
    const { data: items } = await supabase
      .from("order_request_items")
      .select("order_request_id, product_id, cases_qty");

    const orderMap = new Map<
      string,
      { status: string; created_at: string; client_id: string | null }
    >();
    (ordersRaw || []).forEach((o) =>
      orderMap.set(o.id, {
        status: o.status,
        created_at: o.created_at,
        client_id: o.client_id,
      })
    );

    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ACTIVE = new Set(["submitted", "accepted", "delivered", "fulfilled"]);

    const openDemandMap = new Map<string, number>();
    const trailingMap = new Map<string, number>();
    (items || []).forEach((item) => {
      const order = orderMap.get(item.order_request_id);
      if (!order || !ACTIVE.has(order.status)) return;
      if (order.status === "submitted" || order.status === "accepted") {
        openDemandMap.set(
          item.product_id,
          (openDemandMap.get(item.product_id) || 0) + item.cases_qty
        );
      }
      if (new Date(order.created_at) >= ninetyDaysAgo) {
        trailingMap.set(
          item.product_id,
          (trailingMap.get(item.product_id) || 0) + item.cases_qty
        );
      }
    });

    const rows: ProductRow[] = products.map((p) => {
      const in_stock = stockMap.get(p.id) || 0;
      const open_demand = openDemandMap.get(p.id) || 0;
      const available = Math.max(0, in_stock - open_demand);
      const monthly_rate = (trailingMap.get(p.id) || 0) / 3;
      let runway_months: number | null = null;
      let runway_status: ProductRow["runway_status"] = "no_demand";
      if (monthly_rate > 0) {
        runway_months = available / monthly_rate;
        runway_status =
          runway_months < 1 ? "critical" : runway_months < 3 ? "low" : "ok";
      }
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        supplier_id: p.supplier_id,
        supplier_name: p.supplier_id ? supplierMap.get(p.supplier_id) || null : null,
        in_stock,
        in_transit: inTransitMap.get(p.id) || 0,
        open_demand,
        available,
        monthly_rate,
        runway_months,
        runway_status,
      };
    });
    setProductRows(rows);

    // Buyer patterns
    const validOrders = (ordersRaw || []).filter((o) => ACTIVE.has(o.status));
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
      const { data: clients } = await supabase
        .from("partners")
        .select("id, name")
        .in("id", clientIds);
      (clients || []).forEach((c) => clientMap.set(c.id, c.name));
    }

    const patterns: BuyerPattern[] = [];
    clientOrdersMap.forEach((clientOrders, clientId) => {
      const sorted = [...clientOrders].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const orderCount = sorted.length;
      const lastOrder = sorted[sorted.length - 1];
      const clientItems = (items || []).filter((item) => {
        const o = orderMap.get(item.order_request_id);
        return o?.client_id === clientId && ACTIVE.has(o.status);
      });
      const totalQty = clientItems.reduce((s, i) => s + i.cases_qty, 0);
      const avgQty = orderCount > 0 ? Math.round(totalQty / orderCount) : 0;
      const productIds = [...new Set(clientItems.map((i) => i.product_id))];
      const productLabels = productIds
        .map((pid) => {
          const prod = products.find((p) => p.id === pid);
          return prod ? prod.name : "?";
        })
        .join(", ");

      let pattern: BuyerPattern["pattern"] = "new";
      let avg_interval_days: number | null = null;
      let next_expected_date: string | null = null;

      if (orderCount >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          intervals.push(
            (new Date(sorted[i].created_at).getTime() -
              new Date(sorted[i - 1].created_at).getTime()) /
              86400000
          );
        }
        avg_interval_days = Math.round(
          intervals.reduce((a, b) => a + b) / intervals.length
        );
        const maxI = Math.max(...intervals);
        const minI = Math.min(...intervals);
        const varianceRatio =
          avg_interval_days > 0 ? (maxI - minI) / avg_interval_days : 1;
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
    setBuyerPatterns(
      patterns.sort((a, b) => a.client_name.localeCompare(b.client_name))
    );

    setPlanningLoading(false);
    setPlanningLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStock = useCallback(async () => {
    setStockLoading(true);
    const [invRes, movRes, allDistsRes, inTransitRes] = await Promise.all([
      supabase.from("inventory_status").select("*"),
      supabase
        .from("inventory_movements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("partners").select("id, name").eq("partner_type", "distributor").order("name"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("stock_transfers").select("*").eq("status", "in_transit").order("created_at", { ascending: false }),
    ]);
    const invData = invRes.data || [];
    const movData = movRes.data || [];
    const allDistsData = (allDistsRes.data || []) as { id: string; name: string }[];
    setAllKnownDistributors(allDistsData);

    // Enrich in-transit transfers with names
    const rawInTransit = (inTransitRes.data || []) as StockTransfer[];
    if (rawInTransit.length > 0) {
      const distNameMap = new Map(allDistsData.map((d) => [d.id, d.name]));
      const missingDistIds = [...new Set(rawInTransit.flatMap((t) => [t.from_dist_id, t.to_dist_id]))].filter((id) => !distNameMap.has(id));
      if (missingDistIds.length > 0) {
        const { data: extraDists } = await supabase.from("partners").select("id, name").in("id", missingDistIds);
        (extraDists || []).forEach((d) => distNameMap.set(d.id, d.name));
      }
      const transitProdIds = [...new Set(rawInTransit.map((t) => t.product_id))];
      const { data: transitProdsData } = await supabase.from("products").select("id, name").in("id", transitProdIds);
      const transitProdMap = new Map((transitProdsData || []).map((p) => [p.id, p.name]));
      setInTransitTransfers(rawInTransit.map((t) => ({
        ...t,
        product_name: transitProdMap.get(t.product_id) || "Unknown",
        from_dist_name: distNameMap.get(t.from_dist_id) || "Unknown",
        to_dist_name: distNameMap.get(t.to_dist_id) || "Unknown",
      })));
    } else {
      setInTransitTransfers([]);
    }
    const distIds = new Set<string>();
    const prodIds = new Set<string>();
    invData.forEach((i) => {
      distIds.add(i.distributor_id);
      prodIds.add(i.product_id);
    });
    movData.forEach((m) => {
      distIds.add(m.distributor_id);
      prodIds.add(m.product_id);
    });
    const [distsRes, prodsRes] = await Promise.all([
      distIds.size > 0
        ? supabase.from("partners").select("id, name").in("id", [...distIds])
        : Promise.resolve({ data: [] }),
      prodIds.size > 0
        ? supabase.from("products").select("id, name").in("id", [...prodIds])
        : Promise.resolve({ data: [] }),
    ]);
    const distMap = new Map(
      (distsRes.data || []).map((d) => [d.id, d.name])
    );
    const prodMap = new Map(
      (prodsRes.data || []).map((p) => [p.id, p.name])
    );
    setInventory(
      invData.map((i) => ({
        ...i,
        distributor_name: distMap.get(i.distributor_id) || "Unknown",
        product_name: prodMap.get(i.product_id) || "Unknown",
      }))
    );
    setMovements(
      movData.map((m) => ({
        id: m.id,
        distributor_name: distMap.get(m.distributor_id) || "Unknown",
        product_name: prodMap.get(m.product_id) || "Unknown",
        movement_type: m.movement_type,
        qty_delta: m.qty_delta,
        created_at: m.created_at,
      }))
    );
    setStockLoading(false);
    setStockLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);

    // Load form data (clients, distributors, products) in parallel with orders
    const [ordersRes, clientsRes, distsRes, prodsRes] = await Promise.all([
      supabase.from("order_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("partners").select("id, name").eq("partner_type", "client").order("name"),
      supabase.from("partners").select("id, name, is_mecanova").eq("partner_type", "distributor").order("name"),
      supabase.from("products").select("id, name").eq("active", true).order("name"),
    ]);

    const clientsList = clientsRes.data || [];
    const distsList = (distsRes.data || []) as { id: string; name: string; is_mecanova: boolean }[];
    setAllClients(clientsList);
    setAllOrderDistributors(distsList);
    setAllOrderProducts(prodsRes.data || []);

    const ordersData = ordersRes.data;
    if (!ordersData?.length) {
      setOrders([]);
      setOrdersLoading(false);
      setOrdersLoaded(true);
      return;
    }

    // Fetch partner names
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
    const nameMap = new Map((partners || []).map((p) => [p.id, p.name]));

    // Fetch order items
    const orderIds = ordersData.map((o) => o.id);
    const { data: itemsRaw } = await supabase
      .from("order_request_items")
      .select("order_request_id, product_id, cases_qty, price_per_case")
      .in("order_request_id", orderIds);

    // Fetch product names for items
    const itemProductIds = [...new Set((itemsRaw || []).map((i) => i.product_id))];
    const { data: itemProducts } = itemProductIds.length > 0
      ? await supabase.from("products").select("id, name").in("id", itemProductIds)
      : { data: [] as { id: string; name: string }[] };
    const itemProductMap = new Map((itemProducts || []).map((p) => [p.id, p.name]));

    // Group items by order_request_id
    const itemsMap = new Map<string, { product_id: string; product_name: string; cases_qty: number; price_per_case: number | null }[]>();
    (itemsRaw || []).forEach((item) => {
      const arr = itemsMap.get(item.order_request_id) || [];
      arr.push({
        product_id: item.product_id,
        product_name: itemProductMap.get(item.product_id) || "Unknown",
        cases_qty: item.cases_qty,
        price_per_case: item.price_per_case ?? null,
      });
      itemsMap.set(item.order_request_id, arr);
    });

    // Fetch delivery breakdown from inventory_movements
    const { data: deliveryMovs } = await supabase
      .from("inventory_movements")
      .select("order_request_id, distributor_id, qty_delta")
      .eq("movement_type", "order_deliver")
      .in("order_request_id", orderIds);

    // Add any movement distributor IDs not yet in nameMap
    const movDistIds = [...new Set((deliveryMovs || []).map((m) => m.distributor_id))].filter((id) => !nameMap.has(id));
    if (movDistIds.length > 0) {
      const { data: movDists } = await supabase.from("partners").select("id, name").in("id", movDistIds);
      (movDists || []).forEach((d) => nameMap.set(d.id, d.name));
    }

    // Group movements: order_id → [{distributor_id, cases}]
    const deliveryMap = new Map<string, { distributor_id: string; cases: number }[]>();
    (deliveryMovs || []).forEach((mov) => {
      if (!mov.order_request_id || !mov.distributor_id) return;
      const arr = deliveryMap.get(mov.order_request_id) || [];
      const existing = arr.find((e) => e.distributor_id === mov.distributor_id);
      if (existing) {
        existing.cases += Math.abs(mov.qty_delta);
      } else {
        arr.push({ distributor_id: mov.distributor_id, cases: Math.abs(mov.qty_delta) });
      }
      deliveryMap.set(mov.order_request_id, arr);
    });

    setOrders(
      ordersData.map((o) => {
        const deliveries = deliveryMap.get(o.id) || [];
        return {
          ...o,
          partner_name: nameMap.get(o.partner_id) || "Unknown",
          client_name: o.client_id ? nameMap.get(o.client_id) || null : null,
          distributor_name: o.distributor_id ? nameMap.get(o.distributor_id) || null : null,
          delivery_distributors: deliveries.map((d) => ({ name: nameMap.get(d.distributor_id) || "Unknown", cases: d.cases })),
          items: itemsMap.get(o.id) || [],
        };
      })
    );
    setOrdersLoading(false);
    setOrdersLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSupply = useCallback(async () => {
    setSupplyLoading(true);

    const [supRes, prodRes, partRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("supply_orders")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, supplier_id").order("name"),
      supabase.from("partners").select("id, name, partner_type").order("name"),
    ]);

    const supData = supRes.data || [];
    const prodData = prodRes.data || [];
    const partData = partRes.data || [];

    const prodMap = new Map(prodData.map((p) => [p.id, p.name]));
    const partMap = new Map(partData.map((p) => [p.id, p.name]));

    setSupplyOrders(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supData as any[]).map((s) => ({
        ...s,
        product_name: prodMap.get(s.product_id) || "Unknown",
        supplier_name: partMap.get(s.supplier_id) || "Unknown",
        distributor_name: s.distributor_id
          ? partMap.get(s.distributor_id) || null
          : null,
      }))
    );

    setAllProducts(prodData);
    setAllSuppliers(
      partData.filter((p) => p.partner_type === "supplier")
    );
    setAllDistributors(
      partData.filter((p) => p.partner_type === "distributor")
    );

    // Load stock transfers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: transfersRaw } = await (supabase as any)
      .from("stock_transfers")
      .select("*")
      .order("created_at", { ascending: false });
    const transfers = (transfersRaw || []) as StockTransfer[];
    const transferDistIds = new Set<string>();
    const transferProdIds = new Set<string>();
    transfers.forEach((t) => {
      transferDistIds.add(t.from_dist_id);
      transferDistIds.add(t.to_dist_id);
      transferProdIds.add(t.product_id);
    });
    const allDistIds = new Set([...transferDistIds, ...partData.map((p) => p.id)]);
    const allProdIds = new Set([...transferProdIds, ...prodData.map((p) => p.id)]);
    // Build enriched maps (use already-loaded data where possible)
    const distMap = new Map(partData.map((p) => [p.id, p.name]));
    const pMap = new Map(prodData.map((p) => [p.id, p.name]));
    // Fetch any missing dist/prod names
    const missingDists = [...transferDistIds].filter((id) => !distMap.has(id));
    const missingProds = [...transferProdIds].filter((id) => !pMap.has(id));
    if (missingDists.length > 0) {
      const { data: extraDists } = await supabase.from("partners").select("id, name").in("id", missingDists);
      (extraDists || []).forEach((d) => distMap.set(d.id, d.name));
    }
    if (missingProds.length > 0) {
      const { data: extraProds } = await supabase.from("products").select("id, name").in("id", missingProds);
      (extraProds || []).forEach((p) => pMap.set(p.id, p.name));
    }
    void allDistIds; void allProdIds;
    setStockTransfers(
      transfers.map((t) => ({
        ...t,
        product_name: pMap.get(t.product_id) || "Unknown",
        from_dist_name: distMap.get(t.from_dist_id) || "Unknown",
        to_dist_name: distMap.get(t.to_dist_id) || "Unknown",
      }))
    );

    setSupplyLoading(false);
    setSupplyLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Tab activation ────────────────────────────────────────────────────────

  useEffect(() => {
    loadPlanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "stock" && !stockLoaded) loadStock();
    if (activeTab === "orders" && !ordersLoaded) loadOrders();
    if (activeTab === "supply" && !supplyLoaded) loadSupply();
    if (activeTab === "planning" && !planningLoaded) loadPlanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const submitNewTransfer = async () => {
    if (!newTransfer.product_id || !newTransfer.from_dist_id || !newTransfer.to_dist_id || !newTransfer.cases_qty) return;
    setTransferSubmitting(true);
    const casesQty = parseInt(newTransfer.cases_qty);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedTransfer } = await (supabase as any).from("stock_transfers").insert({
      product_id: newTransfer.product_id,
      from_dist_id: newTransfer.from_dist_id,
      to_dist_id: newTransfer.to_dist_id,
      cases_qty: casesQty,
      transport_method: newTransfer.transport_method,
      transport_note: newTransfer.transport_note || null,
      logistics_cost_eur: newTransfer.logistics_cost_eur ? parseFloat(newTransfer.logistics_cost_eur) : null,
      expected_arrival_date: newTransfer.expected_arrival_date || null,
      notes: newTransfer.notes || null,
    }).select().single();

    // Immediately deduct from source inventory
    const { data: srcRow } = await supabase.from("inventory_status").select("on_hand_qty")
      .eq("product_id", newTransfer.product_id).eq("distributor_id", newTransfer.from_dist_id).maybeSingle();
    const srcQty = Math.max(0, (srcRow?.on_hand_qty ?? 0) - casesQty);
    if (srcRow) {
      await supabase.from("inventory_status").update({
        on_hand_qty: srcQty,
        status: srcQty <= 0 ? "out" : "in_stock",
        updated_at: new Date().toISOString(),
      }).eq("product_id", newTransfer.product_id).eq("distributor_id", newTransfer.from_dist_id);
    }
    await supabase.from("inventory_movements").insert({
      distributor_id: newTransfer.from_dist_id,
      product_id: newTransfer.product_id,
      movement_type: "transfer_out",
      qty_delta: -casesQty,
    });

    // Reactively update inventory state (source deduction)
    setInventory((prev) => prev.map((row) =>
      row.distributor_id === newTransfer.from_dist_id && row.product_id === newTransfer.product_id
        ? { ...row, on_hand_qty: srcQty, status: (srcQty <= 0 ? "out" : "in_stock") as "in_stock" | "out" }
        : row
    ));

    // Reactively add to inTransitTransfers so stock tab annotation updates immediately
    if (insertedTransfer) {
      const distMap = new Map(allKnownDistributors.map((d) => [d.id, d.name]));
      const productName = inventory.find((r) => r.product_id === newTransfer.product_id)?.product_name || "Unknown";
      setInTransitTransfers((prev) => [...prev, {
        ...insertedTransfer,
        product_name: productName,
        from_dist_name: distMap.get(newTransfer.from_dist_id) || "Unknown",
        to_dist_name: distMap.get(newTransfer.to_dist_id) || "Unknown",
      } as StockTransfer]);
    }

    setTransferSubmitting(false);
    setShowTransferForm(false);
    setNewTransfer({ product_id: "", from_dist_id: "", to_dist_id: "", cases_qty: "", transport_method: "other", transport_note: "", logistics_cost_eur: "", expected_arrival_date: "", notes: "" });
    loadSupply();
  };

  const markTransferArrived = async (t: StockTransfer) => {
    setTransferArrivalError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("stock_transfers")
      .update({ status: "arrived", arrived_at: new Date().toISOString() })
      .eq("id", t.id);
    // Add to destination (source was already deducted when transfer was created)
    const { data: dstExisting } = await supabase.from("inventory_status").select("on_hand_qty")
      .eq("product_id", t.product_id).eq("distributor_id", t.to_dist_id).maybeSingle();
    const dstQty = (dstExisting?.on_hand_qty ?? 0) + t.cases_qty;
    if (dstExisting) {
      await supabase.from("inventory_status").update({
        on_hand_qty: dstQty, status: dstQty <= 0 ? "out" : "in_stock",
        updated_at: new Date().toISOString(),
      }).eq("product_id", t.product_id).eq("distributor_id", t.to_dist_id);
    } else {
      await supabase.from("inventory_status").insert({
        product_id: t.product_id, distributor_id: t.to_dist_id,
        on_hand_qty: dstQty, status: "in_stock",
      });
    }
    // Log arrival movement at destination
    await supabase.from("inventory_movements").insert({
      distributor_id: t.to_dist_id, product_id: t.product_id, movement_type: "transfer_in", qty_delta: t.cases_qty,
    });
    // Reactively update inventory state (destination increase)
    setInventory((prev) => {
      const destExists = prev.some((r) => r.distributor_id === t.to_dist_id && r.product_id === t.product_id);
      if (destExists) {
        return prev.map((row) =>
          row.distributor_id === t.to_dist_id && row.product_id === t.product_id
            ? { ...row, on_hand_qty: dstQty, status: (dstQty <= 0 ? "out" : "in_stock") as "in_stock" | "out" }
            : row
        );
      }
      // If destination had no row yet, reload stock to get full row
      if (stockLoaded) setStockLoaded(false);
      setPlanningLoaded(false);
      return prev;
    });
    loadSupply();
    setInTransitTransfers((prev) => prev.filter((tr) => tr.id !== t.id));
  };

  const cancelTransfer = async (t: StockTransfer) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("stock_transfers").update({ status: "cancelled" }).eq("id", t.id);
    // Restore source stock (cases were deducted when transfer was created)
    const { data: srcRow } = await supabase.from("inventory_status").select("on_hand_qty")
      .eq("product_id", t.product_id).eq("distributor_id", t.from_dist_id).maybeSingle();
    const restoredQty = (srcRow?.on_hand_qty ?? 0) + t.cases_qty;
    if (srcRow) {
      await supabase.from("inventory_status").update({
        on_hand_qty: restoredQty,
        status: "in_stock",
        updated_at: new Date().toISOString(),
      }).eq("product_id", t.product_id).eq("distributor_id", t.from_dist_id);
    }
    await supabase.from("inventory_movements").insert({
      distributor_id: t.from_dist_id, product_id: t.product_id,
      movement_type: "transfer_cancelled", qty_delta: t.cases_qty,
    });
    // Reactively update inventory state (source restoration)
    setInventory((prev) => prev.map((row) =>
      row.distributor_id === t.from_dist_id && row.product_id === t.product_id
        ? { ...row, on_hand_qty: restoredQty, status: "in_stock" as "in_stock" | "out" }
        : row
    ));
    setInTransitTransfers((prev) => prev.filter((tr) => tr.id !== t.id));
    loadSupply();
  };

  const handleSaveQty = async (row: InventoryRow) => {
    if (!editQty) return;
    setSaving(true);
    const newQty = parseInt(editQty);
    const delta = newQty - row.on_hand_qty;
    await Promise.all([
      supabase
        .from("inventory_status")
        .update({
          on_hand_qty: newQty,
          status: newQty <= 0 ? "out" : "in_stock",
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", row.product_id)
        .eq("distributor_id", row.distributor_id),
      supabase.from("inventory_movements").insert({
        distributor_id: row.distributor_id,
        product_id: row.product_id,
        movement_type: "admin_adjustment",
        qty_delta: delta,
      }),
    ]);
    setEditing(null);
    setEditQty("");
    setSaving(false);
    loadStock();
  };

  const openFulfillmentModal = async (order: OrderRow, action: "accept" | "deliver") => {
    setFulfillmentModal({ order, action, stockRows: [], allocation: {}, loading: true, submitting: false });

    const productIds = order.items.map((i) => i.product_id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [invRes, prodsRaw, allDistsRes] = await Promise.all([
      supabase.from("inventory_status").select("product_id, distributor_id, on_hand_qty").in("product_id", productIds),
      (supabase as any).from("products").select("id, bottles_per_case").in("id", productIds),
      supabase.from("partners").select("id, name").eq("partner_type", "distributor").order("name"),
    ]);
    const invData = invRes.data || [];
    const prodsData: { id: string; bottles_per_case: number | null }[] = prodsRaw.data || [];
    const allDists: { id: string; name: string }[] = (allDistsRes.data || []) as { id: string; name: string }[];

    // Build distributor name map from all distributors
    const distNameMap = new Map(allDists.map((d) => [d.id, d.name]));

    const bottlesMap = new Map(prodsData.map((p) => [p.id, p.bottles_per_case]));

    const defaultAllocation: Record<string, Record<string, string>> = {};
    const stockRows: FulfillmentModalState["stockRows"] = order.items.map((item) => {
      // Distributors with stock for this product (sorted desc)
      const withStock = invData
        .filter((r) => r.product_id === item.product_id)
        .map((r) => ({ distributor_id: r.distributor_id, name: distNameMap.get(r.distributor_id) || "Unknown", on_hand_qty: r.on_hand_qty }))
        .sort((a, b) => b.on_hand_qty - a.on_hand_qty);
      const withStockIds = new Set(withStock.map((l) => l.distributor_id));
      // Zero-stock distributors (alphabetical)
      const withoutStock = allDists
        .filter((d) => !withStockIds.has(d.id))
        .map((d) => ({ distributor_id: d.id, name: d.name, on_hand_qty: 0 }));
      const locations = [...withStock, ...withoutStock];
      const totalAvailable = withStock.reduce((s, l) => s + l.on_hand_qty, 0);

      // Fill from largest-stock locations first, up to ordered_qty
      const locAlloc: Record<string, string> = {};
      let remaining = Math.min(totalAvailable, item.cases_qty);
      for (const loc of locations) {
        const take = Math.min(loc.on_hand_qty, remaining);
        locAlloc[loc.distributor_id] = String(take);
        remaining -= take;
        if (remaining <= 0) break;
      }
      // Zero out any locations not yet assigned
      for (const loc of locations) {
        if (!(loc.distributor_id in locAlloc)) locAlloc[loc.distributor_id] = "0";
      }
      defaultAllocation[item.product_id] = locAlloc;

      return {
        product_id: item.product_id,
        product_name: item.product_name,
        ordered_qty: item.cases_qty,
        bottles_per_case: bottlesMap.get(item.product_id) ?? null,
        locations,
        total_available: totalAvailable,
      };
    });

    setFulfillmentModal({ order, action, stockRows, allocation: defaultAllocation, loading: false, submitting: false });
  };

  const handleFulfillmentSubmit = async (splitAction: "hold" | "cancel" | "full") => {
    if (!fulfillmentModal || fulfillmentModal.submitting) return;
    setFulfillmentModal((prev) => prev ? { ...prev, submitting: true } : prev);

    const { order, action, stockRows, allocation } = fulfillmentModal;
    const now = new Date().toISOString();
    const targetStatus = action === "accept" ? "accepted" : "delivered";
    const timestampField = action === "accept" ? "accepted_at" : "delivered_at";

    // Compute per-product committed totals and remainders
    const allocations = stockRows.map((row) => {
      const locMap = allocation[row.product_id] || {};
      const committed_qty = Object.values(locMap).reduce((s, v) => s + (parseInt(v) || 0), 0);
      return {
        product_id: row.product_id,
        committed_qty: Math.min(committed_qty, row.ordered_qty),
        remainder_qty: row.ordered_qty - Math.min(committed_qty, row.ordered_qty),
        loc_map: locMap,
      };
    });
    const hasSplit = allocations.some((a) => a.remainder_qty > 0);
    const allZero = allocations.every((a) => a.committed_qty === 0);
    if (allZero) { setFulfillmentModal((prev) => prev ? { ...prev, submitting: false } : prev); return; }

    // Primary distributor = location with most total allocation
    const distTotals: Record<string, number> = {};
    for (const alloc of allocations) {
      for (const [distId, casesStr] of Object.entries(alloc.loc_map)) {
        distTotals[distId] = (distTotals[distId] || 0) + (parseInt(casesStr) || 0);
      }
    }
    const primaryDistId = Object.entries(distTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    if (hasSplit) {
      for (const alloc of allocations) {
        if (alloc.committed_qty > 0) {
          await supabase.from("order_request_items")
            .update({ cases_qty: alloc.committed_qty })
            .eq("order_request_id", order.id)
            .eq("product_id", alloc.product_id);
        } else {
          await supabase.from("order_request_items")
            .delete()
            .eq("order_request_id", order.id)
            .eq("product_id", alloc.product_id);
        }
      }
    }

    // Update original order status
    await supabase.from("order_requests").update({
      status: targetStatus,
      distributor_id: primaryDistId,
      [timestampField]: now,
      updated_at: now,
    }).eq("id", order.id);

    // Inventory deduction per location if delivering
    if (action === "deliver") {
      for (const alloc of allocations) {
        for (const [distId, casesStr] of Object.entries(alloc.loc_map)) {
          const qty = parseInt(casesStr) || 0;
          if (qty <= 0) continue;
          const { data: existing } = await supabase.from("inventory_status").select("on_hand_qty")
            .eq("product_id", alloc.product_id).eq("distributor_id", distId).maybeSingle();
          const newQty = Math.max(0, (existing?.on_hand_qty ?? 0) - qty);
          if (existing) {
            await supabase.from("inventory_status").update({
              on_hand_qty: newQty, status: newQty <= 0 ? "out" : "in_stock", updated_at: now,
            }).eq("product_id", alloc.product_id).eq("distributor_id", distId);
          }
          await supabase.from("inventory_movements").insert({
            distributor_id: distId, product_id: alloc.product_id,
            movement_type: "order_deliver", qty_delta: -qty, order_request_id: order.id,
          });
        }
      }
    }

    // Create remainder order if split
    if (hasSplit) {
      const { data: userData } = await supabase.auth.getUser();
      const remainderItems = allocations.filter((a) => a.remainder_qty > 0);
      const remainderStatus = splitAction === "cancel" ? "cancelled" : "accepted";

      // Determine or generate group token
      const existingGroupMatch = order.notes?.match(/\[group:([A-Z0-9]+)\]/);
      const groupToken = existingGroupMatch?.[1] ?? Math.random().toString(36).slice(2, 7).toUpperCase();

      // Strip any existing [group:...] prefix from original notes to avoid duplication
      const baseNotes = order.notes?.replace(/\[group:[A-Z0-9]+\]\s*/g, "") || "";

      // Tag original order with group token if not already tagged
      if (!existingGroupMatch) {
        await supabase.from("order_requests").update({
          notes: `[group:${groupToken}]${order.notes ? " " + order.notes : ""}`,
        }).eq("id", order.id);
      }

      const { data: newOrderRow } = await supabase.from("order_requests").insert({
        partner_id: order.partner_id,
        client_id: order.client_id,
        distributor_id: null,
        status: remainderStatus,
        submitted_at: order.submitted_at,
        accepted_at: remainderStatus === "accepted" ? now : null,
        cancelled_at: remainderStatus === "cancelled" ? now : null,
        notes: `[group:${groupToken}] [split from #${order.id.slice(0, 8)}]${baseNotes ? " " + baseNotes : ""}`,
        created_by_user: userData.user?.id ?? order.created_by_user,
        updated_at: now,
      }).select().single();

      if (newOrderRow) {
        await supabase.from("order_request_items").insert(
          remainderItems.map((a) => ({
            order_request_id: newOrderRow.id,
            product_id: a.product_id,
            cases_qty: a.remainder_qty,
          }))
        );
      }
    }

    setFulfillmentModal(null);
    setOrdersLoaded(false);
    loadOrders();
    if (stockLoaded) setStockLoaded(false);
    setPlanningLoaded(false);
  };

  const submitNewOrder = async () => {
    if (!newOrder.client_id || !newOrder.items.some((i) => i.product_id && i.cases_qty)) return;
    setNewOrderSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNewOrderSubmitting(false); return; }
    const now = new Date().toISOString();
    const { data: orderRow, error } = await supabase
      .from("order_requests")
      .insert({
        partner_id: newOrder.client_id,
        client_id: newOrder.client_id,
        distributor_id: null,
        status: "submitted",
        submitted_at: now,
        notes: newOrder.isSample ? `[SAMPLE] ${newOrder.notes}`.trim() : newOrder.notes || null,
        created_by_user: user.id,
      })
      .select()
      .single();
    if (!error && orderRow) {
      const validItems = newOrder.items.filter((i) => i.product_id && i.cases_qty);
      if (validItems.length > 0) {
        await supabase.from("order_request_items").insert(
          validItems.map((i) => ({
            order_request_id: orderRow.id,
            product_id: i.product_id,
            cases_qty: parseInt(i.cases_qty),
            price_per_case: i.price_per_case ? parseFloat(i.price_per_case) : null,
          }))
        );
      }
    }
    setNewOrderSubmitting(false);
    setShowNewOrderForm(false);
    setNewOrder({
      client_id: "",
      items: [{ product_id: "", cases_qty: "", price_per_case: "" }],
      notes: "",
      isSample: false,
    });
    setOrdersLoaded(false);
    loadOrders();
  };

  const loadDestructionStock = async (distributor_id: string, product_id: string) => {
    if (!distributor_id || !product_id) { setDestructionAvailableStock(null); return; }
    const { data } = await supabase
      .from("inventory_status")
      .select("on_hand_qty")
      .eq("product_id", product_id)
      .eq("distributor_id", distributor_id)
      .maybeSingle();
    setDestructionAvailableStock(data?.on_hand_qty ?? 0);
  };

  const confirmCancelDestruction = async () => {
    if (!cancelDestructionModal) return;
    setCancelDestructionModal((p) => p ? { ...p, submitting: true } : p);
    const { order, restore_to_distributor_id } = cancelDestructionModal;
    const now = new Date().toISOString();

    for (const item of order.items) {
      const { data: existing } = await supabase
        .from("inventory_status")
        .select("on_hand_qty")
        .eq("product_id", item.product_id)
        .eq("distributor_id", restore_to_distributor_id)
        .maybeSingle();
      const newQty = (existing?.on_hand_qty ?? 0) + item.cases_qty;
      if (existing) {
        await supabase.from("inventory_status").update({
          on_hand_qty: newQty,
          status: "in_stock",
          updated_at: now,
        }).eq("product_id", item.product_id).eq("distributor_id", restore_to_distributor_id);
      } else {
        await supabase.from("inventory_status").insert({
          product_id: item.product_id,
          distributor_id: restore_to_distributor_id,
          on_hand_qty: newQty,
          status: "in_stock",
        });
      }
      await supabase.from("inventory_movements").insert({
        distributor_id: restore_to_distributor_id,
        product_id: item.product_id,
        movement_type: "order_cancel_reversal",
        qty_delta: item.cases_qty,
        order_request_id: order.id,
      });
    }

    await supabase.from("order_requests")
      .update({ status: "cancelled", cancelled_at: now })
      .eq("id", order.id);

    setCancelDestructionModal(null);
    setOrdersLoaded(false);
    setStockLoaded(false);
    setPlanningLoaded(false);
    loadOrders();
  };

  const submitDestruction = async () => {
    const { distributor_id, product_id, cases_qty, reason } = newDestruction;
    if (!distributor_id || !product_id || !cases_qty) return;
    // Re-validate stock before submitting
    const { data: stockRow } = await supabase
      .from("inventory_status")
      .select("on_hand_qty")
      .eq("product_id", product_id)
      .eq("distributor_id", distributor_id)
      .maybeSingle();
    const available = stockRow?.on_hand_qty ?? 0;
    if (available <= 0 || parseInt(cases_qty) > available) {
      setDestructionAvailableStock(available);
      return;
    }
    setDestructionSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDestructionSubmitting(false); return; }
    const now = new Date().toISOString();
    const cases = parseInt(cases_qty);

    // Create order record (status = delivered immediately, partner = distributor)
    const { data: orderRow } = await supabase
      .from("order_requests")
      .insert({
        partner_id: distributor_id,
        distributor_id,
        client_id: null,
        status: "delivered",
        submitted_at: now,
        delivered_at: now,
        notes: `[DESTROYED] ${reason}`,
        created_by_user: user.id,
      })
      .select()
      .single();

    if (orderRow) {
      await supabase.from("order_request_items").insert({
        order_request_id: orderRow.id,
        product_id,
        cases_qty: cases,
        price_per_case: null,
      });

      // Deduct from distributor stock
      const { data: existing } = await supabase
        .from("inventory_status")
        .select("on_hand_qty")
        .eq("product_id", product_id)
        .eq("distributor_id", distributor_id)
        .maybeSingle();

      const newQty = Math.max(0, (existing?.on_hand_qty ?? 0) - cases);
      if (existing) {
        await supabase.from("inventory_status").update({
          on_hand_qty: newQty,
          status: newQty <= 0 ? "out" : "in_stock",
          updated_at: now,
        }).eq("product_id", product_id).eq("distributor_id", distributor_id);
      }

      await supabase.from("inventory_movements").insert({
        distributor_id,
        product_id,
        movement_type: "destroyed",
        qty_delta: -cases,
        order_request_id: orderRow.id,
      });
    }

    setDestructionSubmitting(false);
    setShowDestructionForm(false);
    setNewDestruction({ distributor_id: "", product_id: "", cases_qty: "", reason: "broken" });
    setDestructionAvailableStock(null);
    setOrdersLoaded(false);
    setStockLoaded(false);
    setPlanningLoaded(false);
    loadOrders();
  };

  const markArrived = async (so: SupplyOrder) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("supply_orders")
      .update({ status: "arrived", arrived_at: new Date().toISOString() })
      .eq("id", so.id);

    if (so.distributor_id) {
      const { data: existing } = await supabase
        .from("inventory_status")
        .select("on_hand_qty")
        .eq("product_id", so.product_id)
        .eq("distributor_id", so.distributor_id)
        .maybeSingle();

      const newQty = (existing?.on_hand_qty || 0) + so.cases_ordered;
      if (existing) {
        await supabase
          .from("inventory_status")
          .update({
            on_hand_qty: newQty,
            status: newQty <= 0 ? "out" : "in_stock",
            updated_at: new Date().toISOString(),
          })
          .eq("product_id", so.product_id)
          .eq("distributor_id", so.distributor_id);
      } else {
        await supabase.from("inventory_status").insert({
          product_id: so.product_id,
          distributor_id: so.distributor_id,
          on_hand_qty: newQty,
          status: "in_stock",
        });
      }

      await supabase.from("inventory_movements").insert({
        distributor_id: so.distributor_id,
        product_id: so.product_id,
        movement_type: "supply_received",
        qty_delta: so.cases_ordered,
      });
    }

    loadSupply();
    // Invalidate stock and planning if loaded
    if (stockLoaded) setStockLoaded(false);
    setPlanningLoaded(false);
  };

  const cancelSupplyOrder = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("supply_orders")
      .update({ status: "cancelled" })
      .eq("id", id);
    loadSupply();
  };

  const submitNewSupplyOrder = async () => {
    if (!newSupply.product_id || !newSupply.supplier_id || !newSupply.cases_ordered)
      return;
    setSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("supply_orders").insert({
      product_id: newSupply.product_id,
      supplier_id: newSupply.supplier_id,
      distributor_id: newSupply.distributor_id || null,
      cases_ordered: parseInt(newSupply.cases_ordered),
      unit_cost_eur: newSupply.unit_cost_eur
        ? parseFloat(newSupply.unit_cost_eur)
        : null,
      expected_arrival_date: newSupply.expected_arrival_date || null,
      notes: newSupply.notes || null,
    });
    setSubmitting(false);
    setShowSupplyForm(false);
    setNewSupply({
      product_id: "",
      supplier_id: "",
      distributor_id: "",
      cases_ordered: "",
      unit_cost_eur: "",
      expected_arrival_date: "",
      notes: "",
    });
    loadSupply();
  };

  const openSupplyForProduct = (productId: string, supplierId: string) => {
    setActiveTab("supply");
    setShowSupplyForm(true);
    setNewSupply((prev) => ({ ...prev, product_id: productId, supplier_id: supplierId }));
    if (!supplyLoaded) loadSupply();
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  const criticalCount = productRows.filter((r) => r.runway_status === "critical").length;
  const lowCount = productRows.filter((r) => r.runway_status === "low").length;

  const stockDistributors = useMemo(() => {
    if (allKnownDistributors.length > 0) return allKnownDistributors;
    // Fallback before stock tab has loaded allKnownDistributors
    const seen = new Map<string, string>();
    inventory.forEach((i) => seen.set(i.distributor_id, i.distributor_name));
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [allKnownDistributors, inventory]);

  const filteredStock = inventory.filter((i) => {
    const matchesSearch =
      i.distributor_name.toLowerCase().includes(stockSearch.toLowerCase()) ||
      i.product_name.toLowerCase().includes(stockSearch.toLowerCase());
    const matchesStatus =
      stockStatusFilter === "all" || i.status === stockStatusFilter;
    const matchesDist =
      stockDistributorFilter === "all" || i.distributor_id === stockDistributorFilter;
    return matchesSearch && matchesStatus && matchesDist;
  });

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(ordersSearch.toLowerCase()) ||
      o.partner_name.toLowerCase().includes(ordersSearch.toLowerCase()) ||
      (o.distributor_name || "").toLowerCase().includes(ordersSearch.toLowerCase()) ||
      o.delivery_distributors.some((d) => d.name.toLowerCase().includes(ordersSearch.toLowerCase()));
    const matchesStatus =
      ordersStatusFilter === "all" || o.status === ordersStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredSupply = supplyOrders.filter(
    (s) => supplyStatusFilter === "all" || s.status === supplyStatusFilter
  );

  const totalCost = newSupply.cases_ordered && newSupply.unit_cost_eur
    ? (parseFloat(newSupply.cases_ordered) * parseFloat(newSupply.unit_cost_eur)).toFixed(2)
    : null;

  // ─── Loading skeleton ──────────────────────────────────────────────────────

  const skeleton = (
    <div className="space-y-3 mt-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="mc-skeleton h-12" />
      ))}
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Operations"
        description={
          criticalCount > 0
            ? `${criticalCount} product${criticalCount > 1 ? "s" : ""} critically low`
            : lowCount > 0
            ? `${lowCount} product${lowCount > 1 ? "s" : ""} running low`
            : "Inventory, orders & supply management"
        }
        icon={Layers}
      />

      {/* Tab bar */}
      <div
        className="flex mb-6 -mt-2"
        style={{ borderBottom: "1px solid var(--mc-border)" }}
      >
        <TabBtn
          active={activeTab === "planning"}
          onClick={() => setActiveTab("planning")}
          icon={TrendingUp}
        >
          Planning
        </TabBtn>
        <TabBtn
          active={activeTab === "stock"}
          onClick={() => setActiveTab("stock")}
          icon={Warehouse}
        >
          Stock
        </TabBtn>
        <TabBtn
          active={activeTab === "orders"}
          onClick={() => setActiveTab("orders")}
          icon={ClipboardList}
        >
          Orders
        </TabBtn>
        <TabBtn
          active={activeTab === "supply"}
          onClick={() => setActiveTab("supply")}
          icon={Truck}
        >
          Supply Orders
        </TabBtn>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: PLANNING
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "planning" && (
        <div>
          {planningLoading ? (
            skeleton
          ) : productRows.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No active products"
              description="Add active products to see planning data"
            />
          ) : (
            <>
              {/* Stock Runway */}
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
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ color: "var(--mc-text-muted)" }}
                  >
                    Months of supply remaining · based on trailing 90-day demand rate
                  </p>
                </div>
                <table className="mc-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Supplier</th>
                      <th>In Stock</th>
                      <th>In Transit</th>
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
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = "var(--mc-cream)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color = "var(--mc-cream-subtle)")
                            }
                          >
                            {row.name}
                          </Link>
                          {row.brand && (
                            <p
                              className="text-[10px]"
                              style={{ color: "var(--mc-text-muted)" }}
                            >
                              {row.brand}
                            </p>
                          )}
                        </td>
                        <td>
                          {row.supplier_id && row.supplier_name ? (
                            <Link
                              href={`/partners/${row.supplier_id}`}
                              className="inline-flex items-center gap-1 text-xs transition-colors"
                              style={{ color: "var(--mc-text-secondary)" }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.color =
                                  "var(--mc-cream-subtle)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color =
                                  "var(--mc-text-secondary)")
                              }
                            >
                              <Factory className="w-3 h-3 flex-shrink-0" />
                              {row.supplier_name}
                            </Link>
                          ) : (
                            <span
                              className="text-xs"
                              style={{ color: "var(--mc-text-muted)" }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="text-xs">{row.in_stock} cs</span>
                        </td>
                        <td>
                          {row.in_transit > 0 ? (
                            <span className="text-xs" style={{ color: "var(--mc-warning)" }}>
                              {row.in_transit} cs
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <span
                            className="text-xs"
                            style={{
                              color:
                                row.open_demand > 0
                                  ? "var(--mc-warning)"
                                  : "var(--mc-text-muted)",
                            }}
                          >
                            {row.open_demand > 0
                              ? `${row.open_demand} cs`
                              : "—"}
                          </span>
                        </td>
                        <td>
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--mc-text-primary)" }}
                          >
                            {row.available} cs
                          </span>
                        </td>
                        <td>
                          <span
                            className="text-xs"
                            style={{ color: "var(--mc-text-secondary)" }}
                          >
                            {row.monthly_rate > 0
                              ? `${row.monthly_rate.toFixed(1)} cs/mo`
                              : "—"}
                          </span>
                        </td>
                        <td>
                          <RunwayBadge
                            status={row.runway_status}
                            months={row.runway_months}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Buyer Patterns + Reorder Planner */}
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
                    <p
                      className="text-[10px] mt-0.5"
                      style={{ color: "var(--mc-text-muted)" }}
                    >
                      Auto-classified · recurring buyers allow forward stock commitment
                    </p>
                  </div>
                  {buyerPatterns.length === 0 ? (
                    <p
                      className="px-5 py-4 text-xs"
                      style={{ color: "var(--mc-text-muted)" }}
                    >
                      No active buyers
                    </p>
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
                            bp.next_expected_date &&
                            new Date(bp.next_expected_date) < new Date();
                          return (
                            <tr key={bp.client_id}>
                              <td>
                                <Link
                                  href={`/partners/${bp.client_id}`}
                                  className="text-xs font-medium transition-colors"
                                  style={{ color: "var(--mc-cream-subtle)" }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.color =
                                      "var(--mc-cream)")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.color =
                                      "var(--mc-cream-subtle)")
                                  }
                                >
                                  {bp.client_name}
                                </Link>
                              </td>
                              <td>
                                <span
                                  className="text-xs"
                                  style={{ color: "var(--mc-text-secondary)" }}
                                >
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
                                <PatternBadge
                                  pattern={bp.pattern}
                                  intervalDays={bp.avg_interval_days}
                                />
                              </td>
                              <td>
                                {bp.next_expected_date ? (
                                  <span
                                    className="text-xs"
                                    style={{
                                      color: isOverdue
                                        ? "var(--mc-warning)"
                                        : "var(--mc-text-secondary)",
                                    }}
                                  >
                                    {isOverdue ? "Overdue · " : ""}
                                    {fmtDate(bp.next_expected_date)}
                                  </span>
                                ) : (
                                  <span
                                    className="text-xs"
                                    style={{ color: "var(--mc-text-muted)" }}
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                              <td>
                                <Link
                                  href={`/partners/${bp.client_id}`}
                                  className="inline-flex items-center gap-1 text-[11px] transition-colors"
                                  style={{ color: "var(--mc-cream-subtle)" }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.color =
                                      "var(--mc-cream)")
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
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Reorder Planner */}
                <div className="mc-card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3
                        className="text-xs font-semibold tracking-[0.08em] uppercase mb-0.5"
                        style={{ color: "var(--mc-text-muted)" }}
                      >
                        Reorder Planner
                      </h3>
                      <p
                        className="text-[10px]"
                        style={{ color: "var(--mc-text-muted)" }}
                      >
                        Suggested to cover target stock
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--mc-text-muted)" }}
                      >
                        Target:
                      </span>
                      <select
                        value={targetMonths}
                        onChange={(e) =>
                          setTargetMonths(parseInt(e.target.value))
                        }
                        style={{
                          fontSize: "0.6875rem",
                          padding: "2px 6px",
                          border: "1px solid var(--mc-border)",
                          background: "var(--mc-surface-elevated)",
                          color: "var(--mc-cream)",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        {[1, 2, 3, 4, 6, 9, 12].map((m) => (
                          <option key={m} value={m}>
                            {m} mo
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

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
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = "var(--mc-cream)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color =
                                "var(--mc-cream-subtle)")
                            }
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
                                  background:
                                    item.runway_status === "critical"
                                      ? "var(--mc-error-bg)"
                                      : "var(--mc-warning-bg)",
                                  border: `1px solid ${
                                    item.runway_status === "critical"
                                      ? "var(--mc-error-light)"
                                      : "var(--mc-warning-light)"
                                  }`,
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <Link
                                      href={`/products/${item.product_id}`}
                                      className="text-xs font-medium transition-colors block"
                                      style={{ color: "var(--mc-text-primary)" }}
                                      onMouseEnter={(e) =>
                                        (e.currentTarget.style.color =
                                          "var(--mc-cream)")
                                      }
                                      onMouseLeave={(e) =>
                                        (e.currentTarget.style.color =
                                          "var(--mc-text-primary)")
                                      }
                                    >
                                      {item.product_name}
                                    </Link>
                                    <p
                                      className="text-[10px] mt-0.5"
                                      style={{ color: "var(--mc-text-muted)" }}
                                    >
                                      {item.runway_months < 0.5
                                        ? "Stock critically low"
                                        : `${item.runway_months.toFixed(1)} mo runway`}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                    <span
                                      className="text-xs font-semibold"
                                      style={{
                                        color:
                                          item.runway_status === "critical"
                                            ? "var(--mc-error)"
                                            : "var(--mc-warning)",
                                      }}
                                    >
                                      {item.suggested_cases} cs
                                    </span>
                                    <button
                                      onClick={() =>
                                        openSupplyForProduct(
                                          item.product_id,
                                          group.supplier_id
                                        )
                                      }
                                      className="text-[10px] tracking-wide transition-colors"
                                      style={{ color: "var(--mc-cream-subtle)" }}
                                      onMouseEnter={(e) =>
                                        (e.currentTarget.style.color =
                                          "var(--mc-cream)")
                                      }
                                      onMouseLeave={(e) =>
                                        (e.currentTarget.style.color =
                                          "var(--mc-cream-subtle)")
                                      }
                                    >
                                      + Order
                                    </button>
                                  </div>
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
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: STOCK
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "stock" && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
              {inventory.length} stock record{inventory.length !== 1 ? "s" : ""} across distributors
            </p>
            <button
              onClick={() => setShowMovements(!showMovements)}
              className="mc-btn mc-btn-ghost"
            >
              <History className="w-3.5 h-3.5" />
              {showMovements ? "Stock Levels" : "Movement Log"}
            </button>
          </div>

          {stockLoading ? (
            skeleton
          ) : !showMovements ? (
            <>
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                    style={{ color: "var(--mc-text-muted)" }}
                  />
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="mc-input pl-9"
                    placeholder="Search product or distributor..."
                  />
                </div>
                <select
                  value={stockDistributorFilter}
                  onChange={(e) => setStockDistributorFilter(e.target.value)}
                  className="mc-input mc-select w-auto min-w-[160px]"
                >
                  <option value="all">All Locations</option>
                  {stockDistributors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <select
                  value={stockStatusFilter}
                  onChange={(e) => setStockStatusFilter(e.target.value)}
                  className="mc-input mc-select w-auto min-w-[140px]"
                >
                  <option value="all">All Status</option>
                  <option value="in_stock">In Stock</option>
                  <option value="out">Out of Stock</option>
                </select>
              </div>

              {/* In Transit card */}
              {inTransitTransfers.length > 0 && (
                <div className="mc-card overflow-hidden mb-5">
                  <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--mc-border)" }}>
                    <Truck className="w-3.5 h-3.5" style={{ color: "var(--mc-warning)" }} />
                    <h3 className="text-xs font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
                      In Transit
                    </h3>
                    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--mc-warning-bg)", border: "1px solid var(--mc-warning-light)", color: "var(--mc-warning)" }}>
                      {inTransitTransfers.length}
                    </span>
                  </div>
                  <table className="mc-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Route</th>
                        <th>Cases</th>
                        <th>Method</th>
                        <th>Expected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inTransitTransfers.map((t) => (
                        <tr key={t.id}>
                          <td><span className="text-xs font-medium" style={{ color: "var(--mc-text-primary)" }}>{t.product_name}</span></td>
                          <td>
                            <span className="text-xs inline-flex items-center gap-1" style={{ color: "var(--mc-text-secondary)" }}>
                              {t.from_dist_name} <MoveRight className="w-3 h-3 flex-shrink-0" style={{ color: "var(--mc-text-muted)" }} /> {t.to_dist_name}
                            </span>
                          </td>
                          <td><span className="text-xs">{t.cases_qty} cs</span></td>
                          <td>
                            <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
                              {t.transport_method === "car" ? "By car" : t.transport_method === "train" ? "By train" : t.transport_method === "dhl" ? "DHL" : "Other"}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                              {t.expected_arrival_date ? new Date(t.expected_arrival_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredStock.length === 0 ? (
                <EmptyState
                  icon={Warehouse}
                  title="No inventory records"
                  description="Inventory records appear when products are allocated to distributors"
                />
              ) : (
                <div className="mc-card overflow-hidden">
                  <table className="mc-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Distributor</th>
                        <th>On Hand</th>
                        <th>Status</th>
                        <th>Updated</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStock.map((row) => {
                        const key = `${row.product_id}-${row.distributor_id}`;
                        const isEditing = editing === key;
                        return (
                          <tr key={key}>
                            <td>
                              <span
                                className="text-xs font-medium"
                                style={{ color: "var(--mc-text-primary)" }}
                              >
                                {row.product_name}
                              </span>
                            </td>
                            <td>{row.distributor_name}</td>
                            <td>
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={editQty}
                                    onChange={(e) => setEditQty(e.target.value)}
                                    className="mc-input w-20"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveQty(row)}
                                    disabled={saving}
                                    className="mc-btn mc-btn-primary"
                                    style={{ padding: "4px 8px" }}
                                  >
                                    <Save className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => setEditing(null)}
                                    className="mc-btn mc-btn-ghost"
                                    style={{ padding: "4px 8px" }}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                  <span
                                    className="text-sm font-medium cursor-pointer underline decoration-dotted"
                                    style={{ color: "var(--mc-text-primary)" }}
                                    onClick={() => {
                                      setEditing(key);
                                      setEditQty(row.on_hand_qty.toString());
                                    }}
                                    title="Click to edit"
                                  >
                                    {row.on_hand_qty} cs
                                  </span>
                                  {(() => {
                                    const transitIn = inTransitTransfers
                                      .filter((t) => t.to_dist_id === row.distributor_id && t.product_id === row.product_id)
                                      .reduce((sum, t) => sum + t.cases_qty, 0);
                                    return transitIn > 0 ? (
                                      <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                                        +{transitIn} arriving
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                              )}
                            </td>
                            <td>
                              <StockBadge status={row.status} />
                            </td>
                            <td>
                              {new Date(row.updated_at).toLocaleDateString(
                                "en-GB",
                                { day: "2-digit", month: "short" }
                              )}
                            </td>
                            <td>
                              {row.note && (
                                <span
                                  className="text-[10px]"
                                  style={{ color: "var(--mc-text-muted)" }}
                                  title={row.note}
                                >
                                  note
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="mc-card overflow-hidden">
              <table className="mc-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Distributor</th>
                    <th>Type</th>
                    <th>Qty Change</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-8 text-xs"
                        style={{ color: "var(--mc-text-muted)" }}
                      >
                        No movement history
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id}>
                        <td>
                          {new Date(m.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>{m.product_name}</td>
                        <td>{m.distributor_name}</td>
                        <td>
                          <span
                            className="text-[10px] font-medium tracking-wide uppercase"
                            style={{ color: "var(--mc-text-tertiary)" }}
                          >
                            {m.movement_type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              color:
                                m.qty_delta > 0
                                  ? "var(--mc-success)"
                                  : "var(--mc-error)",
                            }}
                          >
                            {m.qty_delta > 0 ? "+" : ""}
                            {m.qty_delta}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: ORDERS
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "orders" && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
              {orders.length} total order{orders.length !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDestructionForm(!showDestructionForm); setShowNewOrderForm(false); }}
                className="mc-btn mc-btn-ghost"
                style={{ color: showDestructionForm ? "var(--mc-error)" : undefined, borderColor: showDestructionForm ? "var(--mc-error-light)" : undefined }}
              >
                {showDestructionForm ? <><X className="w-3.5 h-3.5" />Cancel</> : <>⚠ Log Destruction</>}
              </button>
              <button
                onClick={() => { setShowNewOrderForm(!showNewOrderForm); setShowDestructionForm(false); }}
                className="mc-btn mc-btn-primary"
              >
                {showNewOrderForm ? <><X className="w-3.5 h-3.5" />Cancel</> : <><Plus className="w-3.5 h-3.5" />New Order</>}
              </button>
            </div>
          </div>

          {/* Destruction form */}
          {showDestructionForm && (
            <div className="mc-card p-5 mb-5" style={{ border: "1px solid var(--mc-error-light)" }}>
              <h3 className="text-xs font-semibold tracking-[0.08em] uppercase mb-4" style={{ color: "var(--mc-error)" }}>
                Log Destroyed Bottles
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="mc-label mb-1">Distributor *</p>
                  <select
                    value={newDestruction.distributor_id}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNewDestruction((p) => ({ ...p, distributor_id: v }));
                      setDestructionAvailableStock(null);
                      if (v && newDestruction.product_id) loadDestructionStock(v, newDestruction.product_id);
                    }}
                    className="mc-input mc-select w-full"
                  >
                    <option value="">Select distributor…</option>
                    {allOrderDistributors.filter((d) => !d.is_mecanova).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mc-label mb-1">Product *</p>
                  <select
                    value={newDestruction.product_id}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNewDestruction((p) => ({ ...p, product_id: v }));
                      setDestructionAvailableStock(null);
                      if (v && newDestruction.distributor_id) loadDestructionStock(newDestruction.distributor_id, v);
                    }}
                    className="mc-input mc-select w-full"
                  >
                    <option value="">Select product…</option>
                    {allOrderProducts.map((pr) => (
                      <option key={pr.id} value={pr.id}>{pr.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mc-label mb-1">Cases *</p>
                  <input
                    type="number"
                    min={1}
                    max={destructionAvailableStock ?? undefined}
                    value={newDestruction.cases_qty}
                    onChange={(e) => setNewDestruction((p) => ({ ...p, cases_qty: e.target.value }))}
                    className="mc-input w-full"
                    placeholder="Number of cases"
                  />
                  {destructionAvailableStock !== null && (
                    <p className="text-[10px] mt-1" style={{
                      color: destructionAvailableStock === 0 ? "var(--mc-error)" : "var(--mc-text-muted)"
                    }}>
                      {destructionAvailableStock === 0
                        ? "No stock available for this distributor"
                        : `Available: ${destructionAvailableStock} case${destructionAvailableStock !== 1 ? "s" : ""}`}
                    </p>
                  )}
                  {destructionAvailableStock !== null && newDestruction.cases_qty && parseInt(newDestruction.cases_qty) > destructionAvailableStock && (
                    <p className="text-[10px] mt-1" style={{ color: "var(--mc-error)" }}>
                      Cannot destroy more than available stock
                    </p>
                  )}
                </div>
                <div>
                  <p className="mc-label mb-1">Reason</p>
                  <select
                    value={newDestruction.reason}
                    onChange={(e) => setNewDestruction((p) => ({ ...p, reason: e.target.value }))}
                    className="mc-input mc-select w-full"
                  >
                    {(["broken", "damaged", "lost", "other"] as const).map((r) => (
                      <option key={r} value={r}>{INVENTORY_ADJUSTMENT_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={submitDestruction}
                  disabled={
                    destructionSubmitting ||
                    !newDestruction.distributor_id ||
                    !newDestruction.product_id ||
                    !newDestruction.cases_qty ||
                    destructionAvailableStock === 0 ||
                    (destructionAvailableStock !== null && parseInt(newDestruction.cases_qty) > destructionAvailableStock)
                  }
                  className="mc-btn mc-btn-primary"
                  style={{ background: "var(--mc-error)", borderColor: "var(--mc-error)" }}
                >
                  {destructionSubmitting ? "Saving…" : "Confirm Destruction"}
                </button>
                <button onClick={() => setShowDestructionForm(false)} className="mc-btn mc-btn-ghost">Cancel</button>
              </div>
            </div>
          )}

          {/* New order form */}
          {showNewOrderForm && (
            <div
              className="mc-card p-5 mb-5"
              style={{ border: "1px solid var(--mc-cream-subtle)" }}
            >
              <h3
                className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
                style={{ color: "var(--mc-text-muted)" }}
              >
                New Order (on behalf of client)
              </h3>
              <div className="mb-4">
                <p className="mc-label mb-1">Client *</p>
                <select
                  value={newOrder.client_id}
                  onChange={(e) => setNewOrder((p) => ({ ...p, client_id: e.target.value }))}
                  className="mc-input mc-select w-full sm:w-1/2"
                >
                  <option value="">Select client…</option>
                  {allClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <p className="mc-label mb-2">Products *</p>
                <div className="space-y-2">
                  {newOrder.items.map((item, idx) => {
                    const lineVolume =
                      item.cases_qty && item.price_per_case
                        ? parseFloat(item.cases_qty) * parseFloat(item.price_per_case)
                        : null;
                    return (
                      <div key={idx} className="flex gap-2 items-center flex-wrap">
                        <select
                          value={item.product_id}
                          onChange={(e) => setNewOrder((p) => {
                            const items = [...p.items];
                            items[idx] = { ...items[idx], product_id: e.target.value };
                            return { ...p, items };
                          })}
                          className="mc-input mc-select flex-1 min-w-[140px]"
                        >
                          <option value="">Select product…</option>
                          {allOrderProducts.map((pr) => (
                            <option key={pr.id} value={pr.id}>{pr.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={item.cases_qty}
                          onChange={(e) => setNewOrder((p) => {
                            const items = [...p.items];
                            items[idx] = { ...items[idx], cases_qty: e.target.value };
                            return { ...p, items };
                          })}
                          className="mc-input w-20"
                          placeholder="Cases"
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.price_per_case}
                          onChange={(e) => setNewOrder((p) => {
                            const items = [...p.items];
                            items[idx] = { ...items[idx], price_per_case: e.target.value };
                            return { ...p, items };
                          })}
                          className="mc-input w-28"
                          placeholder="€/case"
                        />
                        {lineVolume !== null && (
                          <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: "var(--mc-cream)" }}>
                            = €{lineVolume.toFixed(2)}
                          </span>
                        )}
                        {newOrder.items.length > 1 && (
                          <button
                            onClick={() => setNewOrder((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}
                            className="mc-btn mc-btn-ghost"
                            style={{ padding: "6px" }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  const total = newOrder.items.reduce((sum, i) => {
                    const v = i.cases_qty && i.price_per_case ? parseFloat(i.cases_qty) * parseFloat(i.price_per_case) : 0;
                    return sum + v;
                  }, 0);
                  return total > 0 ? (
                    <div className="mt-3 px-3 py-2 text-xs font-semibold" style={{ background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)", color: "var(--mc-cream)" }}>
                      Order Volume: €{total.toFixed(2)}
                    </div>
                  ) : null;
                })()}
                <button
                  onClick={() => setNewOrder((p) => ({ ...p, items: [...p.items, { product_id: "", cases_qty: "", price_per_case: "" }] }))}
                  className="mt-2 text-[11px] transition-colors"
                  style={{ color: "var(--mc-cream-subtle)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                >
                  + Add Product
                </button>
              </div>
              <div className="mb-4">
                <p className="mc-label mb-1">Notes</p>
                <input
                  type="text"
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder((p) => ({ ...p, notes: e.target.value }))}
                  className="mc-input w-full"
                  placeholder="Optional notes…"
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2.5 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={newOrder.isSample}
                    onChange={(e) => setNewOrder((p) => ({ ...p, isSample: e.target.checked }))}
                    className="w-3.5 h-3.5 accent-amber-400"
                  />
                  <span className="text-[11px] font-medium tracking-wide" style={{ color: "var(--mc-warning)" }}>
                    Mark as sample bottle
                  </span>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={submitNewOrder}
                  disabled={newOrderSubmitting || !newOrder.client_id || !newOrder.items.some((i) => i.product_id && i.cases_qty)}
                  className="mc-btn mc-btn-primary"
                >
                  <Check className="w-3.5 h-3.5" />
                  {newOrderSubmitting ? "Saving…" : "Create Order"}
                </button>
                <button
                  onClick={() => setShowNewOrderForm(false)}
                  className="mc-btn mc-btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {ordersLoading ? (
            skeleton
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                    style={{ color: "var(--mc-text-muted)" }}
                  />
                  <input
                    type="text"
                    value={ordersSearch}
                    onChange={(e) => setOrdersSearch(e.target.value)}
                    className="mc-input pl-9"
                    placeholder="Search by ID or partner..."
                  />
                </div>
                <select
                  value={ordersStatusFilter}
                  onChange={(e) => setOrdersStatusFilter(e.target.value)}
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

              {filteredOrders.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No orders found"
                  description={
                    ordersSearch || ordersStatusFilter !== "all"
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
                        <th>Items</th>
                        <th>Price/Case</th>
                        <th>Order Volume</th>
                        <th>Distributor</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <div className="flex flex-col gap-0.5">
                              <span
                                className="text-xs font-mono"
                                style={{ color: "var(--mc-text-secondary)" }}
                              >
                                {order.id.slice(0, 8)}
                              </span>
                              {order.notes?.startsWith("[DESTROYED]") && (
                                <span
                                  className="text-[10px] font-semibold tracking-wide"
                                  style={{
                                    color: "var(--mc-error)",
                                    background: "var(--mc-error-bg)",
                                    border: "1px solid var(--mc-error-light)",
                                    padding: "0 4px",
                                    display: "inline-block",
                                    width: "fit-content",
                                  }}
                                >
                                  DESTROYED
                                </span>
                              )}
                              {order.notes?.startsWith("[SAMPLE]") && (
                                <span
                                  className="text-[10px] font-semibold tracking-wide"
                                  style={{
                                    color: "var(--mc-warning)",
                                    background: "var(--mc-warning-bg)",
                                    border: "1px solid var(--mc-warning-light)",
                                    padding: "0 4px",
                                    display: "inline-block",
                                    width: "fit-content",
                                  }}
                                >
                                  SAMPLE
                                </span>
                              )}
                              {order.notes && !order.notes.startsWith("[SAMPLE]") && (() => {
                                const groupMatch = order.notes.match(/\[group:([A-Z0-9]+)\]/);
                                return groupMatch ? (
                                  <span
                                    className="text-[10px] font-medium tracking-wide font-mono"
                                    style={{
                                      color: "var(--mc-text-muted)",
                                      border: "1px solid var(--mc-border)",
                                      padding: "0 4px",
                                      display: "inline-block",
                                      width: "fit-content",
                                    }}
                                    title="Part of a split order group"
                                  >
                                    GRP:{groupMatch[1]}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </td>
                          <td>
                            {order.notes?.startsWith("[DESTROYED]") ? (
                              <span className="text-xs font-semibold" style={{ color: "var(--mc-error)" }}>Destroyed</span>
                            ) : (
                              <span className="text-xs">{order.partner_name}</span>
                            )}
                          </td>
                          <td>
                            <span
                              className="text-xs"
                              style={{ color: "var(--mc-text-secondary)" }}
                            >
                              {order.items.length === 0
                                ? <span style={{ color: "var(--mc-text-muted)" }}>—</span>
                                : <>
                                    {order.items.slice(0, 2).map((item, i) => (
                                      <span key={i}>
                                        {i > 0 && ", "}
                                        {item.product_name} ×{item.cases_qty}
                                      </span>
                                    ))}
                                    {order.items.length > 2 && (
                                      <span style={{ color: "var(--mc-text-muted)" }}>
                                        {" "}+{order.items.length - 2} more
                                      </span>
                                    )}
                                  </>
                              }
                            </span>
                          </td>
                          <td>
                            <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
                              {order.items.length === 1 && order.items[0].price_per_case != null
                                ? `€${order.items[0].price_per_case.toFixed(2)}`
                                : order.items.length > 1 && order.items.every((i) => i.price_per_case != null)
                                ? "Mixed"
                                : "—"}
                            </span>
                          </td>
                          <td>
                            {(() => {
                              const vol = order.items.reduce((sum, i) => {
                                return i.price_per_case != null ? sum + i.cases_qty * i.price_per_case : sum;
                              }, 0);
                              return vol > 0
                                ? <span className="text-xs font-medium" style={{ color: "var(--mc-cream)" }}>€{vol.toFixed(2)}</span>
                                : <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>—</span>;
                            })()}
                          </td>
                          <td>
                            <span
                              className="text-xs"
                              style={{ color: "var(--mc-text-muted)" }}
                            >
                              {order.delivery_distributors.length > 0
                                ? order.delivery_distributors.map((d) => `${d.name} (${d.cases}cs)`).join(" · ")
                                : order.distributor_name || "—"}
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={order.status} />
                          </td>
                          <td>
                            <span className="text-xs">
                              {new Date(order.created_at).toLocaleDateString(
                                "en-GB",
                                { day: "2-digit", month: "short" }
                              )}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-3 flex-wrap">
                              {!order.notes?.startsWith("[DESTROYED]") && order.status === "submitted" && (
                                <>
                                  <button
                                    onClick={() => openFulfillmentModal(order, "accept")}
                                    className="text-[11px] font-medium transition-colors"
                                    style={{ color: "var(--mc-success)" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                                  >
                                    Accept →
                                  </button>
                                  <button
                                    onClick={() => openFulfillmentModal(order, "deliver")}
                                    className="text-[11px] transition-colors"
                                    style={{ color: "var(--mc-text-muted)" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
                                  >
                                    Deliver →
                                  </button>
                                </>
                              )}
                              {!order.notes?.startsWith("[DESTROYED]") && order.status === "accepted" && (
                                <button
                                  onClick={() => openFulfillmentModal(order, "deliver")}
                                  className="text-[11px] font-medium transition-colors"
                                  style={{ color: "var(--mc-success)" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                                >
                                  Deliver →
                                </button>
                              )}
                              {order.notes?.startsWith("[DESTROYED]") && order.status !== "cancelled" && (
                                <button
                                  onClick={() => setCancelDestructionModal({
                                    order,
                                    restore_to_distributor_id: order.partner_id,
                                    submitting: false,
                                  })}
                                  className="text-[11px] transition-colors"
                                  style={{ color: "var(--mc-error)" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                                >
                                  Cancel
                                </button>
                              )}
                              {!order.notes?.startsWith("[DESTROYED]") && (
                                <Link
                                  href={`/orders/${order.id}`}
                                  className="inline-flex items-center gap-1 text-[11px] transition-colors"
                                  style={{ color: "var(--mc-cream-subtle)" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                                >
                                  View <ArrowRight className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 4: SUPPLY ORDERS
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "supply" && (
        <div>
          {/* Sub-tab bar */}
          <div className="flex gap-1 mb-5" style={{ borderBottom: "1px solid var(--mc-border)" }}>
            {(["supply_orders", "internal_transfers"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSupplyTab(tab)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium tracking-wide transition-all"
                style={{
                  borderBottom: `2px solid ${activeSupplyTab === tab ? "var(--mc-cream)" : "transparent"}`,
                  color: activeSupplyTab === tab ? "var(--mc-cream)" : "var(--mc-text-muted)",
                  background: "transparent",
                  marginBottom: "-1px",
                }}
              >
                {tab === "supply_orders" ? (
                  <><Truck className="w-3.5 h-3.5" strokeWidth={activeSupplyTab === tab ? 2 : 1.5} />Supply Orders</>
                ) : (
                  <><MoveRight className="w-3.5 h-3.5" strokeWidth={activeSupplyTab === tab ? 2 : 1.5} />Internal Transfers</>
                )}
              </button>
            ))}
          </div>

          {activeSupplyTab === "supply_orders" && <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-1">
              {(["all", "pending", "arrived", "cancelled"] as const).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setSupplyStatusFilter(s)}
                    style={{
                      padding: "4px 10px",
                      fontSize: "0.6875rem",
                      fontWeight: supplyStatusFilter === s ? 600 : 400,
                      border: "1px solid",
                      borderColor:
                        supplyStatusFilter === s
                          ? "var(--mc-cream)"
                          : "var(--mc-border)",
                      background:
                        supplyStatusFilter === s
                          ? "rgba(236,223,204,0.08)"
                          : "transparent",
                      color:
                        supplyStatusFilter === s
                          ? "var(--mc-cream)"
                          : "var(--mc-text-muted)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      textTransform: "capitalize",
                    }}
                  >
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                )
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSupplyForm(!showSupplyForm); }}
                className="mc-btn mc-btn-primary"
              >
                {showSupplyForm ? (
                  <><X className="w-3.5 h-3.5" />Cancel</>
                ) : (
                  <><Plus className="w-3.5 h-3.5" />New Supply Order</>
                )}
              </button>
            </div>
          </div>


          {/* New supply order form */}
          {showSupplyForm && (
            <div
              className="mc-card p-5 mb-5"
              style={{ border: "1px solid var(--mc-cream-subtle)" }}
            >
              <h3
                className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
                style={{ color: "var(--mc-text-muted)" }}
              >
                New Supply Order
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                <div>
                  <p className="mc-label mb-1">Product *</p>
                  <select
                    value={newSupply.product_id}
                    onChange={(e) => {
                      const pid = e.target.value;
                      const prod = allProducts.find((p) => p.id === pid);
                      setNewSupply((p) => ({
                        ...p,
                        product_id: pid,
                        supplier_id: prod?.supplier_id ?? p.supplier_id,
                      }));
                    }}
                    className="mc-input mc-select w-full"
                  >
                    <option value="">Select product…</option>
                    {allProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mc-label mb-1">Supplier *</p>
                  {(() => {
                    const selectedProd = allProducts.find((p) => p.id === newSupply.product_id);
                    const lockedSupplier = selectedProd?.supplier_id
                      ? allSuppliers.find((s) => s.id === selectedProd.supplier_id)
                      : null;
                    if (lockedSupplier) {
                      return (
                        <div
                          className="mc-input flex items-center gap-2"
                          style={{ color: "var(--mc-text-secondary)", cursor: "default" }}
                        >
                          <Factory className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--mc-text-muted)" }} />
                          {lockedSupplier.name}
                          <span className="ml-auto text-[10px]" style={{ color: "var(--mc-text-muted)" }}>auto-linked</span>
                        </div>
                      );
                    }
                    return (
                      <select
                        value={newSupply.supplier_id}
                        onChange={(e) =>
                          setNewSupply((p) => ({ ...p, supplier_id: e.target.value }))
                        }
                        className="mc-input mc-select w-full"
                      >
                        <option value="">Select supplier…</option>
                        {allSuppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
                <div>
                  <p className="mc-label mb-1">Distributor (stock destination)</p>
                  <select
                    value={newSupply.distributor_id}
                    onChange={(e) =>
                      setNewSupply((p) => ({
                        ...p,
                        distributor_id: e.target.value,
                      }))
                    }
                    className="mc-input mc-select w-full"
                  >
                    <option value="">None / unassigned</option>
                    {allDistributors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mc-label mb-1">Cases Ordered *</p>
                  <input
                    type="number"
                    min={1}
                    value={newSupply.cases_ordered}
                    onChange={(e) =>
                      setNewSupply((p) => ({
                        ...p,
                        cases_ordered: e.target.value,
                      }))
                    }
                    className="mc-input w-full"
                    placeholder="e.g. 50"
                  />
                </div>
                <div>
                  <p className="mc-label mb-1">
                    Unit Cost (€/case)
                    {totalCost && (
                      <span
                        className="ml-2 font-normal"
                        style={{ color: "var(--mc-cream-subtle)" }}
                      >
                        = €{totalCost} total
                      </span>
                    )}
                  </p>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={newSupply.unit_cost_eur}
                    onChange={(e) =>
                      setNewSupply((p) => ({
                        ...p,
                        unit_cost_eur: e.target.value,
                      }))
                    }
                    className="mc-input w-full"
                    placeholder="e.g. 85.00"
                  />
                </div>
                <div>
                  <p className="mc-label mb-1">Expected Arrival</p>
                  <input
                    type="date"
                    value={newSupply.expected_arrival_date}
                    onChange={(e) =>
                      setNewSupply((p) => ({
                        ...p,
                        expected_arrival_date: e.target.value,
                      }))
                    }
                    className="mc-input w-full"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="mc-label mb-1">Notes</p>
                  <input
                    type="text"
                    value={newSupply.notes}
                    onChange={(e) =>
                      setNewSupply((p) => ({ ...p, notes: e.target.value }))
                    }
                    className="mc-input w-full"
                    placeholder="Optional notes…"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={submitNewSupplyOrder}
                  disabled={
                    submitting ||
                    !newSupply.product_id ||
                    !newSupply.supplier_id ||
                    !newSupply.cases_ordered
                  }
                  className="mc-btn mc-btn-primary"
                >
                  <Check className="w-3.5 h-3.5" />
                  {submitting ? "Saving…" : "Create Order"}
                </button>
                <button
                  onClick={() => setShowSupplyForm(false)}
                  className="mc-btn mc-btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {supplyLoading ? (
            skeleton
          ) : filteredSupply.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No supply orders"
              description={
                supplyStatusFilter !== "all"
                  ? "Try a different status filter"
                  : "Create a supply order to track purchases from suppliers"
              }
            />
          ) : (
            <div className="mc-card overflow-hidden">
              <table className="mc-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Supplier</th>
                    <th>Distributor</th>
                    <th>Cases</th>
                    <th>Cost</th>
                    <th>Expected</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSupply.map((so) => {
                    const totalCostRow =
                      so.unit_cost_eur != null
                        ? `€${(so.cases_ordered * so.unit_cost_eur).toFixed(0)}`
                        : "—";
                    return (
                      <tr key={so.id}>
                        <td>
                          <Link
                            href={`/products/${so.product_id}`}
                            className="text-xs font-medium transition-colors"
                            style={{ color: "var(--mc-cream-subtle)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = "var(--mc-cream)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color =
                                "var(--mc-cream-subtle)")
                            }
                          >
                            {so.product_name}
                          </Link>
                        </td>
                        <td>
                          <Link
                            href={`/partners/${so.supplier_id}`}
                            className="inline-flex items-center gap-1 text-xs transition-colors"
                            style={{ color: "var(--mc-text-secondary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color =
                                "var(--mc-cream-subtle)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color =
                                "var(--mc-text-secondary)")
                            }
                          >
                            <Factory className="w-3 h-3 flex-shrink-0" />
                            {so.supplier_name}
                          </Link>
                        </td>
                        <td>
                          <span
                            className="text-xs"
                            style={{ color: "var(--mc-text-muted)" }}
                          >
                            {so.distributor_name || "—"}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs font-medium">
                            {so.cases_ordered} cs
                          </span>
                        </td>
                        <td>
                          <span
                            className="text-xs"
                            style={{ color: "var(--mc-text-secondary)" }}
                          >
                            {totalCostRow}
                            {so.unit_cost_eur != null && (
                              <span
                                className="text-[10px] ml-1"
                                style={{ color: "var(--mc-text-muted)" }}
                              >
                                @€{so.unit_cost_eur}/cs
                              </span>
                            )}
                          </span>
                        </td>
                        <td>
                          <span
                            className="text-xs"
                            style={{ color: "var(--mc-text-secondary)" }}
                          >
                            {so.expected_arrival_date
                              ? new Date(
                                  so.expected_arrival_date
                                ).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "2-digit",
                                })
                              : "—"}
                          </span>
                        </td>
                        <td>
                          <SupplyStatusBadge status={so.status} />
                        </td>
                        <td>
                          {so.status === "pending" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => markArrived(so)}
                                className="text-[11px] transition-colors"
                                style={{ color: "var(--mc-success)" }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.opacity = "0.7")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.opacity = "1")
                                }
                                title="Mark as arrived — updates inventory"
                              >
                                Mark Arrived
                              </button>
                              <button
                                onClick={() => cancelSupplyOrder(so.id)}
                                className="text-[11px] transition-colors"
                                style={{ color: "var(--mc-error)" }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.opacity = "0.7")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.opacity = "1")
                                }
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          {so.status === "arrived" && so.arrived_at && (
                            <span
                              className="text-[10px]"
                              style={{ color: "var(--mc-text-muted)" }}
                            >
                              {new Date(so.arrived_at).toLocaleDateString(
                                "en-GB",
                                { day: "2-digit", month: "short" }
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          </div>}

          {/* ── Internal Transfers sub-tab ── */}
          {activeSupplyTab === "internal_transfers" && (
            <div>
              {/* Header with New Transfer button */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                  {stockTransfers.length} transfer{stockTransfers.length !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={() => {
                    if (showTransferForm) {
                      setShowTransferForm(false);
                      setNewTransfer({ product_id: "", from_dist_id: "", to_dist_id: "", cases_qty: "", transport_method: "other", transport_note: "", logistics_cost_eur: "", expected_arrival_date: "", notes: "" });
                      setTransferSourceStock(null);
                    } else {
                      setShowTransferForm(true);
                    }
                  }}
                  className="mc-btn mc-btn-primary"
                >
                  {showTransferForm ? (
                    <><X className="w-3.5 h-3.5" />Cancel</>
                  ) : (
                    <><Plus className="w-3.5 h-3.5" />New Transfer</>
                  )}
                </button>
              </div>

              {/* Transfer form */}
              {showTransferForm && (
                <div className="mc-card p-5 mb-5" style={{ border: "1px solid var(--mc-cream-subtle)" }}>
                  <h3 className="text-xs font-semibold tracking-[0.08em] uppercase mb-4" style={{ color: "var(--mc-text-muted)" }}>
                    New Internal Transfer
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    <div>
                      <p className="mc-label mb-1">Product *</p>
                      <select value={newTransfer.product_id} onChange={(e) => setNewTransfer((p) => ({ ...p, product_id: e.target.value }))} className="mc-input mc-select w-full">
                        <option value="">Select product…</option>
                        {allProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="mc-label mb-1">From Location *</p>
                      <select value={newTransfer.from_dist_id} onChange={(e) => setNewTransfer((p) => ({ ...p, from_dist_id: e.target.value }))} className="mc-input mc-select w-full">
                        <option value="">Select source…</option>
                        {allDistributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="mc-label mb-1">To Location *</p>
                      <select value={newTransfer.to_dist_id} onChange={(e) => setNewTransfer((p) => ({ ...p, to_dist_id: e.target.value }))} className="mc-input mc-select w-full">
                        <option value="">Select destination…</option>
                        {allDistributors.filter((d) => d.id !== newTransfer.from_dist_id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <p className="mc-label">Cases *</p>
                        {transferSourceStock !== null && (
                          <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                            Max: {transferSourceStock} available
                          </span>
                        )}
                      </div>
                      <input type="number" min={1} value={newTransfer.cases_qty} onChange={(e) => setNewTransfer((p) => ({ ...p, cases_qty: e.target.value }))} className="mc-input w-full" placeholder="e.g. 10" />
                    </div>
                    <div>
                      <p className="mc-label mb-1">Transport Method *</p>
                      <select value={newTransfer.transport_method} onChange={(e) => setNewTransfer((p) => ({ ...p, transport_method: e.target.value as TransportMethod }))} className="mc-input mc-select w-full">
                        <option value="car">By car (self-drive)</option>
                        <option value="train">By train</option>
                        <option value="dhl">DHL</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <p className="mc-label mb-1">Logistics Cost (€){newTransfer.logistics_cost_eur === "0" || newTransfer.logistics_cost_eur === "" ? <span className="ml-1 font-normal" style={{ color: "var(--mc-text-muted)" }}>free</span> : null}</p>
                      <input type="number" min={0} step={0.01} value={newTransfer.logistics_cost_eur} onChange={(e) => setNewTransfer((p) => ({ ...p, logistics_cost_eur: e.target.value }))} className="mc-input w-full" placeholder="0 = free" />
                    </div>
                    {newTransfer.transport_method === "other" && (
                      <div>
                        <p className="mc-label mb-1">Details</p>
                        <input type="text" value={newTransfer.transport_note} onChange={(e) => setNewTransfer((p) => ({ ...p, transport_note: e.target.value }))} className="mc-input w-full" placeholder="e.g. friend going to Berlin" />
                      </div>
                    )}
                    <div>
                      <p className="mc-label mb-1">Expected Arrival</p>
                      <input type="date" value={newTransfer.expected_arrival_date} onChange={(e) => setNewTransfer((p) => ({ ...p, expected_arrival_date: e.target.value }))} className="mc-input w-full" />
                    </div>
                    <div className={newTransfer.transport_method === "other" ? "" : "sm:col-span-2 lg:col-span-1"}>
                      <p className="mc-label mb-1">Notes</p>
                      <input type="text" value={newTransfer.notes} onChange={(e) => setNewTransfer((p) => ({ ...p, notes: e.target.value }))} className="mc-input w-full" placeholder="Optional…" />
                    </div>
                  </div>
                  {(() => {
                    const transferQtyNeeded = parseInt(newTransfer.cases_qty) || 0;
                    const transferShortfall = transferSourceStock !== null && transferQtyNeeded > 0 ? Math.max(0, transferQtyNeeded - transferSourceStock) : 0;
                    const transferInsufficient = transferShortfall > 0;
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={submitNewTransfer}
                          disabled={transferSubmitting || !newTransfer.product_id || !newTransfer.from_dist_id || !newTransfer.to_dist_id || !newTransfer.cases_qty || transferInsufficient}
                          className="mc-btn mc-btn-primary"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {transferSubmitting ? "Saving…" : "Create Transfer"}
                        </button>
                        <button
                          onClick={() => { setShowTransferForm(false); setTransferSourceStock(null); setNewTransfer({ product_id: "", from_dist_id: "", to_dist_id: "", cases_qty: "", transport_method: "other", transport_note: "", logistics_cost_eur: "", expected_arrival_date: "", notes: "" }); }}
                          className="mc-btn mc-btn-ghost"
                        >
                          Cancel
                        </button>
                        {transferInsufficient && (
                          <span className="text-xs font-medium" style={{ color: "var(--mc-error)" }}>
                            Transfer not possible — {transferShortfall} case{transferShortfall !== 1 ? "s" : ""} missing from source
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Transfers table */}
              {stockTransfers.length > 0 && (
              <div className="mc-card overflow-hidden">
                <table className="mc-table">
                  <thead>
                    <tr>
                      <th>From</th>
                      <th></th>
                      <th>To</th>
                      <th>Product</th>
                      <th>Cases</th>
                      <th>Transport</th>
                      <th>Cost</th>
                      <th>Expected</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockTransfers.map((t) => {
                      const transportLabel = t.transport_method === "car" ? "By car" : t.transport_method === "train" ? "By train" : t.transport_method === "dhl" ? "DHL" : "Other";
                      const statusStyle =
                        t.status === "arrived"
                          ? { bg: "var(--mc-success-bg)", border: "var(--mc-success-light)", color: "var(--mc-success)", label: "Arrived" }
                          : t.status === "cancelled"
                          ? { bg: "var(--mc-error-bg)", border: "var(--mc-error-light)", color: "var(--mc-error)", label: "Cancelled" }
                          : { bg: "var(--mc-warning-bg)", border: "var(--mc-warning-light)", color: "var(--mc-warning)", label: "In Transit" };
                      return (
                        <tr key={t.id}>
                          <td><span className="text-xs">{t.from_dist_name}</span></td>
                          <td><MoveRight className="w-3 h-3" style={{ color: "var(--mc-text-muted)" }} /></td>
                          <td><span className="text-xs">{t.to_dist_name}</span></td>
                          <td><span className="text-xs font-medium" style={{ color: "var(--mc-text-primary)" }}>{t.product_name}</span></td>
                          <td><span className="text-xs">{t.cases_qty} cs</span></td>
                          <td>
                            <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
                              {transportLabel}
                              {t.transport_method === "other" && t.transport_note && (
                                <span className="ml-1 text-[10px]" style={{ color: "var(--mc-text-muted)" }} title={t.transport_note}>
                                  · {t.transport_note.length > 20 ? t.transport_note.slice(0, 20) + "…" : t.transport_note}
                                </span>
                              )}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs" style={{ color: t.logistics_cost_eur ? "var(--mc-text-secondary)" : "var(--mc-text-muted)" }}>
                              {t.logistics_cost_eur ? `€${t.logistics_cost_eur.toFixed(0)}` : "Free"}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                              {t.expected_arrival_date ? new Date(t.expected_arrival_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
                            </span>
                          </td>
                          <td>
                            <span className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                              style={{ background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, color: statusStyle.color }}>
                              {statusStyle.label}
                            </span>
                          </td>
                          <td>
                            {t.status === "in_transit" && (
                              <div className="space-y-1">
                                <div className="flex gap-2">
                                  <button onClick={() => markTransferArrived(t)} className="text-[11px] transition-colors" style={{ color: "var(--mc-success)" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                                    title="Mark arrived — adds cases to destination stock">
                                    Mark Arrived
                                  </button>
                                  <button onClick={() => { setTransferArrivalError(null); cancelTransfer(t); }} className="text-[11px] transition-colors" style={{ color: "var(--mc-error)" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
                                    Cancel
                                  </button>
                                </div>
                                {transferArrivalError?.id === t.id && (
                                  <p className="text-[10px] font-medium" style={{ color: "var(--mc-error)" }}>
                                    {transferArrivalError.shortfall} case{transferArrivalError.shortfall !== 1 ? "s" : ""} missing from source
                                  </p>
                                )}
                              </div>
                            )}
                            {t.status === "arrived" && t.arrived_at && (
                              <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                                {new Date(t.arrived_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          )}
        </div>
      )}

      {/* ─── Cancel Destruction Modal ────────────────────────────────────────── */}
      {cancelDestructionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !cancelDestructionModal.submitting) setCancelDestructionModal(null); }}
        >
          <div className="mc-card p-6 w-full max-w-sm">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--mc-text-primary)" }}>
                Cancel Destruction
              </h3>
              <button onClick={() => setCancelDestructionModal(null)} disabled={cancelDestructionModal.submitting} style={{ color: "var(--mc-text-muted)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] mb-4" style={{ color: "var(--mc-text-muted)" }}>
              {cancelDestructionModal.order.items.map((i) => `${i.cases_qty} case${i.cases_qty !== 1 ? "s" : ""} of ${i.product_name}`).join(", ")} will be restored to:
            </p>
            <div className="mb-5">
              <p className="mc-label mb-1">Restore stock to *</p>
              <select
                value={cancelDestructionModal.restore_to_distributor_id}
                onChange={(e) => setCancelDestructionModal((p) => p ? { ...p, restore_to_distributor_id: e.target.value } : p)}
                className="mc-input mc-select w-full"
                disabled={cancelDestructionModal.submitting}
              >
                <option value="">Select distributor…</option>
                {allOrderDistributors.filter((d) => !d.is_mecanova).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmCancelDestruction}
                disabled={cancelDestructionModal.submitting || !cancelDestructionModal.restore_to_distributor_id}
                className="mc-btn mc-btn-primary"
              >
                {cancelDestructionModal.submitting ? "Restoring…" : "Restore Stock"}
              </button>
              <button onClick={() => setCancelDestructionModal(null)} disabled={cancelDestructionModal.submitting} className="mc-btn mc-btn-ghost">
                Keep
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Fulfillment Planning Modal ─────────────────────────────────────── */}
      {fulfillmentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !fulfillmentModal.submitting) setFulfillmentModal(null); }}
        >
          <div className="mc-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold mb-0.5" style={{ color: "var(--mc-text-primary)" }}>
                  {fulfillmentModal.action === "accept" ? "Accept Order" : "Mark as Delivered"} — Planning
                </h3>
                <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                  Client: {fulfillmentModal.order.client_name || fulfillmentModal.order.partner_name}
                </p>
              </div>
              <button
                onClick={() => setFulfillmentModal(null)}
                disabled={fulfillmentModal.submitting}
                style={{ color: "var(--mc-text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {fulfillmentModal.loading ? (
              <div className="space-y-3">
                <div className="mc-skeleton h-24" />
                <div className="mc-skeleton h-24" />
              </div>
            ) : (
              <>
                {/* Per-product allocation inputs */}
                {(() => {
                  // Compute global validation state
                  const hasOverAllocation = fulfillmentModal.stockRows.some((row) => {
                    const locMap = fulfillmentModal.allocation[row.product_id] || {};
                    const total = Object.values(locMap).reduce((s, v) => s + (parseInt(v) || 0), 0);
                    return total > row.ordered_qty;
                  });
                  const hasLocationOverStock = fulfillmentModal.action === "deliver" && fulfillmentModal.stockRows.some((row) =>
                    row.locations.some((loc) => {
                      const val = parseInt((fulfillmentModal.allocation[row.product_id] || {})[loc.distributor_id] || "0") || 0;
                      return val > loc.on_hand_qty;
                    })
                  );
                  const allZero = fulfillmentModal.stockRows.every((row) => {
                    const locMap = fulfillmentModal.allocation[row.product_id] || {};
                    return Object.values(locMap).reduce((s, v) => s + (parseInt(v) || 0), 0) === 0;
                  });
                  const blocked = hasOverAllocation || hasLocationOverStock || allZero;

                  const totalShortfall = fulfillmentModal.stockRows.reduce((sum, row) => {
                    const locMap = fulfillmentModal.allocation[row.product_id] || {};
                    const committed = Object.values(locMap).reduce((s, v) => s + (parseInt(v) || 0), 0);
                    return sum + Math.max(0, row.ordered_qty - committed);
                  }, 0);
                  const isFullyCovered = totalShortfall === 0;
                  const actionLabel = fulfillmentModal.action === "accept" ? "Accept" : "Deliver";

                  return (
                    <>
                      {fulfillmentModal.stockRows.map((row) => {
                        const locMap = fulfillmentModal.allocation[row.product_id] || {};
                        const allocatedTotal = Object.values(locMap).reduce((s, v) => s + (parseInt(v) || 0), 0);
                        const overAllocated = allocatedTotal > row.ordered_qty;
                        const productShortfall = row.ordered_qty - allocatedTotal;

                        return (
                          <div key={row.product_id} className="mb-5 p-4" style={{ border: "1px solid var(--mc-border)", background: "var(--mc-surface-elevated)" }}>
                            <div className="flex items-baseline justify-between mb-3">
                              <p className="text-xs font-semibold" style={{ color: "var(--mc-text-primary)" }}>{row.product_name}</p>
                              <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                                Ordered: {row.ordered_qty} cases
                                {row.bottles_per_case ? ` · ${row.bottles_per_case} btl/case` : ""}
                              </p>
                            </div>

                            {row.locations.length === 0 ? (
                              <p className="text-[11px] mb-3" style={{ color: "var(--mc-error)" }}>No stock found in any location</p>
                            ) : (
                              <table className="table-fixed w-full mb-2">
                                <colgroup>
                                  <col style={{ width: "45%" }} />
                                  <col style={{ width: "20%" }} />
                                  <col style={{ width: "35%" }} />
                                </colgroup>
                                <thead>
                                  <tr>
                                    <th className="text-left text-[10px] font-medium pb-1.5" style={{ color: "var(--mc-text-muted)" }}>Location</th>
                                    <th className="text-center text-[10px] font-medium pb-1.5" style={{ color: "var(--mc-text-muted)" }}>In stock</th>
                                    <th className="text-right text-[10px] font-medium pb-1.5" style={{ color: "var(--mc-text-muted)" }}>Allocate</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.locations.map((loc) => {
                                    const inputVal = locMap[loc.distributor_id] ?? "0";
                                    const inputNum = parseInt(inputVal) || 0;
                                    const locOver = fulfillmentModal.action === "deliver" && inputNum > loc.on_hand_qty;
                                    const locMissing = locOver ? inputNum - loc.on_hand_qty : 0;
                                    return (
                                      <tr key={loc.distributor_id}>
                                        <td className="text-[11px] py-1" style={{ color: "var(--mc-text-secondary)" }}>{loc.name}</td>
                                        <td className="text-[11px] py-1 text-center" style={{ color: loc.on_hand_qty === 0 ? "var(--mc-text-muted)" : "var(--mc-text-primary)" }}>{loc.on_hand_qty}</td>
                                        <td className="py-1 text-right">
                                          <div className="flex flex-col items-end gap-0.5">
                                            <input
                                              type="number"
                                              min={0}
                                              value={inputVal}
                                              onChange={(e) => setFulfillmentModal((prev) => {
                                                if (!prev) return prev;
                                                return {
                                                  ...prev,
                                                  allocation: {
                                                    ...prev.allocation,
                                                    [row.product_id]: {
                                                      ...(prev.allocation[row.product_id] || {}),
                                                      [loc.distributor_id]: e.target.value,
                                                    },
                                                  },
                                                };
                                              })}
                                              className="mc-input text-center w-16"
                                              style={locOver ? { borderColor: "var(--mc-error)" } : {}}
                                            />
                                            {locOver && (
                                              <span className="text-[10px] font-medium px-1.5 py-0.5 leading-none" style={{ color: "var(--mc-error)", background: "var(--mc-error-bg)", border: "1px solid var(--mc-error-light)" }}>
                                                {locMissing} short
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  <tr style={{ borderTop: "1px solid var(--mc-border)" }}>
                                    <td className="text-[11px] pt-1.5 font-medium" style={{ color: "var(--mc-text-muted)" }}>Total</td>
                                    <td className="text-[11px] pt-1.5 text-center font-medium" style={{ color: "var(--mc-text-muted)" }}>{row.total_available}</td>
                                    <td className="text-[11px] pt-1.5 text-right font-semibold" style={{ color: overAllocated ? "var(--mc-error)" : productShortfall > 0 ? "var(--mc-warning)" : "var(--mc-success)" }}>
                                      {allocatedTotal} / {row.ordered_qty}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            )}

                            {overAllocated && (
                              <p className="text-[10px] font-medium mt-1" style={{ color: "var(--mc-error)" }}>
                                Over-allocated by {allocatedTotal - row.ordered_qty} case{allocatedTotal - row.ordered_qty !== 1 ? "s" : ""}
                              </p>
                            )}
                            {!overAllocated && productShortfall > 0 && (
                              <p className="text-[10px] mt-1" style={{ color: "var(--mc-warning)" }}>
                                {productShortfall} case{productShortfall !== 1 ? "s" : ""} short
                              </p>
                            )}
                          </div>
                        );
                      })}

                      {/* Area 1: Zero stock — all inputs are 0 */}
                      {allZero && (
                        <div className="mb-4 p-3" style={{ background: "var(--mc-error-bg)", border: "1px solid var(--mc-error-light)" }}>
                          <p className="text-xs font-medium" style={{ color: "var(--mc-error)" }}>
                            Your distributors have no stock available — this order cannot be delivered right now.
                          </p>
                        </div>
                      )}

                      {/* Area 2: Partial shortfall — stock exists but delivery is incomplete */}
                      {!isFullyCovered && !hasOverAllocation && !allZero && !hasLocationOverStock && (() => {
                        const moreAvailableTotal = fulfillmentModal.stockRows.reduce((sum, r) => {
                          const locMap2 = fulfillmentModal.allocation[r.product_id] || {};
                          const committed = Object.values(locMap2).reduce((s, v) => s + (parseInt(v) || 0), 0);
                          const stillNeeded = r.ordered_qty - committed;
                          const stillInStock = r.total_available - committed;
                          return sum + Math.min(stillNeeded, Math.max(0, stillInStock));
                        }, 0);
                        let msg: string;
                        if (moreAvailableTotal === 0) {
                          msg = `Your client needs ${totalShortfall} more case${totalShortfall !== 1 ? "s" : ""} — no additional stock available.`;
                        } else if (moreAvailableTotal < totalShortfall) {
                          msg = `Your client needs ${totalShortfall} more case${totalShortfall !== 1 ? "s" : ""} — only ${moreAvailableTotal} more available in stock.`;
                        } else {
                          msg = `Your client still needs ${totalShortfall} more case${totalShortfall !== 1 ? "s" : ""}.`;
                        }
                        return (
                          <div className="mb-4 p-3" style={{ background: "var(--mc-warning-bg)", border: "1px solid var(--mc-warning-light)" }}>
                            <p className="text-xs font-medium" style={{ color: "var(--mc-warning)" }}>{msg}</p>
                          </div>
                        );
                      })()}

                      <div className="flex gap-2 flex-wrap">
                        {isFullyCovered ? (
                          <button
                            onClick={() => handleFulfillmentSubmit("full")}
                            disabled={fulfillmentModal.submitting || blocked}
                            className="mc-btn mc-btn-primary"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {fulfillmentModal.submitting ? "Saving…" : `${actionLabel} Order`}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleFulfillmentSubmit("hold")}
                              disabled={fulfillmentModal.submitting || blocked}
                              className="mc-btn mc-btn-primary"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {fulfillmentModal.submitting ? "Saving…" : `${actionLabel} & Hold Remainder`}
                            </button>
                            <button
                              onClick={() => handleFulfillmentSubmit("cancel")}
                              disabled={fulfillmentModal.submitting || blocked}
                              className="mc-btn mc-btn-danger"
                            >
                              {`${actionLabel} & Cancel Remainder`}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setFulfillmentModal(null)}
                          disabled={fulfillmentModal.submitting}
                          className="mc-btn mc-btn-ghost"
                        >
                          Close
                        </button>
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default function OperationsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <div className="mc-skeleton h-8 w-48" />
          <div className="mc-skeleton h-10 w-full" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="mc-skeleton h-14" />
          ))}
        </div>
      }
    >
      <OperationsPageContent />
    </Suspense>
  );
}
