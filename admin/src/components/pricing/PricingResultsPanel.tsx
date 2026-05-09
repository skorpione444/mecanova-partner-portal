"use client";

import type { PricingInputs, PricingResult } from "@mecanova/shared";
import CostBreakdownBar from "@/components/CostBreakdownBar";

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  abv: number | null;
  size_ml: number | null;
  bottles_per_case: number | null;
  hs_code: string | null;
}

interface Props {
  result: PricingResult | null;
  inputs: PricingInputs;
  bottlesPerCase: number;
  selectedProduct: ProductRow | null;
  settings: Record<string, number>;
}

const fmt = (v: number) => `€${(v ?? 0).toFixed(2)}`;

interface WaterfallRow {
  label: string;
  value: number;
  note?: string;
  dim?: boolean;
  isTotal?: boolean;
  isHeadline?: boolean;
}

function WaterfallTable({
  rows,
  bottlesPerCase,
}: {
  rows: WaterfallRow[];
  bottlesPerCase: number;
}) {
  return (
    <div style={{ border: "1px solid var(--mc-border)" }}>
      {/* Header */}
      <div
        className="grid text-[9px] font-semibold tracking-[0.08em] uppercase px-3 py-2"
        style={{
          gridTemplateColumns: "1fr 80px 80px",
          color: "var(--mc-text-muted)",
          borderBottom: "1px solid var(--mc-border)",
          background: "var(--mc-surface-elevated)",
        }}
      >
        <span>Cost Item</span>
        <span className="text-right">/ Case</span>
        <span className="text-right">/ Bottle</span>
      </div>

      {rows.map((row, i) => {
        if (row.value === 0 && !row.isTotal && !row.isHeadline) return null;
        const perBottle = bottlesPerCase > 0 ? row.value / bottlesPerCase : 0;
        return (
          <div
            key={i}
            className="grid px-3 py-2 text-xs"
            style={{
              gridTemplateColumns: "1fr 80px 80px",
              borderBottom: i < rows.length - 1 ? "1px solid var(--mc-border)" : "none",
              background: row.isHeadline
                ? "rgba(236, 223, 204, 0.06)"
                : row.isTotal
                ? "var(--mc-surface-elevated)"
                : "transparent",
              color: row.isHeadline
                ? "var(--mc-cream)"
                : row.dim
                ? "var(--mc-text-muted)"
                : "var(--mc-text-secondary)",
              fontWeight: row.isTotal || row.isHeadline ? 600 : 400,
            }}
          >
            <div>
              <span>{row.label}</span>
              {row.note && (
                <span
                  className="ml-1.5 text-[9px]"
                  style={{ color: "var(--mc-text-tertiary)" }}
                >
                  {row.note}
                </span>
              )}
            </div>
            <span className="text-right tabular-nums">{fmt(row.value)}</span>
            <span className="text-right tabular-nums" style={{ color: "var(--mc-text-muted)" }}>
              {fmt(perBottle)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      style={{ border: "1px solid var(--mc-border)", background: "var(--mc-surface)" }}
    >
      <div
        className="w-10 h-10 flex items-center justify-center mb-4"
        style={{ border: "1px solid var(--mc-border)", background: "var(--mc-surface-elevated)" }}
      >
        <span className="text-lg" style={{ color: "var(--mc-text-muted)" }}>€</span>
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: "var(--mc-text-secondary)" }}>
        No calculation yet
      </p>
      <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
        Select a product and enter a supplier price to see the cost breakdown.
      </p>
    </div>
  );
}

export default function PricingResultsPanel({
  result,
  inputs,
  bottlesPerCase,
  selectedProduct,
}: Props) {
  if (!result) return <EmptyState />;

  const isCostUp = inputs.mode === "cost_up";

  // Build waterfall rows for cost-up
  const costUpRows: WaterfallRow[] = [
    { label: inputs.supplierCurrency === "EUR" ? "Supplier price" : `Supplier price (${inputs.supplierCurrency} → EUR)`, value: result.supplierPriceEur - result.fxBufferCost },
    ...(inputs.supplierCurrency !== "EUR" ? [{ label: "FX buffer", value: result.fxBufferCost, note: `${inputs.fxBufferPct}%` }] : []),
    { label: "International Freight", value: result.freightAndInsurance },
    { label: "Breakage allowance", value: result.breakageCost, note: `${inputs.breakagePct}%` },
    { label: "Customs duty", value: result.customsDuty },
    { label: "Branntweinsteuer", value: result.excisePerCase, note: "not reclaimable" },
    { label: "Import VAT", value: result.importVat, note: "reclaimable", dim: true },
    { label: "Domestic logistics", value: result.domLogistics },
    { label: "Warehousing", value: result.warehousing, note: `${inputs.holdingMonths}mo` },
    { label: "Distributor fee", value: result.distributorFee },
    { label: "Labeling / compliance", value: result.labeling },
    { label: "Sample allocation", value: result.sampleAllocation, note: `${inputs.sampleRatePct}%` },
    { label: "Overhead", value: result.overhead, note: `${inputs.overheadPct}%` },
    { label: "TOTAL LANDED COST", value: result.totalLandedCostPerCase, isTotal: true },
    { label: `Target margin (${inputs.targetMarginPct}%)`, value: result.marginAmount },
    { label: "MINIMUM SELLING PRICE", value: result.minSellingPricePerCase, isHeadline: true },
  ];

  // Build waterfall rows for price-down
  const priceDownRows: WaterfallRow[] = [
    { label: "Target customer price", value: inputs.targetPricePerCase, isTotal: true },
    { label: `Desired margin (${inputs.targetMarginPct}%)`, value: inputs.targetPricePerCase * (inputs.targetMarginPct / 100) },
    { label: "Overhead", value: result.overhead },
    { label: "Sample allocation", value: result.sampleAllocation },
    { label: "Labeling / compliance", value: result.labeling },
    { label: "Distributor fee", value: result.distributorFee },
    { label: "Warehousing", value: result.warehousing },
    { label: "Domestic logistics", value: result.domLogistics },
    { label: "Import VAT", value: result.importVat, note: "reclaimable", dim: true },
    { label: "Branntweinsteuer", value: result.excisePerCase, note: "not reclaimable" },
    { label: "Customs duty", value: result.customsDuty },
    { label: "Breakage allowance", value: result.breakageCost },
    { label: "International Freight", value: result.freightAndInsurance },
    ...(inputs.supplierCurrency !== "EUR" ? [{ label: "FX buffer", value: result.fxBufferCost }] : []),
    { label: "MAX SUPPLIER PRICE (EUR)", value: result.maxSupplierPriceEur, isHeadline: true },
  ];

  const rows = isCostUp ? costUpRows : priceDownRows;

  // Bar chart items (exclude headline, totals, dim)
  const barItems = rows
    .filter((r) => !r.isTotal && !r.isHeadline && !r.dim && r.value > 0)
    .map((r) => ({ label: r.label, value: r.value }));

  return (
    <div className="space-y-4">
      {/* Headline card */}
      <div
        className="p-5 flex items-end justify-between"
        style={{ background: "var(--mc-surface)", border: "1px solid var(--mc-border)" }}
      >
        <div>
          <div
            className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-1"
            style={{ color: "var(--mc-text-muted)" }}
          >
            {isCostUp ? "Minimum Selling Price" : "Maximum Supplier Price"}
          </div>
          <div className="text-2xl font-semibold tabular-nums" style={{ color: "var(--mc-cream)", fontFamily: "var(--font-jost), Jost, sans-serif" }}>
            {isCostUp ? fmt(result.minSellingPricePerCase) : fmt(result.maxSupplierPriceEur)}
            <span className="text-sm ml-1 font-normal" style={{ color: "var(--mc-text-muted)" }}>
              / case
            </span>
          </div>
          <div className="text-sm tabular-nums mt-0.5" style={{ color: "var(--mc-text-secondary)" }}>
            {isCostUp ? fmt(result.minSellingPricePerBottle) : fmt(bottlesPerCase > 0 ? result.maxSupplierPriceEur / bottlesPerCase : 0)}
            <span className="text-xs ml-1" style={{ color: "var(--mc-text-muted)" }}>/ bottle</span>
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-1"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Actual Margin
          </div>
          <div
            className="text-xl font-semibold tabular-nums"
            style={{
              color:
                result.actualMarginPct >= 35
                  ? "var(--mc-success)"
                  : result.actualMarginPct >= 20
                  ? "var(--mc-warning)"
                  : "var(--mc-error)",
            }}
          >
            {result.actualMarginPct.toFixed(1)}%
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
            Landed cost: {fmt(result.totalLandedCostPerCase)}/case
          </div>
        </div>
      </div>

      {/* Price-down extra currencies */}
      {!isCostUp && inputs.supplierCurrency !== "EUR" && (
        <div
          className="p-3 flex gap-6 text-xs"
          style={{ background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)" }}
        >
          <div>
            <div className="text-[9px] uppercase tracking-[0.06em] mb-0.5" style={{ color: "var(--mc-text-muted)" }}>
              Max supplier price ({inputs.supplierCurrency})
            </div>
            <div className="font-semibold tabular-nums" style={{ color: "var(--mc-cream)" }}>
              {inputs.supplierCurrency === "USD" ? "$" : ""}
              {result.maxSupplierPriceOrigCurrency.toFixed(2)}
              {inputs.supplierCurrency === "MXN" ? " MXN" : ""}
              <span className="text-[10px] ml-1 font-normal" style={{ color: "var(--mc-text-muted)" }}>
                / case
              </span>
            </div>
          </div>
          <div style={{ borderLeft: "1px solid var(--mc-border)", paddingLeft: "1.5rem" }}>
            <div className="text-[9px] uppercase tracking-[0.06em] mb-0.5" style={{ color: "var(--mc-text-muted)" }}>
              FX rate used
            </div>
            <div className="font-medium" style={{ color: "var(--mc-text-secondary)" }}>
              1 {inputs.supplierCurrency} = €{(inputs.supplierCurrency === "USD" ? inputs.fxUsdEur : inputs.fxMxnEur).toFixed(4)}
            </div>
          </div>
        </div>
      )}

      {/* Cost bar */}
      {barItems.length > 0 && (
        <div
          className="p-3"
          style={{ background: "var(--mc-surface)", border: "1px solid var(--mc-border)" }}
        >
          <div
            className="text-[9px] font-semibold uppercase tracking-[0.08em] mb-2"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Cost composition
          </div>
          <CostBreakdownBar costs={barItems} total={result.totalLandedCostPerCase} />
        </div>
      )}

      {/* Waterfall */}
      <WaterfallTable rows={rows} bottlesPerCase={bottlesPerCase} />

      {/* VAT note */}
      <p className="text-[10px] px-1" style={{ color: "var(--mc-text-tertiary)" }}>
        All prices shown are net of VAT (Netto). Mecanova adds 19% Umsatzsteuer on invoicing. Import VAT (shown dimmed) is reclaimable — only the working capital cost is included in the landed cost.
      </p>

      {/* Volume tier comparison */}
      {result.tierResults.length > 0 && (
        <div>
          <div
            className="text-[10px] font-semibold tracking-[0.08em] uppercase px-3 py-2"
            style={{
              color: "var(--mc-text-muted)",
              background: "var(--mc-surface-elevated)",
              border: "1px solid var(--mc-border)",
              borderBottom: "none",
            }}
          >
            Volume Tier Comparison
          </div>
          <div style={{ border: "1px solid var(--mc-border)" }}>
            {/* Header */}
            <div
              className="grid text-[9px] font-semibold tracking-[0.08em] uppercase px-3 py-2"
              style={{
                gridTemplateColumns: "80px 1fr 1fr 1fr 80px",
                color: "var(--mc-text-muted)",
                borderBottom: "1px solid var(--mc-border)",
                background: "var(--mc-surface-elevated)",
              }}
            >
              <span>Tier</span>
              <span>Cases</span>
              <span>Supp. Price</span>
              <span>{isCostUp ? "Min. Sell Price" : "Max Supp. Price"}</span>
              <span className="text-right">Margin</span>
            </div>
            {result.tierResults.map((tier, i) => (
              <div
                key={i}
                className="grid px-3 py-2 text-xs tabular-nums"
                style={{
                  gridTemplateColumns: "80px 1fr 1fr 1fr 80px",
                  borderBottom: i < result.tierResults.length - 1 ? "1px solid var(--mc-border)" : "none",
                  color: "var(--mc-text-secondary)",
                }}
              >
                <span style={{ color: "var(--mc-text-muted)" }}>Tier {i + 1}</span>
                <span>
                  {tier.from_cases}–{tier.to_cases ?? "∞"}
                </span>
                <span>{fmt(tier.supplier_price)}</span>
                <span style={{ color: "var(--mc-cream)" }}>
                  {isCostUp
                    ? fmt(tier.result_min_price ?? 0)
                    : fmt(tier.result_max_supplier ?? 0)}
                </span>
                <span
                  className="text-right"
                  style={{
                    color:
                      (tier.result_margin_pct ?? 0) >= 35
                        ? "var(--mc-success)"
                        : (tier.result_margin_pct ?? 0) >= 20
                        ? "var(--mc-warning)"
                        : "var(--mc-error)",
                  }}
                >
                  {(tier.result_margin_pct ?? 0).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MOQ warning */}
      {inputs.moqCases && inputs.moqCases > 1 && (
        <div
          className="px-3 py-2.5 text-xs"
          style={{
            background: "rgba(251, 191, 36, 0.06)",
            border: "1px solid rgba(251, 191, 36, 0.25)",
            color: "var(--mc-warning)",
          }}
        >
          Supplier MOQ is {inputs.moqCases} cases. Orders below this quantity are not available at these prices.
        </div>
      )}
    </div>
  );
}
