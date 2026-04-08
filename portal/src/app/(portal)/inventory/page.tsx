"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import {
  INVENTORY_STATUS_LABELS,
  INVENTORY_ADJUSTMENT_TYPES,
  INVENTORY_ADJUSTMENT_LABELS,
} from "@mecanova/shared";
import type { InventoryStatusEnum, InventoryAdjustmentType } from "@mecanova/shared";
import {
  Warehouse,
  Search,
  Plus,
  Minus,
  History,
  Package,
  AlertTriangle,
  X,
  Loader2,
} from "lucide-react";

interface StockRow {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  on_hand_qty: number;
  case_size: number;
  status: InventoryStatusEnum;
}

interface MovementRow {
  id: string;
  product_name: string;
  movement_type: string;
  qty_delta: number;
  case_size: number;
  note: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<InventoryStatusEnum, { bg: string; text: string }> = {
  in_stock: { bg: "var(--mc-success-bg)", text: "var(--mc-success)" },
  out: { bg: "var(--mc-error-bg)", text: "var(--mc-error)" },
};

export default function InventoryPage() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"stock" | "history">("stock");
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState("");
  const [adjustType, setAdjustType] = useState<InventoryAdjustmentType>("stock_in");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustUnit, setAdjustUnit] = useState<"cases" | "bottles">("cases");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string | null; case_size: number | null }[]>([]);
  const supabase = createClient();
  const router = useRouter();

  const loadData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, partner_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.partner_id || profile.role !== "distributor") {
      router.push("/dashboard");
      return;
    }

    setPartnerId(profile.partner_id);

    // Load inventory status
    const { data: invRows } = await supabase
      .from("inventory_status")
      .select("product_id, on_hand_qty, status")
      .eq("distributor_id", profile.partner_id);

    // Load products for mapping
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, sku, case_size")
      .eq("active", true)
      .order("name");

    setProducts(prods || []);

    const prodMap = new Map((prods || []).map((p) => [p.id, p]));

    setStock(
      (invRows || [])
        .map((r) => ({
          product_id: r.product_id,
          product_name: prodMap.get(r.product_id)?.name || "Unknown",
          product_sku: prodMap.get(r.product_id)?.sku || null,
          on_hand_qty: r.on_hand_qty,
          case_size: prodMap.get(r.product_id)?.case_size || 6,
          status: r.status as InventoryStatusEnum,
        }))
        .sort((a, b) => a.product_name.localeCompare(b.product_name))
    );

    // Load recent movements
    const { data: movRows } = await supabase
      .from("inventory_movements")
      .select("id, product_id, movement_type, qty_delta, note, created_at")
      .eq("distributor_id", profile.partner_id)
      .order("created_at", { ascending: false })
      .limit(50);

    setMovements(
      (movRows || []).map((m) => ({
        id: m.id,
        product_name: prodMap.get(m.product_id)?.name || "Unknown",
        movement_type: m.movement_type,
        qty_delta: m.qty_delta,
        case_size: prodMap.get(m.product_id)?.case_size || 6,
        note: m.note,
        created_at: m.created_at,
      }))
    );

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct || !adjustQty) return;

    setAdjustLoading(true);
    setAdjustError(null);

    const isPositive = adjustType === "stock_in";
    const rawQty = parseInt(adjustQty, 10);
    let casesQty = rawQty;

    if (adjustUnit === "bottles") {
      const prod = products.find((p) => p.id === adjustProduct);
      const caseSize = prod?.case_size || 6;
      casesQty = Math.ceil(rawQty / caseSize);
    }

    const qty_delta = isPositive ? Math.abs(casesQty) : -Math.abs(casesQty);
    const noteWithUnit =
      adjustUnit === "bottles"
        ? `${rawQty} bottles${adjustNote.trim() ? ` — ${adjustNote.trim()}` : ""}`
        : adjustNote.trim() || null;

    const { error } = await supabase.rpc("adjust_inventory", {
      p_product_id: adjustProduct,
      p_qty_delta: qty_delta,
      p_movement_type: adjustType,
      p_note: noteWithUnit,
    });

    if (error) {
      setAdjustError(error.message);
      setAdjustLoading(false);
      return;
    }

    setShowAdjust(false);
    setAdjustProduct("");
    setAdjustType("stock_in");
    setAdjustQty("");
    setAdjustNote("");
    setAdjustUnit("cases");
    setAdjustLoading(false);
    await loadData();
  };

  const filteredStock = stock.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.product_name.toLowerCase().includes(q) ||
      (s.product_sku || "").toLowerCase().includes(q)
    );
  });

  const filteredMovements = movements.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.product_name.toLowerCase().includes(q) ||
      m.movement_type.toLowerCase().includes(q)
    );
  });

  const formatMovementType = (type: string): string => {
    return (
      INVENTORY_ADJUSTMENT_LABELS[type as InventoryAdjustmentType] ||
      type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );
  };

  const totalCases = stock.reduce((sum, s) => sum + s.on_hand_qty, 0);
  const totalBottles = stock.reduce((sum, s) => sum + s.on_hand_qty * s.case_size, 0);
  const lowStockCount = stock.filter((s) => s.status === "out").length;

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track stock levels and manage adjustments"
        icon={Warehouse}
        actions={
          <button
            onClick={() => setShowAdjust(true)}
            className="mc-btn mc-btn-primary inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Adjustment
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="mc-card p-4">
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
            Products Tracked
          </span>
          <p
            className="text-xl font-semibold mt-1"
            style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-text-primary)" }}
          >
            {stock.length}
          </p>
        </div>
        <div className="mc-card p-4">
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
            Total Stock
          </span>
          <p
            className="text-xl font-semibold mt-1"
            style={{ color: "var(--mc-text-primary)" }}
          >
            {totalBottles.toLocaleString()}
            <span className="text-xs font-normal ml-1.5" style={{ color: "var(--mc-text-muted)" }}>
              btl ({totalCases.toLocaleString()} cs)
            </span>
          </p>
        </div>
        <div className="mc-card p-4">
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--mc-text-muted)" }}>
            Low / Out of Stock
          </span>
          <p
            className="text-xl font-semibold mt-1"
            style={{
              fontFamily: "var(--font-jost), Jost, sans-serif",
              color: lowStockCount > 0 ? "var(--mc-warning)" : "var(--mc-text-primary)",
            }}
          >
            {lowStockCount}
            {lowStockCount > 0 && (
              <AlertTriangle className="w-4 h-4 inline-block ml-1.5" style={{ color: "var(--mc-warning)" }} />
            )}
          </p>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex" style={{ border: "1px solid var(--mc-border)" }}>
          <button
            onClick={() => setTab("stock")}
            className="px-4 py-1.5 text-[11px] font-medium tracking-wide transition-colors"
            style={{
              background: tab === "stock" ? "var(--mc-cream-subtle)" : "transparent",
              color: tab === "stock" ? "var(--mc-black)" : "var(--mc-text-muted)",
            }}
          >
            <Package className="w-3 h-3 inline-block mr-1.5" />
            Stock Levels
          </button>
          <button
            onClick={() => setTab("history")}
            className="px-4 py-1.5 text-[11px] font-medium tracking-wide transition-colors"
            style={{
              background: tab === "history" ? "var(--mc-cream-subtle)" : "transparent",
              color: tab === "history" ? "var(--mc-black)" : "var(--mc-text-muted)",
            }}
          >
            <History className="w-3 h-3 inline-block mr-1.5" />
            Movement History
          </button>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: "var(--mc-text-muted)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="mc-input w-full pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="mc-skeleton h-14" />
          ))}
        </div>
      ) : tab === "stock" ? (
        filteredStock.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No inventory tracked"
            description="Stock levels will appear here once supply orders are processed or adjustments are made."
          />
        ) : (
          <div className="space-y-2">
            {filteredStock.map((row) => {
              const statusColor = STATUS_COLORS[row.status];
              return (
                <div
                  key={row.product_id}
                  className="mc-card flex items-center justify-between px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium block" style={{ color: "var(--mc-text-primary)" }}>
                      {row.product_name}
                    </span>
                    {row.product_sku && (
                      <span className="text-[10px] font-mono" style={{ color: "var(--mc-text-muted)" }}>
                        {row.product_sku}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-sm font-semibold text-right" style={{ color: "var(--mc-text-primary)" }}>
                      {(row.on_hand_qty * row.case_size).toLocaleString()}
                      <span className="text-[10px] font-normal ml-1" style={{ color: "var(--mc-text-muted)" }}>
                        btl ({row.on_hand_qty} cs)
                      </span>
                    </span>
                    <span
                      className="inline-flex px-2 py-0.5 text-[9px] font-medium tracking-wide uppercase"
                      style={{
                        background: statusColor.bg,
                        color: statusColor.text,
                        border: `1px solid ${statusColor.text}20`,
                      }}
                    >
                      {INVENTORY_STATUS_LABELS[row.status]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredMovements.length === 0 ? (
        <EmptyState
          icon={History}
          title="No movement history"
          description="Stock movements from orders and adjustments will be recorded here."
        />
      ) : (
        <div className="space-y-2">
          {filteredMovements.map((m) => (
            <div
              key={m.id}
              className="mc-card flex items-center justify-between px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium block" style={{ color: "var(--mc-text-primary)" }}>
                  {m.product_name}
                </span>
                <span className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                  {formatMovementType(m.movement_type)}
                  {m.note && ` — ${m.note}`}
                </span>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <span
                  className="text-xs font-semibold flex items-center gap-1"
                  style={{
                    color: m.qty_delta > 0 ? "var(--mc-success)" : "var(--mc-error)",
                  }}
                >
                  {m.qty_delta > 0 ? (
                    <Plus className="w-3 h-3" />
                  ) : (
                    <Minus className="w-3 h-3" />
                  )}
                  {(Math.abs(m.qty_delta) * m.case_size).toLocaleString()} btl
                  <span className="text-[10px] font-normal" style={{ color: "var(--mc-text-muted)" }}>
                    ({Math.abs(m.qty_delta)} cs)
                  </span>
                </span>
                <span className="text-[10px] w-20 text-right" style={{ color: "var(--mc-text-muted)" }}>
                  {new Date(m.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adjustment Modal */}
      {showAdjust && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(10, 11, 13, 0.8)" }}
          onClick={() => setShowAdjust(false)}
        >
          <div
            className="mc-card p-6 w-full max-w-md mc-animate-fade"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--mc-text-primary)" }}>
                Stock Adjustment
              </h3>
              <button
                onClick={() => setShowAdjust(false)}
                style={{ color: "var(--mc-text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adjustError && (
              <div
                className="mb-4 px-3 py-2 text-xs"
                style={{
                  background: "var(--mc-error-bg)",
                  border: "1px solid var(--mc-error-light)",
                  color: "var(--mc-error)",
                }}
              >
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjust} className="space-y-4">
              <div>
                <label
                  className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
                  style={{ color: "var(--mc-text-muted)" }}
                >
                  Product *
                </label>
                <select
                  value={adjustProduct}
                  onChange={(e) => setAdjustProduct(e.target.value)}
                  className="mc-input w-full"
                  required
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
                  style={{ color: "var(--mc-text-muted)" }}
                >
                  Adjustment Type *
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as InventoryAdjustmentType)}
                  className="mc-input w-full"
                  required
                >
                  {INVENTORY_ADJUSTMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {INVENTORY_ADJUSTMENT_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
                  style={{ color: "var(--mc-text-muted)" }}
                >
                  Quantity *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="mc-input flex-1"
                    style={{ width: "auto" }}
                    placeholder={adjustUnit === "cases" ? "Number of cases" : "Number of bottles"}
                    required
                  />
                  <select
                    value={adjustUnit}
                    onChange={(e) => setAdjustUnit(e.target.value as "cases" | "bottles")}
                    className="mc-input"
                    style={{ width: "7rem" }}
                  >
                    <option value="cases">Cases</option>
                    <option value="bottles">Bottles</option>
                  </select>
                </div>
                <p className="text-[10px] mt-1" style={{ color: "var(--mc-text-muted)" }}>
                  {adjustType === "stock_in"
                    ? "This will increase your stock."
                    : "This will decrease your stock."}
                  {adjustUnit === "bottles" && adjustProduct && (() => {
                    const prod = products.find((p) => p.id === adjustProduct);
                    const cs = prod?.case_size;
                    return cs ? ` (${cs} bottles per case)` : "";
                  })()}
                </p>
              </div>

              <div>
                <label
                  className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
                  style={{ color: "var(--mc-text-muted)" }}
                >
                  Reason / Note
                </label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="mc-input w-full"
                  placeholder="e.g. Received shipment from Mecanova"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={adjustLoading || !adjustProduct || !adjustQty}
                  className="mc-btn mc-btn-primary flex-1 inline-flex items-center justify-center gap-1.5"
                >
                  {adjustLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  {adjustLoading ? "Saving..." : "Save Adjustment"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdjust(false)}
                  className="mc-btn"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--mc-border)",
                    color: "var(--mc-text-secondary)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
