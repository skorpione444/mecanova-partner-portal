"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/EmptyState";
import PricingInputPanel from "@/components/pricing/PricingInputPanel";
import PricingResultsPanel from "@/components/pricing/PricingResultsPanel";
import { calcPricing, DEFAULT_PRICING_INPUTS } from "@/components/pricing/pricingCalc";
import { allocateShipment } from "@/components/pricing/shipmentAlloc";
import type { PricingInputs, PricingMode, PricingSystemSetting } from "@mecanova/shared";
import { Ship, Plus, Trash2, ArrowLeft, ChevronRight } from "lucide-react";

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  abv: number | null;
  size_ml: number | null;
  bottles_per_case: number | null;
  case_size: number | null;
  hs_code: string | null;
}

interface ShipmentRow {
  id: string;
  name: string;
  status: string;
  pallets: number | null;
  freight_mode: string;
  local_transport_amount: number;
  local_transport_currency: string;
  intl_freight_amount: number;
  intl_freight_currency: string;
  dom_logistics_eur: number;
  notes: string | null;
  created_at: string;
}

interface ItemRow {
  id: string;
  shipment_id: string;
  product_id: string;
  quantity_cases: number;
  supplier_price_per_case: number | null;
  supplier_currency: string;
  mode: string;
  calculation_snapshot: { inputs: PricingInputs } | null;
  result_landed_cost_case: number | null;
  result_min_price_case: number | null;
  result_max_supplier_case: number | null;
  result_actual_margin_pct: number | null;
}

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
const bpcOf = (p?: ProductRow | null) =>
  p?.bottles_per_case ?? p?.case_size ?? 6;

