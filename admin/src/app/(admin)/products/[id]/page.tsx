"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import type { Product, ProductAsset, PricingResult } from "@mecanova/shared";
import {
  Package,
  ArrowLeft,
  Edit,
  ToggleLeft,
  ToggleRight,
  Factory,
  FileText,
  Image,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Calculator,
  Trash2,
} from "lucide-react";
import CostBreakdownBar from "@/components/CostBreakdownBar";

interface ScenarioRow {
  id: string;
  name: string;
  notes: string | null;
  mode: string;
  result_min_price_case: number | null;
  result_max_supplier_case: number | null;
  result_landed_cost_case: number | null;
  result_actual_margin_pct: number | null;
  created_at: string;
  calculation_snapshot: {
    inputs: Record<string, unknown>;
    result: PricingResult;
    snapshotVersion: number;
  } | null;
}

function buildBarItems(result: PricingResult) {
  return [
    { label: "Supplier", value: result.supplierPriceEur },
    { label: "FX buffer", value: result.fxBufferCost },
    { label: "Freight", value: result.freightAndInsurance },
    { label: "Breakage", value: result.breakageCost },
    { label: "Customs", value: result.customsDuty },
    { label: "Excise", value: result.excisePerCase },
    { label: "Dom. logistics", value: result.domLogistics },
    { label: "Warehousing", value: result.warehousing },
    { label: "Distributor", value: result.distributorFee },
    { label: "Labeling", value: result.labeling },
    { label: "Samples", value: result.sampleAllocation },
    { label: "Overhead", value: result.overhead },
  ].filter((item) => item.value > 0);
}

