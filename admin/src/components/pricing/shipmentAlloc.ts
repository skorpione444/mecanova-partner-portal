import type { SupplierCurrency, FreightMode } from "@mecanova/shared";

// Shipment-level fixed-cost fields (from the `shipments` row).
export interface ShipmentCosts {
  freight_mode: string;
  local_transport_amount: number;
  local_transport_currency: string;
  intl_freight_amount: number;
  intl_freight_currency: string;
  dom_logistics_eur: number;
}

export interface AllocItem {
  id: string;
  quantity_cases: number;
  bottlesPerCase: number;
}

// Per-item overrides fed into PricingInputs so pricingCalc's `÷ orderCases`
// yields the per-bottle-split leg cost. legPerCase = legTotal × bpc / totalBottles.
export interface ItemAllocation {
  localTransportEur: number;
  localTransportCurrency: SupplierCurrency;
  internationalFreightEur: number;
  internationalFreightCurrency: SupplierCurrency;
  freightMode: FreightMode;
  domLogisticsTotal: number;
  orderCases: number;
}

const cur = (c: string): SupplierCurrency =>
  c === "USD" || c === "MXN" ? c : "EUR";
const mode = (m: string): FreightMode =>
  m === "air" || m === "land" ? m : "sea";

/**
 * Split the shipment's 3 fixed-cost legs across every item proportional to its
 * share of the total bottles in the shipment. Returns a map item.id → overrides.
 * Recompute whenever any quantity or any shipment leg changes.
 */
export function allocateShipment(
  shipment: ShipmentCosts,
  items: AllocItem[]
): Record<string, ItemAllocation> {
  const totalBottles = items.reduce(
    (s, it) => s + Math.max(0, it.quantity_cases) * Math.max(0, it.bottlesPerCase),
    0
  );
  const out: Record<string, ItemAllocation> = {};
  for (const it of items) {
    const itemBottles =
      Math.max(0, it.quantity_cases) * Math.max(0, it.bottlesPerCase);
    const share = totalBottles > 0 ? itemBottles / totalBottles : 0;
    out[it.id] = {
      localTransportEur: shipment.local_transport_amount * share,
      localTransportCurrency: cur(shipment.local_transport_currency),
      internationalFreightEur: shipment.intl_freight_amount * share,
      internationalFreightCurrency: cur(shipment.intl_freight_currency),
      freightMode: mode(shipment.freight_mode),
      domLogisticsTotal: shipment.dom_logistics_eur * share,
      orderCases: Math.max(1, it.quantity_cases),
    };
  }
  return out;
}