export default function ShipmentsWorkspace() {
  const supabase = createClient();
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productMap, setProductMap] = useState<Record<string, ProductRow>>({});
  const [settings, setSettings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [newName, setNewName] = useState("");
  const [addProductId, setAddProductId] = useState("");
  const [addCases, setAddCases] = useState("1");
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [itemInputs, setItemInputs] = useState<PricingInputs | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [shipRes, prodRes, setRes] = await Promise.all([
      supabase.from("shipments").select("*").order("created_at", { ascending: false }),
      supabase
        .from("products")
        .select("id, name, brand, abv, size_ml, bottles_per_case, case_size, hs_code")
        .eq("active", true)
        .order("name"),
      supabase.from("pricing_system_settings").select("key, value_numeric"),
    ]);
    setShipments((shipRes.data as ShipmentRow[]) ?? []);
    const prods = (prodRes.data as ProductRow[]) ?? [];
    setProducts(prods);
    setProductMap(Object.fromEntries(prods.map((p) => [p.id, p])));
    const map: Record<string, number> = {};
    for (const s of (setRes.data as PricingSystemSetting[]) ?? []) {
      if (s.value_numeric !== null) map[s.key] = s.value_numeric;
    }
    setSettings(map);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shipment = useMemo(
    () => shipments.find((s) => s.id === sel) ?? null,
    [shipments, sel]
  );

  const loadItems = useCallback(
    async (shipmentId: string) => {
      const { data } = await supabase
        .from("shipment_items")
        .select("*")
        .eq("shipment_id", shipmentId)
        .order("created_at", { ascending: true });
      const rows = (data as ItemRow[]) ?? [];
      setItems(rows);
      const missing = rows
        .map((r) => r.product_id)
        .filter((pid) => !productMap[pid]);
      if (missing.length) {
        const { data: extra } = await supabase
          .from("products")
          .select("id, name, brand, abv, size_ml, bottles_per_case, case_size, hs_code")
          .in("id", missing);
        if (extra)
          setProductMap((m) => ({
            ...m,
            ...Object.fromEntries((extra as ProductRow[]).map((p) => [p.id, p])),
          }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productMap]
  );

  const selectShipment = (id: string) => {
    setSel(id);
    setOpenItemId(null);
    loadItems(id);
  };

  const createShipment = async () => {
    if (!newName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("shipments")
      .insert({ name: newName.trim(), created_by: user.id })
      .select()
      .single();
    setNewName("");
    if (data) {
      setShipments((p) => [data as ShipmentRow, ...p]);
      selectShipment((data as ShipmentRow).id);
    }
  };

  const patchShipment = async (patch: Partial<ShipmentRow>) => {
    if (!shipment) return;
    setShipments((p) =>
      p.map((s) => (s.id === shipment.id ? { ...s, ...patch } : s))
    );
    await supabase
      .from("shipments")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", shipment.id);
    // leg/freight changes alter the per-bottle split → recompute every item
    await recomputeAll(
      { ...shipment, ...patch } as ShipmentRow,
      items
    );
  };

  // Build the PricingInputs for one item: snapshot (if any) or fresh defaults +
  // supplier price, then overlay the shipment's per-bottle split + product.
  const buildInputs = useCallback(
    (
      ship: ShipmentRow,
      it: ItemRow,
      alloc: ReturnType<typeof allocateShipment>
    ): { inputs: PricingInputs; product: ProductRow | null } => {
      const product = productMap[it.product_id] ?? null;
      const base: PricingInputs =
        it.calculation_snapshot?.inputs ?? {
          ...DEFAULT_PRICING_INPUTS,
          fxUsdEur: settings.default_fx_usd_eur ?? DEFAULT_PRICING_INPUTS.fxUsdEur,
          fxMxnEur: settings.default_fx_mxn_eur ?? DEFAULT_PRICING_INPUTS.fxMxnEur,
          exciseRatePerHl:
            settings.branntweinsteuer_per_hl ?? DEFAULT_PRICING_INPUTS.exciseRatePerHl,
          importVatRate:
            settings.default_import_vat_rate ?? DEFAULT_PRICING_INPUTS.importVatRate,
        };
      const a = alloc[it.id];
      const inputs: PricingInputs = {
        ...base,
        productId: it.product_id,
        mode: (it.mode as PricingMode) ?? base.mode,
        supplierCurrency: (it.supplier_currency as PricingInputs["supplierCurrency"]) ?? base.supplierCurrency,
        supplierPricePerCase: it.supplier_price_per_case ?? base.supplierPricePerCase,
        // shipment-derived, split per bottle (locked in the editor):
        localTransportEur: a?.localTransportEur ?? 0,
        localTransportCurrency: a?.localTransportCurrency ?? base.localTransportCurrency,
        internationalFreightEur: a?.internationalFreightEur ?? 0,
        internationalFreightCurrency:
          a?.internationalFreightCurrency ?? base.internationalFreightCurrency,
        freightMode: a?.freightMode ?? base.freightMode,
        domLogisticsTotal: a?.domLogisticsTotal ?? 0,
        orderCases: a?.orderCases ?? Math.max(1, it.quantity_cases),
      };
      return { inputs, product };
    },
    [productMap, settings]
  );

  const allocFor = useCallback(
    (ship: ShipmentRow, list: ItemRow[]) =>
      allocateShipment(ship, list.map((it) => ({
        id: it.id,
        quantity_cases: it.quantity_cases,
        bottlesPerCase: bpcOf(productMap[it.product_id]),
      }))),
    [productMap]
  );

  // Recompute every item's result with the current split + persist denormalised.
  const recomputeAll = useCallback(
    async (ship: ShipmentRow, list: ItemRow[]) => {
      const alloc = allocFor(ship, list);
      const updated: ItemRow[] = [];
      for (const it of list) {
        const { inputs, product } = buildInputs(ship, it, alloc);
        const abv = product?.abv ?? 0;
        const sizeMl = product?.size_ml ?? 700;
        const bpc = bpcOf(product);
        const r = calcPricing(inputs, abv, sizeMl, bpc);
        const patch = {
          result_landed_cost_case: r.totalLandedCostPerCase,
          result_min_price_case: r.minSellingPricePerCase,
          result_max_supplier_case: r.maxSupplierPriceEur,
          result_actual_margin_pct: r.actualMarginPct,
          calculation_snapshot: JSON.parse(
            JSON.stringify({ inputs, result: r, snapshotVersion: 1 })
          ),
          updated_at: new Date().toISOString(),
        };
        await supabase.from("shipment_items").update(patch).eq("id", it.id);
        updated.push({ ...it, ...patch });
      }
      setItems(updated);
    },
    [allocFor, buildInputs]
  );

  const addBottle = async () => {
    if (!shipment || !addProductId) return;
    const cases = Math.max(1, parseInt(addCases) || 1);
    // Prefill supplier price from the product's newest recorded price.
    const { data: priceRow } = await supabase
      .from("product_prices")
      .select("amount, unit, currency, bottles_per_case")
      .eq("product_id", addProductId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let supPerCase: number | null = null;
    let supCur = "EUR";
    if (priceRow) {
      const amt = Number(priceRow.amount) || 0;
      supPerCase =
        priceRow.unit === "case" ? amt : amt * (priceRow.bottles_per_case || 1);
      supCur = priceRow.currency || "EUR";
    }
    const { data } = await supabase
      .from("shipment_items")
      .insert({
        shipment_id: shipment.id,
        product_id: addProductId,
        quantity_cases: cases,
        supplier_price_per_case: supPerCase,
        supplier_currency: supCur,
      })
      .select()
      .single();
    setAddProductId("");
    setAddCases("1");
    if (data) {
      const next = [...items, data as ItemRow];
      setItems(next);
      await recomputeAll(shipment, next);
    }
  };

  const setItemCases = async (itemId: string, cases: number) => {
    if (!shipment) return;
    const q = Math.max(1, cases || 1);
    const next = items.map((it) =>
      it.id === itemId ? { ...it, quantity_cases: q } : it
    );
    setItems(next);
    await supabase
      .from("shipment_items")
      .update({ quantity_cases: q, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    await recomputeAll(shipment, next); // total bottles changed → re-split all
  };

  const deleteItem = async (itemId: string) => {
    if (!shipment) return;
    if (!confirm("Remove this bottle from the shipment?")) return;
    await supabase.from("shipment_items").delete().eq("id", itemId);
    const next = items.filter((it) => it.id !== itemId);
    setItems(next);
    if (openItemId === itemId) setOpenItemId(null);
    await recomputeAll(shipment, next);
  };

  // ── Per-bottle calculator ────────────────────────────────────────────────
  const openItem = items.find((it) => it.id === openItemId) ?? null;
  const openProduct = openItem ? productMap[openItem.product_id] ?? null : null;

  const openBottle = (it: ItemRow) => {
    if (!shipment) return;
    const alloc = allocFor(shipment, items);
    const { inputs } = buildInputs(shipment, it, alloc);
    setItemInputs(inputs);
    setOpenItemId(it.id);
  };

  // Re-apply shipment-locked fields after any panel change.
  const lockShipment = useCallback(
    (inp: PricingInputs): PricingInputs => {
      if (!shipment || !openItem) return inp;
      const a = allocFor(shipment, items)[openItem.id];
      if (!a) return inp;
      return {
        ...inp,
        localTransportEur: a.localTransportEur,
        localTransportCurrency: a.localTransportCurrency,
        internationalFreightEur: a.internationalFreightEur,
        internationalFreightCurrency: a.internationalFreightCurrency,
        freightMode: a.freightMode,
        domLogisticsTotal: a.domLogisticsTotal,
        orderCases: a.orderCases,
      };
    },
    [shipment, openItem, items, allocFor]
  );

  const openAbv = openProduct?.abv ?? 0;
  const openSizeMl = openProduct?.size_ml ?? 700;
  const openBpc = bpcOf(openProduct);
  const openResult = useMemo(() => {
    if (!itemInputs) return null;
    if (itemInputs.mode === "cost_up" && itemInputs.supplierPricePerCase === 0)
      return null;
    if (
      itemInputs.mode === "price_down" &&
      (!itemInputs.targetPricePerCase || itemInputs.targetPricePerCase === 0)
    )
      return null;
    return calcPricing(itemInputs, openAbv, openSizeMl, openBpc);
  }, [itemInputs, openAbv, openSizeMl, openBpc]);

  const saveOpenItem = async () => {
    if (!openItem || !itemInputs || !shipment) return;
    await supabase
      .from("shipment_items")
      .update({
        mode: itemInputs.mode,
        supplier_price_per_case: itemInputs.supplierPricePerCase,
        supplier_currency: itemInputs.supplierCurrency,
        calculation_snapshot: JSON.parse(
          JSON.stringify({ inputs: itemInputs, result: openResult, snapshotVersion: 1 })
        ),
        result_landed_cost_case: openResult?.totalLandedCostPerCase ?? null,
        result_min_price_case: openResult?.minSellingPricePerCase ?? null,
        result_max_supplier_case: openResult?.maxSupplierPriceEur ?? null,
        result_actual_margin_pct: openResult?.actualMarginPct ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", openItem.id);
    setItems((p) =>
      p.map((it) =>
        it.id === openItem.id
          ? {
              ...it,
              mode: itemInputs.mode,
              supplier_price_per_case: itemInputs.supplierPricePerCase,
              supplier_currency: itemInputs.supplierCurrency,
              result_landed_cost_case: openResult?.totalLandedCostPerCase ?? null,
              result_min_price_case: openResult?.minSellingPricePerCase ?? null,
              result_max_supplier_case: openResult?.maxSupplierPriceEur ?? null,
              result_actual_margin_pct: openResult?.actualMarginPct ?? null,
            }
          : it
      )
    );
    setOpenItemId(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="mc-skeleton h-10" />
        <div className="mc-skeleton h-64" />
      </div>
    );
  }

  // Per-bottle calculator view
  if (openItem && itemInputs) {
    return (
      <div>
        <button
          onClick={() => setOpenItemId(null)}
          className="inline-flex items-center gap-1.5 text-[11px] mb-4"
          style={{ color: "var(--mc-text-muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          <ArrowLeft className="w-3 h-3" /> Back to shipment
        </button>
        <div className="flex gap-1 mb-4">
          {(["cost_up", "price_down"] as PricingMode[]).map((m) => {
            const active = itemInputs.mode === m;
            return (
              <button
                key={m}
                onClick={() => setItemInputs((p) => (p ? { ...p, mode: m } : p))}
                className="px-4 py-2 text-xs font-semibold tracking-[0.06em] uppercase"
                style={{
                  background: active ? "var(--mc-cream)" : "var(--mc-surface-elevated)",
                  color: active ? "var(--mc-dark)" : "var(--mc-text-muted)",
                  border: "1px solid var(--mc-border)",
                }}
              >
                {m === "cost_up" ? "Cost-Up (Forward)" : "Price-Down (Backward)"}
              </button>
            );
          })}
          <span className="ml-auto text-[10px] self-center" style={{ color: "var(--mc-text-muted)" }}>
            Freight / transport legs come from the shipment, split per bottle (locked).
          </span>
        </div>
        <div className="flex gap-6 items-start">
          <div className="w-[420px] flex-shrink-0">
            <PricingInputPanel
              inputs={itemInputs}
              onChange={(inp) => setItemInputs(lockShipment(inp))}
              products={openProduct ? [openProduct] : []}
              settings={settings}
              selectedProduct={openProduct}
            />
          </div>
          <div className="flex-1 min-w-0">
            <PricingResultsPanel
              result={openResult}
              inputs={itemInputs}
              bottlesPerCase={openBpc}
              selectedProduct={openProduct}
              settings={settings}
              onSave={saveOpenItem}
              editingName={openProduct?.name ?? null}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>
      {/* Shipments list */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          borderRight: "1px solid var(--mc-border)",
          paddingRight: 12,
        }}
      >
        <div className="flex gap-1.5 mb-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New shipment name…"
            className="mc-input"
            style={{ fontSize: "0.6875rem", height: 30 }}
            onKeyDown={(e) => e.key === "Enter" && createShipment()}
          />
          <button
            onClick={createShipment}
            disabled={!newName.trim()}
            className="mc-btn mc-btn-primary"
            style={{ flexShrink: 0, padding: "0 10px" }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {shipments.length === 0 ? (
          <p className="text-xs py-6 text-center" style={{ color: "var(--mc-text-muted)" }}>
            No shipments yet.
          </p>
        ) : (
          shipments.map((s) => (
            <button
              key={s.id}
              onClick={() => selectShipment(s.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "9px 10px",
                background: sel === s.id ? "rgba(236,223,204,0.08)" : "transparent",
                borderLeft:
                  sel === s.id ? "2px solid var(--mc-cream)" : "2px solid transparent",
                borderBottom: "1px solid var(--mc-border)",
                cursor: "pointer",
              }}
            >
              <p
                className="text-xs font-medium"
                style={{ color: sel === s.id ? "var(--mc-cream)" : "var(--mc-text-primary)" }}
              >
                {s.name}
              </p>
              <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                {s.status} ·{" "}
                {new Date(s.created_at).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </button>
          ))
        )}
      </div>

      {/* Detail */}
      <div style={{ flex: 1, minWidth: 0, paddingLeft: 20 }}>
        {!shipment ? (
          <EmptyState
            icon={Ship}
            title="Select a shipment"
            description="Pick a shipment on the left, or create one. Its fixed costs are split per bottle across all items."
          />
        ) : (
          <ShipmentDetail
            shipment={shipment}
            items={items}
            productMap={productMap}
            products={products}
            addProductId={addProductId}
            addCases={addCases}
            setAddProductId={setAddProductId}
            setAddCases={setAddCases}
            onPatch={patchShipment}
            onAddBottle={addBottle}
            onSetCases={setItemCases}
            onDelete={deleteItem}
            onOpen={openBottle}
          />
        )}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onCommit,
  width = 110,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  width?: number;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <div>
      <label className="mc-label">{label}</label>
      <input
        type="number"
        step="0.01"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onCommit(parseFloat(v) || 0)}
        className="mc-input"
        style={{ width }}
      />
    </div>
  );
}

function ShipmentDetail({
  shipment,
  items,
  productMap,
  products,
  addProductId,
  addCases,
  setAddProductId,
  setAddCases,
  onPatch,
  onAddBottle,
  onSetCases,
  onDelete,
  onOpen,
}: {
  shipment: ShipmentRow;
  items: ItemRow[];
  productMap: Record<string, ProductRow>;
  products: ProductRow[];
  addProductId: string;
  addCases: string;
  setAddProductId: (v: string) => void;
  setAddCases: (v: string) => void;
  onPatch: (p: Partial<ShipmentRow>) => void;
  onAddBottle: () => void;
  onSetCases: (id: string, n: number) => void;
  onDelete: (id: string) => void;
  onOpen: (it: ItemRow) => void;
}) {
  const totalCases = items.reduce((s, it) => s + it.quantity_cases, 0);
  const totalBottles = items.reduce(
    (s, it) => s + it.quantity_cases * (productMap[it.product_id]?.bottles_per_case ?? productMap[it.product_id]?.case_size ?? 6),
    0
  );
  const curSym: Record<string, string> = { EUR: "€", USD: "$", MXN: "MX$" };

  return (
    <div className="space-y-5">
      {/* Fixed-cost header */}
      <div className="mc-card p-5">
        <div className="flex items-center justify-between mb-4">
          <input
            value={shipment.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            className="mc-input"
            style={{ maxWidth: 280, fontWeight: 600 }}
          />
          <select
            value={shipment.status}
            onChange={(e) => onPatch({ status: e.target.value })}
            className="mc-input mc-select"
            style={{ width: 130 }}
          >
            {["draft", "ordered", "in_transit", "arrived", "closed"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <NumField label="Pallets" value={shipment.pallets ?? 0} onCommit={(n) => onPatch({ pallets: Math.round(n) })} width={70} />
          <div>
            <label className="mc-label">Freight mode</label>
            <select
              value={shipment.freight_mode}
              onChange={(e) => onPatch({ freight_mode: e.target.value })}
              className="mc-input mc-select"
              style={{ width: 90 }}
            >
              <option value="sea">Sea</option>
              <option value="air">Air</option>
              <option value="land">Land</option>
            </select>
          </div>
          <div>
            <label className="mc-label">Producer → port</label>
            <div className="flex gap-1">
              <NumField label="" value={shipment.local_transport_amount} onCommit={(n) => onPatch({ local_transport_amount: n })} />
              <select
                value={shipment.local_transport_currency}
                onChange={(e) => onPatch({ local_transport_currency: e.target.value })}
                className="mc-input mc-select"
                style={{ width: 70 }}
              >
                {["EUR", "USD", "MXN"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mc-label">Port → Germany</label>
            <div className="flex gap-1">
              <NumField label="" value={shipment.intl_freight_amount} onCommit={(n) => onPatch({ intl_freight_amount: n })} />
              <select
                value={shipment.intl_freight_currency}
                onChange={(e) => onPatch({ intl_freight_currency: e.target.value })}
                className="mc-input mc-select"
                style={{ width: 70 }}
              >
                {["EUR", "USD", "MXN"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <NumField label="German port → warehouse (€)" value={shipment.dom_logistics_eur} onCommit={(n) => onPatch({ dom_logistics_eur: n })} width={130} />
        </div>
        <p className="text-[10px] mt-3" style={{ color: "var(--mc-text-muted)" }}>
          {totalCases} cases · {totalBottles} bottles in this shipment. Each leg is split
          per bottle ({curSym[shipment.local_transport_currency]}
          {totalBottles > 0 ? (shipment.local_transport_amount / totalBottles).toFixed(4) : "0"} /btl producer→port,{" "}
          {curSym[shipment.intl_freight_currency]}
          {totalBottles > 0 ? (shipment.intl_freight_amount / totalBottles).toFixed(4) : "0"} /btl port→DE, €
          {totalBottles > 0 ? (shipment.dom_logistics_eur / totalBottles).toFixed(4) : "0"} /btl DE→whse) and fed into each bottle's calculation.
        </p>
      </div>

      {/* Bottles */}
      <div className="mc-card p-5">
        <h3 className="text-xs font-semibold tracking-[0.08em] uppercase mb-3" style={{ color: "var(--mc-text-muted)" }}>
          Bottles in this shipment
        </h3>
        <div className="flex gap-2 mb-4">
          <select
            value={addProductId}
            onChange={(e) => setAddProductId(e.target.value)}
            className="mc-input mc-select"
            style={{ flex: 1 }}
          >
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand ? `${p.brand} — ${p.name}` : p.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={addCases}
            onChange={(e) => setAddCases(e.target.value)}
            className="mc-input"
            style={{ width: 90 }}
            placeholder="Cases"
          />
          <button
            onClick={onAddBottle}
            disabled={!addProductId}
            className="mc-btn mc-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" /> Add bottle
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-xs py-6 text-center" style={{ color: "var(--mc-text-muted)" }}>
            No bottles yet — add a product above.
          </p>
        ) : (
          <div style={{ border: "1px solid var(--mc-border)" }}>
            {items.map((it, i) => {
              const p = productMap[it.product_id];
              const bpc = p?.bottles_per_case ?? p?.case_size ?? 6;
              return (
                <div
                  key={it.id}
                  className="px-4 py-3 flex items-center gap-3"
                  style={{ borderBottom: i < items.length - 1 ? "1px solid var(--mc-border)" : "none" }}
                >
                  <button
                    onClick={() => onOpen(it)}
                    className="flex-1 min-w-0 text-left"
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    <p className="text-xs font-medium" style={{ color: "var(--mc-text-primary)" }}>
                      {p ? (p.brand ? `${p.brand} — ${p.name}` : p.name) : it.product_id.slice(0, 8)}
                      <ChevronRight className="w-3 h-3 inline ml-1" style={{ color: "var(--mc-text-muted)" }} />
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
                      {it.quantity_cases * bpc} bottles ·{" "}
                      {it.result_landed_cost_case != null
                        ? `landed ${fmtEUR(it.result_landed_cost_case)}/case`
                        : "not calculated"}
                      {it.result_min_price_case != null
                        ? ` · min sell ${fmtEUR(it.result_min_price_case)}/case`
                        : ""}
                      {it.result_actual_margin_pct != null
                        ? ` · ${it.result_actual_margin_pct.toFixed(1)}%`
                        : ""}
                    </p>
                  </button>
                  <div>
                    <label className="mc-label">Cases</label>
                    <input
                      type="number"
                      min="1"
                      defaultValue={it.quantity_cases}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value) || 1;
                        if (n !== it.quantity_cases) onSetCases(it.id, n);
                      }}
                      className="mc-input"
                      style={{ width: 80 }}
                    />
                  </div>
                  <button
                    onClick={() => onDelete(it.id)}
                    className="mc-btn mc-btn-danger"
                    style={{ fontSize: 11 }}
                    title="Remove bottle"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
