"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import PricingInputPanel from "@/components/pricing/PricingInputPanel";
import PricingResultsPanel from "@/components/pricing/PricingResultsPanel";
import SaveScenarioDialog from "@/components/pricing/SaveScenarioDialog";
import ShipmentsWorkspace from "@/components/pricing/ShipmentsWorkspace";
import { calcPricing, DEFAULT_PRICING_INPUTS } from "@/components/pricing/pricingCalc";
import { toast } from "@/components/ui/Toast";
import { Calculator } from "lucide-react";
import type { PricingInputs, PricingMode, PricingSystemSetting } from "@mecanova/shared";
import type { ExportBundle } from "@/lib/pricingExport/types";
import { downloadBlob, exportFilename } from "@/lib/pricingExport/download";

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

interface EditingScenario {
  id: string;
  name: string;
  notes: string;
}

function PricingPageInner() {
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenarioId");
  const preselectedProductId = searchParams.get("productId");

  const [inputs, setInputs] = useState<PricingInputs>(DEFAULT_PRICING_INPUTS);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [settings, setSettings] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingScenario, setEditingScenario] = useState<EditingScenario | null>(null);
  const [view, setView] = useState<"calculator" | "shipments">("calculator");
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const [{ data: prods }, { data: setts }] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, brand, abv, size_ml, bottles_per_case, case_size, hs_code")
          .eq("active", true)
          .order("name"),
        supabase.from("pricing_system_settings").select("key, value_numeric"),
      ]);
      if (prods) setProducts(prods);

      let defaultInputs: Partial<PricingInputs> = {};
      if (setts) {
        const map: Record<string, number> = {};
        for (const s of setts as PricingSystemSetting[]) {
          if (s.value_numeric !== null) map[s.key] = s.value_numeric;
        }
        setSettings(map);
        defaultInputs = {
          fxUsdEur: map.default_fx_usd_eur,
          fxMxnEur: map.default_fx_mxn_eur,
          exciseRatePerHl: map.branntweinsteuer_per_hl,
          importVatRate: map.default_import_vat_rate,
        };
      }

      // If editing an existing scenario, hydrate inputs from it
      if (scenarioId) {
        const { data: scenario } = await supabase
          .from("product_pricing_scenarios")
          .select("id, name, notes, calculation_snapshot")
          .eq("id", scenarioId)
          .single();

        if (scenario?.calculation_snapshot) {
          const snap = scenario.calculation_snapshot as unknown as { inputs: PricingInputs };
          setInputs(snap.inputs);
          setEditingScenario({
            id: scenario.id,
            name: scenario.name,
            notes: scenario.notes ?? "",
          });
          return;
        }
      }

      // Apply system defaults + optional product preselect
      setInputs((prev) => ({
        ...prev,
        ...(defaultInputs.fxUsdEur !== undefined && { fxUsdEur: defaultInputs.fxUsdEur }),
        ...(defaultInputs.fxMxnEur !== undefined && { fxMxnEur: defaultInputs.fxMxnEur }),
        ...(defaultInputs.exciseRatePerHl !== undefined && { exciseRatePerHl: defaultInputs.exciseRatePerHl }),
        ...(defaultInputs.importVatRate !== undefined && { importVatRate: defaultInputs.importVatRate }),
        ...(preselectedProductId && { productId: preselectedProductId }),
      }));
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === inputs.productId) ?? null,
    [products, inputs.productId]
  );

  const abv = selectedProduct?.abv ?? 0;
  const sizeMl = selectedProduct?.size_ml ?? 700;
  const bottlesPerCase = selectedProduct?.bottles_per_case ?? selectedProduct?.case_size ?? 6;

  const result = useMemo(() => {
    if (inputs.mode === "cost_up" && inputs.supplierPricePerCase === 0) return null;
    if (inputs.mode === "price_down" && (!inputs.targetPricePerCase || inputs.targetPricePerCase === 0)) return null;
    return calcPricing(inputs, abv, sizeMl, bottlesPerCase);
  }, [inputs, abv, sizeMl, bottlesPerCase]);

  const setMode = (mode: PricingMode) => setInputs((p) => ({ ...p, mode }));

  const handleExport = async (kind: "pdf" | "excel") => {
    if (!result || !selectedProduct) return;
    const bundle: ExportBundle = {
      inputs,
      result,
      productName: selectedProduct.name,
      productBrand: selectedProduct.brand,
      abv,
      sizeMl,
      bottlesPerCase,
      scenarioName: editingScenario?.name,
      notes: editingScenario?.notes || null,
    };
    const filename = exportFilename(
      { productName: selectedProduct.name, scenarioName: editingScenario?.name },
      kind === "pdf" ? "pdf" : "xlsx"
    );
    if (kind === "pdf") {
      const { exportToPdf } = await import("@/lib/pricingExport/pdf");
      const blob = await exportToPdf(bundle);
      downloadBlob(blob, filename);
    } else {
      const { exportToExcel } = await import("@/lib/pricingExport/excel");
      const blob = await exportToExcel(bundle);
      downloadBlob(blob, filename);
    }
  };

  const handleSave = async (name: string, notes: string) => {
    if (!result) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }

    const payload = JSON.parse(JSON.stringify({
      name,
      notes: notes || null,
      product_id: inputs.productId || null,
      mode: inputs.mode,
      supplier_currency: inputs.supplierCurrency,
      result_landed_cost_case: result.totalLandedCostPerCase,
      result_min_price_case: result.minSellingPricePerCase,
      result_max_supplier_case: result.maxSupplierPriceEur,
      result_actual_margin_pct: result.actualMarginPct,
      volume_tiers: inputs.volumeTiers,
      calculation_snapshot: { inputs, result, mode: inputs.mode, snapshotVersion: 1 },
    }));

    let error;
    if (editingScenario) {
      ({ error } = await supabase
        .from("product_pricing_scenarios")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingScenario.id));
    } else {
      ({ error } = await supabase
        .from("product_pricing_scenarios")
        .insert({ ...payload, created_by: user.id }));
    }

    setSaving(false);
    if (error) {
      toast.error("Failed to save measurement");
      return;
    }

    toast.success(editingScenario ? "Changes saved" : "Measurement saved");
    setDialogOpen(false);

    if (editingScenario) {
      setEditingScenario({ ...editingScenario, name, notes });
    }
  };

  return (
    <div>
      <PageHeader
        title="Pricing Calculator"
        description="Cost-Up: supplier price → minimum selling price. Price-Down: customer price → maximum supplier price."
        icon={Calculator}
      />

      <div className="flex gap-1 mb-5">
        {(["calculator", "shipments"] as const).map((v) => {
          const active = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-4 py-2 text-xs font-semibold tracking-[0.06em] uppercase transition-colors"
              style={{
                background: active ? "var(--mc-cream)" : "var(--mc-surface-elevated)",
                color: active ? "var(--mc-dark)" : "var(--mc-text-muted)",
                border: "1px solid var(--mc-border)",
              }}
            >
              {v === "calculator" ? "Calculator" : "Shipments"}
            </button>
          );
        })}
      </div>

      {view === "shipments" && <ShipmentsWorkspace />}

      {view === "calculator" && (
      <>
      {/* Mode toggle */}
      <div className="flex gap-1 mb-6">
        {(["cost_up", "price_down"] as PricingMode[]).map((m) => {
          const active = inputs.mode === m;
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-4 py-2 text-xs font-semibold tracking-[0.06em] uppercase transition-colors"
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
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-6 items-start">
        {/* Left: inputs */}
        <div className="w-[420px] flex-shrink-0">
          <PricingInputPanel
            inputs={inputs}
            onChange={setInputs}
            products={products}
            settings={settings}
            selectedProduct={selectedProduct}
          />
        </div>

        {/* Right: results */}
        <div className="flex-1 min-w-0">
          <PricingResultsPanel
            result={result}
            inputs={inputs}
            bottlesPerCase={bottlesPerCase}
            selectedProduct={selectedProduct}
            settings={settings}
            onSave={() => setDialogOpen(true)}
            editingName={editingScenario?.name ?? null}
            onExport={result ? handleExport : undefined}
          />
        </div>
      </div>

      <SaveScenarioDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        isSaving={saving}
        isEditing={!!editingScenario}
        initialName={editingScenario?.name ?? ""}
        initialNotes={editingScenario?.notes ?? ""}
      />
      </>
      )}
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingPageInner />
    </Suspense>
  );
}