const CATEGORY_LABELS: Record<string, string> = {
  tequila: "Tequila",
  mezcal: "Mezcal",
  raicilla: "Raicilla",
  other: "Other",
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  bottle_shot: "Bottle Shot",
  label_pdf: "Label PDF",
  spec_sheet: "Spec Sheet",
  brand_deck: "Brand Deck",
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [product, setProduct] = useState<Product & { supplier_name?: string } | null>(null);
  const [assets, setAssets] = useState<ProductAsset[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: productData } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (!productData) {
      router.push("/products");
      return;
    }

    let supplierName: string | undefined;
    if (productData.supplier_id) {
      const { data: supplierData } = await supabase
        .from("partners")
        .select("name")
        .eq("id", productData.supplier_id)
        .single();
      supplierName = supplierData?.name || undefined;
    }

    setProduct({ ...productData, supplier_name: supplierName });

    // Product assets
    const { data: assetData } = await supabase
      .from("product_assets")
      .select("*")
      .eq("product_id", id)
      .order("type");
    setAssets(assetData || []);

    // Pricing scenarios
    const { data: scenarioData } = await supabase
      .from("product_pricing_scenarios")
      .select("id, name, notes, mode, result_min_price_case, result_max_supplier_case, result_landed_cost_case, result_actual_margin_pct, created_at, calculation_snapshot")
      .eq("product_id", id)
      .order("created_at", { ascending: false });
    setScenarios((scenarioData as ScenarioRow[]) || []);

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const deleteScenario = async (scenarioId: string) => {
    if (!confirm("Delete this measurement? This cannot be undone.")) return;
    await supabase.from("product_pricing_scenarios").delete().eq("id", scenarioId);
    setScenarios((prev) => prev.filter((s) => s.id !== scenarioId));
    if (expandedId === scenarioId) setExpandedId(null);
  };

  const toggleActive = async () => {
    if (!product) return;
    setToggling(true);
    await supabase.from("products").update({ active: !product.active }).eq("id", id);
    setProduct({ ...product, active: !product.active });
    setToggling(false);
  };

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-6 w-48 mb-6" />
        <div className="mc-skeleton h-48" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div>
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4 transition-colors"
        style={{ color: "var(--mc-text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Products
      </Link>

      <PageHeader
        title={product.name}
        description={`${product.brand || "No brand"} — ${CATEGORY_LABELS[product.category] ?? product.category}`}
        icon={Package}
        actions={
          <div className="flex gap-2">
            <button
              onClick={toggleActive}
              disabled={toggling}
              className={`mc-btn ${product.active ? "mc-btn-danger" : "mc-btn-success"}`}
            >
              {product.active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              {product.active ? "Deactivate" : "Activate"}
            </button>
            <Link href={`/products/${id}/edit`} className="mc-btn mc-btn-ghost">
              <Edit className="w-3.5 h-3.5" />
              Edit
            </Link>
          </div>
        }
      />

      <div className="space-y-5">
          {/* Product Details */}
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Product Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="mc-label">Category</p>
                <span
                  className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                  style={{
                    background: "var(--mc-surface-elevated)",
                    border: "1px solid var(--mc-border)",
                    color: "var(--mc-text-muted)",
                  }}
                >
                  {CATEGORY_LABELS[product.category] ?? product.category}
                </span>
              </div>
              <div>
                <p className="mc-label">ABV</p>
                <p className="text-sm">{product.abv ? `${product.abv}%` : "—"}</p>
              </div>
              <div>
                <p className="mc-label">Bottle Size</p>
                <p className="text-sm">{product.size_ml ? `${product.size_ml} ml` : "—"}</p>
              </div>
              <div>
                <p className="mc-label">Bottles / Case</p>
                <p className="text-sm">{product.bottles_per_case ?? "—"}</p>
              </div>
              <div>
                <p className="mc-label">Case Size</p>
                <p className="text-sm">{product.case_size ? `${product.case_size} bottles` : "—"}</p>
              </div>
              <div>
                <p className="mc-label">SKU</p>
                <p className="text-sm font-mono">{product.sku || "—"}</p>
              </div>
              <div>
                <p className="mc-label">Status</p>
                <span
                  className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                  style={{
                    background: product.active ? "var(--mc-success-bg)" : "var(--mc-error-bg)",
                    border: `1px solid ${product.active ? "var(--mc-success-light)" : "var(--mc-error-light)"}`,
                    color: product.active ? "var(--mc-success)" : "var(--mc-error)",
                  }}
                >
                  {product.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {/* Supplier */}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--mc-border)" }}>
              <p className="mc-label mb-1.5">Supplier</p>
              {product.supplier_name && product.supplier_id ? (
                <Link
                  href={`/partners/${product.supplier_id}`}
                  className="inline-flex items-center gap-2 px-3 py-2 transition-all"
                  style={{
                    background: "var(--mc-surface-elevated)",
                    border: "1px solid var(--mc-border)",
                    color: "var(--mc-cream-subtle)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--mc-cream)";
                    e.currentTarget.style.borderColor = "var(--mc-cream-subtle)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--mc-cream-subtle)";
                    e.currentTarget.style.borderColor = "var(--mc-border)";
                  }}
                >
                  <Factory className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs font-medium">{product.supplier_name}</span>
                  <ExternalLink className="w-3 h-3 ml-2 flex-shrink-0 opacity-40" />
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm" style={{ color: "var(--mc-text-muted)" }}>
                    No supplier assigned
                  </p>
                  <Link
                    href={`/products/${id}/edit`}
                    className="text-[10px] underline"
                    style={{ color: "var(--mc-cream-subtle)" }}
                  >
                    Assign one
                  </Link>
                </div>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--mc-border)" }}>
                <p className="mc-label">Description / Tasting Notes</p>
                <p className="text-sm mt-1" style={{ color: "var(--mc-text-secondary)" }}>
                  {product.description}
                </p>
              </div>
            )}
          </div>

          {/* Product Assets */}
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Product Assets
            </h3>
            {assets.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                No assets attached to this product
              </p>
            ) : (
              <div className="space-y-2">
                {assets.map((asset) => (
                  <a
                    key={asset.id}
                    href={asset.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 group transition-all"
                    style={{
                      background: "var(--mc-surface-elevated)",
                      border: "1px solid var(--mc-border)",
                      color: "var(--mc-text-secondary)",
                      textDecoration: "none",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--mc-cream-subtle)";
                      e.currentTarget.style.color = "var(--mc-cream)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--mc-border)";
                      e.currentTarget.style.color = "var(--mc-text-secondary)";
                    }}
                  >
                    {asset.type === "bottle_shot" ? (
                      <Image className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--mc-text-muted)" }} />
                    ) : (
                      <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--mc-text-muted)" }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">
                        {ASSET_TYPE_LABELS[asset.type] ?? asset.type}
                      </p>
                      {asset.title && (
                        <p className="text-[10px] truncate" style={{ color: "var(--mc-text-muted)" }}>
                          {asset.title}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Pricing Scenarios */}
          <div className="mc-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-xs font-semibold tracking-[0.08em] uppercase"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Pricing Measurements
              </h3>
              <Link
                href={`/pricing?productId=${id}`}
                className="mc-btn mc-btn-ghost"
                style={{ fontSize: 11 }}
              >
                <Calculator className="w-3 h-3" />
                New measurement
              </Link>
            </div>

            {scenarios.length === 0 ? (
              <div className="py-8 text-center" style={{ border: "1px solid var(--mc-border)" }}>
                <p className="text-xs mb-2" style={{ color: "var(--mc-text-muted)" }}>
                  No measurements saved for this product yet.
                </p>
                <Link
                  href={`/pricing?productId=${id}`}
                  className="text-[11px] underline"
                  style={{ color: "var(--mc-cream-subtle)" }}
                >
                  Open in calculator
                </Link>
              </div>
            ) : (
              <div style={{ border: "1px solid var(--mc-border)" }}>
                {scenarios.map((scenario, i) => {
                  const isCostUp = scenario.mode === "cost_up";
                  const endPrice = isCostUp
                    ? scenario.result_min_price_case
                    : scenario.result_max_supplier_case;
                  const margin = scenario.result_actual_margin_pct;
                  const isExpanded = expandedId === scenario.id;
                  const snap = scenario.calculation_snapshot;
                  const snapResult = snap?.result ?? null;
                  const bottlesPerCase = product.bottles_per_case ?? product.case_size ?? 6;
                  const endPricePerBottle = endPrice != null && bottlesPerCase > 0 ? endPrice / bottlesPerCase : null;
                  const landedCostPerBottle = snapResult
                    ? snapResult.totalLandedCostPerBottle
                    : scenario.result_landed_cost_case != null && bottlesPerCase > 0
                    ? scenario.result_landed_cost_case / bottlesPerCase
                    : null;

                  return (
                    <div
                      key={scenario.id}
                      style={{
                        borderBottom: i < scenarios.length - 1 ? "1px solid var(--mc-border)" : "none",
                      }}
                    >
                      {/* Row header — clickable to expand */}
                      <button
                        className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors"
                        style={{
                          background: isExpanded ? "var(--mc-surface-elevated)" : "transparent",
                          cursor: "pointer",
                        }}
                        onClick={() => setExpandedId(isExpanded ? null : scenario.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--mc-text-muted)" }} />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--mc-text-muted)" }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: "var(--mc-text-secondary)" }}>
                            {scenario.name}
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
                            {isCostUp ? "Cost-Up" : "Price-Down"} ·{" "}
                            {new Date(scenario.created_at).toLocaleDateString("de-DE", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {endPrice != null && (
                            <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--mc-cream)" }}>
                              €{endPrice.toFixed(2)}
                              <span className="text-[9px] font-normal ml-1" style={{ color: "var(--mc-text-muted)" }}>
                                /case
                              </span>
                            </p>
                          )}
                          {margin != null && (
                            <p
                              className="text-[10px] tabular-nums"
                              style={{
                                color:
                                  margin >= 35
                                    ? "var(--mc-success)"
                                    : margin >= 20
                                    ? "var(--mc-warning)"
                                    : "var(--mc-error)",
                              }}
                            >
                              {margin.toFixed(1)}% margin
                            </p>
                          )}
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div
                          className="px-4 pb-4 space-y-4"
                          style={{ borderTop: "1px solid var(--mc-border)", paddingTop: "1rem" }}
                        >
                          {/* Key numbers */}
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <p className="mc-label">{isCostUp ? "Min. Selling Price" : "Max Supplier Price"}</p>
                              <p className="text-sm font-semibold tabular-nums mt-0.5" style={{ color: "var(--mc-cream)" }}>
                                {endPrice != null ? `€${endPrice.toFixed(2)}/case` : "—"}
                              </p>
                              {endPricePerBottle != null && (
                                <p className="text-[10px] tabular-nums mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
                                  €{endPricePerBottle.toFixed(2)}/bottle
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="mc-label">Landed Cost</p>
                              <p className="text-sm tabular-nums mt-0.5" style={{ color: "var(--mc-text-secondary)" }}>
                                {scenario.result_landed_cost_case != null
                                  ? `€${scenario.result_landed_cost_case.toFixed(2)}/case`
                                  : "—"}
                              </p>
                              {landedCostPerBottle != null && (
                                <p className="text-[10px] tabular-nums mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
                                  €{landedCostPerBottle.toFixed(2)}/bottle
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="mc-label">Actual Margin</p>
                              <p
                                className="text-sm font-semibold tabular-nums mt-0.5"
                                style={{
                                  color:
                                    (margin ?? 0) >= 35
                                      ? "var(--mc-success)"
                                      : (margin ?? 0) >= 20
                                      ? "var(--mc-warning)"
                                      : "var(--mc-error)",
                                }}
                              >
                                {margin != null ? `${margin.toFixed(1)}%` : "—"}
                              </p>
                            </div>
                          </div>

                          {/* Cost breakdown bar */}
                          {snapResult && (
                            <div
                              className="p-3"
                              style={{ background: "var(--mc-surface)", border: "1px solid var(--mc-border)" }}
                            >
                              <p
                                className="text-[9px] font-semibold uppercase tracking-[0.08em] mb-2"
                                style={{ color: "var(--mc-text-muted)" }}
                              >
                                Cost composition
                              </p>
                              <CostBreakdownBar
                                costs={buildBarItems(snapResult)}
                                total={snapResult.totalLandedCostPerCase}
                              />
                            </div>
                          )}

                          {/* Notes */}
                          {scenario.notes && (
                            <div>
                              <p className="mc-label">Notes</p>
                              <p className="text-xs mt-1" style={{ color: "var(--mc-text-secondary)", whiteSpace: "pre-wrap" }}>
                                {scenario.notes}
                              </p>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 pt-1 flex-wrap">
                            <Link
                              href={`/pricing?scenarioId=${scenario.id}`}
                              className="mc-btn mc-btn-ghost"
                            >
                              <Edit className="w-3 h-3" />
                              Edit in calculator
                            </Link>
                            {snapResult && (
                              <>
                                <button
                                  className="mc-btn mc-btn-ghost"
                                  style={{ fontSize: 11 }}
                                  onClick={async () => {
                                    const { exportToPdf } = await import("@/lib/pricingExport/pdf");
                                    const { downloadBlob, exportFilename } = await import("@/lib/pricingExport/download");
                                    const blob = await exportToPdf({
                                      inputs: snap!.inputs as never,
                                      result: snapResult,
                                      productName: product!.name,
                                      productBrand: product!.brand ?? null,
                                      abv: product!.abv ?? 0,
                                      sizeMl: product!.size_ml ?? 700,
                                      bottlesPerCase,
                                      scenarioName: scenario.name,
                                      notes: scenario.notes,
                                      createdAt: scenario.created_at,
                                    });
                                    downloadBlob(blob, exportFilename({ productName: product!.name, scenarioName: scenario.name }, "pdf"));
                                  }}
                                >
                                  PDF
                                </button>
                                <button
                                  className="mc-btn mc-btn-ghost"
                                  style={{ fontSize: 11 }}
                                  onClick={async () => {
                                    const { exportToExcel } = await import("@/lib/pricingExport/excel");
                                    const { downloadBlob, exportFilename } = await import("@/lib/pricingExport/download");
                                    const blob = await exportToExcel({
                                      inputs: snap!.inputs as never,
                                      result: snapResult,
                                      productName: product!.name,
                                      productBrand: product!.brand ?? null,
                                      abv: product!.abv ?? 0,
                                      sizeMl: product!.size_ml ?? 700,
                                      bottlesPerCase,
                                      scenarioName: scenario.name,
                                      notes: scenario.notes,
                                      createdAt: scenario.created_at,
                                    });
                                    downloadBlob(blob, exportFilename({ productName: product!.name, scenarioName: scenario.name }, "xlsx"));
                                  }}
                                >
                                  Excel
                                </button>
                              </>
                            )}
                            <button
                              className="mc-btn mc-btn-danger"
                              onClick={() => deleteScenario(scenario.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
