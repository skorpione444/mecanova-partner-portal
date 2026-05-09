"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import PricingInputPanel from "@/components/pricing/PricingInputPanel";
import PricingResultsPanel from "@/components/pricing/PricingResultsPanel";
import { calcPricing, DEFAULT_PRICING_INPUTS } from "@/components/pricing/pricingCalc";
import { Calculator } from "lucide-react";
import type { PricingInputs, PricingMode, PricingSystemSetting } from "@mecanova/shared";

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

export default function PricingPage() {
  const [inputs, setInputs] = useState<PricingInputs>(DEFAULT_PRICING_INPUTS);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [settings, setSettings] = useState<Record<string, number>>({});
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
      if (setts) {
        const map: Record<string, number> = {};
        for (const s of setts as PricingSystemSetting[]) {
          if (s.value_numeric !== null) map[s.key] = s.value_numeric;
        }
        setSettings(map);
        // Apply system defaults to initial inputs
        setInputs((prev) => ({
          ...prev,
          fxUsdEur: map.default_fx_usd_eur ?? prev.fxUsdEur,
          fxMxnEur: map.default_fx_mxn_eur ?? prev.fxMxnEur,
          exciseRatePerHl: map.branntweinsteuer_per_hl ?? prev.exciseRatePerHl,
          importVatRate: map.default_import_vat_rate ?? prev.importVatRate,
        }));
      }
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
    if (!inputs.productId && inputs.supplierPricePerCase === 0) return null;
    return calcPricing(inputs, abv, sizeMl, bottlesPerCase);
  }, [inputs, abv, sizeMl, bottlesPerCase]);

  const setMode = (mode: PricingMode) => setInputs((p) => ({ ...p, mode }));

  return (
    <div>
      <PageHeader
        title="Pricing Calculator"
        description="Cost-Up: supplier price → minimum selling price. Price-Down: customer price → maximum supplier price."
        icon={Calculator}
      />

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
          />
        </div>
      </div>
    </div>
  );
}
