"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import type { PricingInputs, VolumeTier } from "@mecanova/shared";

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

interface Props {
  inputs: PricingInputs;
  onChange: (inputs: PricingInputs) => void;
  products: ProductRow[];
  settings: Record<string, number>;
  selectedProduct: ProductRow | null;
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--mc-border)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold tracking-[0.08em] uppercase transition-colors"
        style={{ color: "var(--mc-text-secondary)", background: "transparent" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = "var(--mc-text-primary)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "var(--mc-text-secondary)")
        }
      >
        {title}
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function Field({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-[10px] font-medium tracking-[0.06em] uppercase mb-1"
        style={{ color: "var(--mc-text-muted)" }}
      >
        {label}
      </label>
      {children}
      {note && (
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--mc-text-tertiary)" }}>
          {note}
        </p>
      )}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  step = 0.01,
  min = 0,
  readOnly = false,
  suffix,
}: {
  value: number;
  onChange?: (v: number) => void;
  step?: number;
  min?: number;
  readOnly?: boolean;
  suffix?: string;
}) {
  const [raw, setRaw] = useState(() => (value === 0 ? "" : String(value)));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setRaw(value === 0 ? "" : String(value));
    }
  }, [value]);

  const commit = (str: string) => {
    const n = parseFloat(str);
    const safe = isNaN(n) ? 0 : Math.max(min, n);
    setRaw(safe === 0 ? "" : String(safe));
    onChange?.(safe);
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={raw}
        placeholder="0"
        readOnly={readOnly}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onChange={(e) => {
          const s = e.target.value;
          if (/^-?\d*\.?\d*$/.test(s) || s === "") {
            setRaw(s);
            const n = parseFloat(s);
            if (!isNaN(n)) onChange?.(Math.max(min, n));
          }
        }}
        onBlur={() => {
          focused.current = false;
          commit(raw);
        }}
        onKeyDown={(e) => {
          if (readOnly) return;
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const dir = e.key === "ArrowUp" ? 1 : -1;
            const current = parseFloat(raw) || 0;
            const precision = Math.max(0, Math.ceil(-Math.log10(step)));
            const next = Math.max(min, parseFloat((current + dir * step).toFixed(precision)));
            setRaw(String(next));
            onChange?.(next);
          }
        }}
        className="mc-input w-full text-[0.8125rem]"
        style={
          readOnly
            ? { background: "var(--mc-dark-warm)", color: "var(--mc-text-muted)", cursor: "default" }
            : undefined
        }
      />
      {suffix && (
        <span
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]"
          style={{ color: "var(--mc-text-muted)" }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="px-3 py-1 text-[10px] font-medium tracking-[0.05em] uppercase transition-colors"
            style={{
              background: active ? "var(--mc-cream)" : "var(--mc-surface-elevated)",
              color: active ? "var(--mc-dark)" : "var(--mc-text-muted)",
              border: "1px solid var(--mc-border)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PricingInputPanel({
  inputs,
  onChange,
  products,
  settings,
  selectedProduct,
}: Props) {
  const set = <K extends keyof PricingInputs>(key: K, value: PricingInputs[K]) =>
    onChange({ ...inputs, [key]: value });

  const handleProductChange = (id: string) => {
    const prod = products.find((p) => p.id === id);
    onChange({
      ...inputs,
      productId: id,
      hsCode: prod?.hs_code ?? inputs.hsCode,
    });
  };

  const handleCurrencyChange = (c: "EUR" | "USD" | "MXN") => {
    onChange({ ...inputs, supplierCurrency: c });
  };

  const addTier = () => {
    const last = inputs.volumeTiers[inputs.volumeTiers.length - 1];
    const from = last ? (last.to_cases ?? 0) + 1 : 1;
    const tier: VolumeTier = {
      from_cases: from,
      to_cases: null,
      supplier_price: inputs.supplierPricePerCase,
    };
    set("volumeTiers", [...inputs.volumeTiers, tier]);
  };

  const updateTier = (i: number, patch: Partial<VolumeTier>) => {
    const updated = inputs.volumeTiers.map((t, idx) =>
      idx === i ? { ...t, ...patch } : t
    );
    set("volumeTiers", updated);
  };

  const removeTier = (i: number) => {
    set("volumeTiers", inputs.volumeTiers.filter((_, idx) => idx !== i));
  };

  const productOptions = products.map((p) => ({
    value: p.id,
    label: p.brand ? `${p.brand} — ${p.name}` : p.name,
  }));

  const MarginSlider = ({ label }: { label: string }) => (
    <Field label={label}>
      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={80}
          step={1}
          value={inputs.targetMarginPct}
          onChange={(e) => set("targetMarginPct", parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {[25, 35, 45, 50].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set("targetMarginPct", p)}
                className="px-2 py-0.5 text-[10px] transition-colors"
                style={{
                  background: inputs.targetMarginPct === p ? "var(--mc-cream)" : "var(--mc-surface-elevated)",
                  color: inputs.targetMarginPct === p ? "var(--mc-dark)" : "var(--mc-text-muted)",
                  border: "1px solid var(--mc-border)",
                }}
              >
                {p}%
              </button>
            ))}
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--mc-cream)" }}>
            {inputs.targetMarginPct}%
          </span>
        </div>
      </div>
    </Field>
  );

  return (
    <div style={{ border: "1px solid var(--mc-border)", background: "var(--mc-surface)" }}>
      {/* Product */}
      <Section title="Product">
        <Field label="Product">
          <SearchableSelect
            options={productOptions}
            value={inputs.productId}
            onChange={handleProductChange}
            placeholder="Search products..."
            emptyLabel="Select a product"
          />
        </Field>
        {selectedProduct && (
          <div
            className="px-3 py-2 text-[10px] space-y-0.5"
            style={{
              background: "var(--mc-surface-elevated)",
              border: "1px solid var(--mc-border)",
              color: "var(--mc-text-muted)",
            }}
          >
            <div>ABV: <span style={{ color: "var(--mc-text-secondary)" }}>{selectedProduct.abv ?? "—"}%</span></div>
            <div>Size: <span style={{ color: "var(--mc-text-secondary)" }}>{selectedProduct.size_ml ?? "—"} ml</span></div>
            <div>Bottles/case: <span style={{ color: "var(--mc-text-secondary)" }}>{selectedProduct.bottles_per_case ?? selectedProduct.case_size ?? "—"}</span></div>
          </div>
        )}
      </Section>

      {/* Price-Down: target customer price comes right after product */}
      {inputs.mode === "price_down" && (
        <Section title="Target Customer Price">
          <Field label="Target Customer Price / Case (EUR)" note="What the customer is willing to pay per case, net of VAT.">
            <NumInput
              value={inputs.targetPricePerCase}
              onChange={(v) => set("targetPricePerCase", v)}
              suffix="EUR"
            />
          </Field>
          <Field label="Client Tier (context only)">
            <Chips
              options={[
                { label: "A", value: "A" },
                { label: "B", value: "B" },
                { label: "C", value: "C" },
              ]}
              value={inputs.clientTier as "A" | "B" | "C"}
              onChange={(v) => set("clientTier", v)}
            />
          </Field>
          <MarginSlider label="Minimum Margin % to protect" />
        </Section>
      )}

      {/* Supplier price */}
      <Section title="Supplier Price & Currency">
        <Field label="Currency">
          <Chips
            options={[
              { label: "EUR", value: "EUR" },
              { label: "USD", value: "USD" },
              { label: "MXN", value: "MXN" },
            ]}
            value={inputs.supplierCurrency}
            onChange={handleCurrencyChange}
          />
        </Field>
        {(inputs.supplierCurrency === "USD" || inputs.localTransportCurrency === "USD" || inputs.internationalFreightCurrency === "USD") && (
          <Field label="1 USD = ? EUR" note="Used for all USD payments in this scenario.">
            <NumInput value={inputs.fxUsdEur} onChange={(v) => set("fxUsdEur", v)} step={0.001} />
          </Field>
        )}
        {(inputs.supplierCurrency === "MXN" || inputs.localTransportCurrency === "MXN" || inputs.internationalFreightCurrency === "MXN") && (
          <Field label="1 MXN = ? EUR" note="Used for all MXN payments in this scenario.">
            <NumInput value={inputs.fxMxnEur} onChange={(v) => set("fxMxnEur", v)} step={0.0001} />
          </Field>
        )}
        {inputs.supplierCurrency !== "EUR" && (
          <Field label="FX Buffer % (supplier)" note="Hedge against rate movement between order and payment.">
            <NumInput value={inputs.fxBufferPct} onChange={(v) => set("fxBufferPct", v)} suffix="%" />
          </Field>
        )}
        {inputs.mode === "cost_up" && (
          <Field label={`Supplier Price / Case (${inputs.supplierCurrency})`}>
            <NumInput
              value={inputs.supplierPricePerCase}
              onChange={(v) => set("supplierPricePerCase", v)}
              suffix={inputs.supplierCurrency}
            />
          </Field>
        )}
        <Field label="Cases in This Order" note="Used to spread fixed costs (customs fee, etc.) per case.">
          <NumInput
            value={inputs.orderCases}
            onChange={(v) => set("orderCases", Math.max(1, Math.round(v)))}
            step={1}
            suffix="cases"
          />
        </Field>
        <Field label="MOQ (min. order cases)" note="Warning shown if scenario qty is below this.">
          <NumInput
            value={inputs.moqCases ?? 0}
            onChange={(v) => set("moqCases", v || null)}
            step={1}
          />
        </Field>
      </Section>

      {/* Freight */}
      <Section title="International Freight" defaultOpen={false}>
        <Field label="Freight Mode">
          <Chips
            options={[
              { label: "Sea", value: "sea" },
              { label: "Air", value: "air" },
              { label: "Land", value: "land" },
            ]}
            value={inputs.freightMode}
            onChange={(v) => set("freightMode", v)}
          />
        </Field>
        {inputs.freightMode !== "land" && (
          <Field
            label={inputs.freightMode === "air" ? "Transport to Airport" : "Transport to Port"}
            note="Supplier to departure point in Mexico — total for the shipment."
          >
            <Chips
              options={[{ label: "EUR", value: "EUR" }, { label: "USD", value: "USD" }, { label: "MXN", value: "MXN" }]}
              value={inputs.localTransportCurrency}
              onChange={(v) => set("localTransportCurrency", v)}
            />
            <div className="mt-1.5">
              <NumInput
                value={inputs.localTransportEur}
                onChange={(v) => set("localTransportEur", v)}
                suffix={inputs.localTransportCurrency}
              />
            </div>
          </Field>
        )}
        <Field
          label={
            inputs.freightMode === "sea" ? "Sea Freight" :
            inputs.freightMode === "air" ? "Air Freight" :
            "Land Freight — Door to Door"
          }
          note="Total freight cost for the shipment — divided by cases automatically. Include any terminal handling charges (THC) in this amount."
        >
          <Chips
            options={[{ label: "EUR", value: "EUR" }, { label: "USD", value: "USD" }, { label: "MXN", value: "MXN" }]}
            value={inputs.internationalFreightCurrency}
            onChange={(v) => set("internationalFreightCurrency", v)}
          />
          <div className="mt-1.5">
            <NumInput
              value={inputs.internationalFreightEur}
              onChange={(v) => set("internationalFreightEur", v)}
              suffix={inputs.internationalFreightCurrency}
            />
          </div>
        </Field>
        <Field label="Insurance % of CIF" note="Applied on supplier price + freight.">
          <NumInput value={inputs.insurancePct} onChange={(v) => set("insurancePct", v)} suffix="%" />
        </Field>
        {(() => {
          const getR = (c: "EUR" | "USD" | "MXN") =>
            c === "USD" ? inputs.fxUsdEur : c === "MXN" ? inputs.fxMxnEur : 1;
          const supplierEur = inputs.supplierPricePerCase * getR(inputs.supplierCurrency) *
            (inputs.supplierCurrency !== "EUR" ? (1 + inputs.fxBufferPct / 100) : 1);
          const safeCases = Math.max(1, inputs.orderCases);
          const localPerCase = inputs.freightMode !== "land"
            ? (inputs.localTransportEur * getR(inputs.localTransportCurrency)) / safeCases : 0;
          const freightPerCase = (inputs.internationalFreightEur * getR(inputs.internationalFreightCurrency)) / safeCases + localPerCase;
          const insuranceBase = supplierEur + freightPerCase;
          const insuranceCost = insuranceBase * (inputs.insurancePct / 100);
          const fmt2 = (v: number) => `€${(v ?? 0).toFixed(2)}`;
          return (
            <div
              className="p-3 text-[10px] space-y-1.5"
              style={{ background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)" }}
            >
              <div className="font-semibold tracking-[0.06em] uppercase mb-2" style={{ color: "var(--mc-text-secondary)" }}>
                Insurance (Auto-calculated)
              </div>
              <div className="flex justify-between" style={{ color: "var(--mc-text-muted)" }}>
                <span>Supplier price</span>
                <span>{fmt2(supplierEur)}/case</span>
              </div>
              <div className="flex justify-between" style={{ color: "var(--mc-text-muted)" }}>
                <span>+ International freight</span>
                <span>{fmt2(freightPerCase)}/case</span>
              </div>
              <div
                className="flex justify-between pt-1.5 mt-1"
                style={{ borderTop: "1px solid var(--mc-border)", color: "var(--mc-text-secondary)" }}
              >
                <span className="font-medium">Insurance base (CIF)</span>
                <span>{fmt2(insuranceBase)}/case</span>
              </div>
              <div className="flex justify-between" style={{ color: "var(--mc-cream)" }}>
                <span>× {inputs.insurancePct}% insurance rate</span>
                <span className="font-semibold">{fmt2(insuranceCost)}/case</span>
              </div>
            </div>
          );
        })()}
        <Field label="Breakage / Loss %" note="Lost bottles financed by surviving ones (default 1%).">
          <NumInput value={inputs.breakagePct} onChange={(v) => set("breakagePct", v)} suffix="%" />
        </Field>
      </Section>

      {/* German import costs */}
      <Section title="German Import Costs" defaultOpen={false}>
        <Field
          label="EU Import Duty %"
          note="Verify with customs agent. May be 0% under EU-Mexico EUGTA with certificate of origin."
        >
          <NumInput value={inputs.customsDutyPct} onChange={(v) => set("customsDutyPct", v)} suffix="%" />
        </Field>
        {/* EU Customs Duty breakdown — read-only info box */}
        {(() => {
          const getR = (c: "EUR" | "USD" | "MXN") =>
            c === "USD" ? inputs.fxUsdEur : c === "MXN" ? inputs.fxMxnEur : 1;
          const supplierEur = inputs.supplierPricePerCase * getR(inputs.supplierCurrency) *
            (inputs.supplierCurrency !== "EUR" ? (1 + inputs.fxBufferPct / 100) : 1);
          const safeCases = Math.max(1, inputs.orderCases);
          const localPerCase = inputs.freightMode !== "land"
            ? (inputs.localTransportEur * getR(inputs.localTransportCurrency)) / safeCases : 0;
          const freightPerCase = (inputs.internationalFreightEur * getR(inputs.internationalFreightCurrency)) / safeCases + localPerCase;
          const insuranceCost = (supplierEur + freightPerCase) * (inputs.insurancePct / 100);
          const freightAndIns = freightPerCase + insuranceCost;
          const cifBase = supplierEur + freightAndIns;
          const duty = cifBase * (inputs.customsDutyPct / 100);
          const fmt2 = (v: number) => `€${v.toFixed(2)}`;
          return (
            <div
              className="p-3 text-[10px] space-y-1.5"
              style={{ background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)" }}
            >
              <div className="font-semibold tracking-[0.06em] uppercase mb-2" style={{ color: "var(--mc-text-secondary)" }}>
                EU Import Duty (Auto-calculated)
              </div>
              <div className="flex justify-between" style={{ color: "var(--mc-text-muted)" }}>
                <span>Supplier price</span>
                <span>{fmt2(supplierEur)}/case</span>
              </div>
              <div className="flex justify-between" style={{ color: "var(--mc-text-muted)" }}>
                <span>International freight</span>
                <span>{fmt2(freightPerCase)}/case</span>
              </div>
              <div className="flex justify-between" style={{ color: "var(--mc-text-muted)" }}>
                <span>Insurance</span>
                <span>{fmt2(insuranceCost)}/case</span>
              </div>
              <div
                className="flex justify-between pt-1.5 mt-1"
                style={{ borderTop: "1px solid var(--mc-border)", color: "var(--mc-text-secondary)" }}
              >
                <span className="font-medium">CIF base (customs value)</span>
                <span>{fmt2(cifBase)}/case</span>
              </div>
              <div className="flex justify-between" style={{ color: "var(--mc-cream)" }}>
                <span>× {inputs.customsDutyPct}% duty rate</span>
                <span className="font-semibold">{fmt2(duty)}/case</span>
              </div>
              <div className="pt-1" style={{ color: "var(--mc-text-tertiary)" }}>
                Basis: Zollwert nach Art. 70 UCC (Transaktionswert CIF bis EU-Eingangsort).
              </div>
            </div>
          );
        })()}

        {/* Branntweinsteuer — read-only auto-calc */}
        <div
          className="p-3 text-[10px] space-y-1.5"
          style={{
            background: "var(--mc-surface-elevated)",
            border: "1px solid var(--mc-border)",
          }}
        >
          <div
            className="font-semibold tracking-[0.06em] uppercase mb-2"
            style={{ color: "var(--mc-text-secondary)" }}
          >
            Branntweinsteuer (Auto-calculated)
          </div>
          {selectedProduct ? (
            <>
              <div style={{ color: "var(--mc-text-muted)" }}>
                {selectedProduct.abv}% ABV × {selectedProduct.size_ml}ml × {selectedProduct.bottles_per_case ?? selectedProduct.case_size} btl/case
              </div>
              <div style={{ color: "var(--mc-text-muted)" }}>
                = {(((selectedProduct.abv ?? 0) / 100) * ((selectedProduct.size_ml ?? 700) / 1000) * (selectedProduct.bottles_per_case ?? selectedProduct.case_size ?? 6)).toFixed(3)} L pure alcohol / case
              </div>
              <div style={{ color: "var(--mc-cream)" }}>
                × €{inputs.exciseRatePerHl}/hL = <strong>€{(((selectedProduct.abv ?? 0) / 100) * ((selectedProduct.size_ml ?? 700) / 1000) * (selectedProduct.bottles_per_case ?? selectedProduct.case_size ?? 6) * inputs.exciseRatePerHl / 100).toFixed(2)}/case</strong>
              </div>
              <div style={{ color: "var(--mc-text-tertiary)" }}>
                Not reclaimable. Rate: Alkoholsteuergesetz §130.
              </div>
            </>
          ) : (
            <div style={{ color: "var(--mc-text-tertiary)" }}>Select a product above to see excise calculation.</div>
          )}
        </div>

        <Field label="Excise Rate / hL pure alcohol (EUR)" note="System default: €1,303. Update in settings if law changes.">
          <NumInput value={inputs.exciseRatePerHl} onChange={(v) => set("exciseRatePerHl", v)} step={1} suffix="EUR/hL" />
        </Field>
        <Field
          label="Import VAT Rate %"
          note="Einfuhrumsatzsteuer — reclaimable for B2B. Only the working capital cost is included in landed cost."
        >
          <NumInput value={inputs.importVatRate} onChange={(v) => set("importVatRate", v)} suffix="%" />
        </Field>
        {/* EUSt breakdown — read-only info box */}
        {(() => {
          const getR = (c: "EUR" | "USD" | "MXN") =>
            c === "USD" ? inputs.fxUsdEur : c === "MXN" ? inputs.fxMxnEur : 1;
          const supplierEur = inputs.supplierPricePerCase * getR(inputs.supplierCurrency) *
            (inputs.supplierCurrency !== "EUR" ? (1 + inputs.fxBufferPct / 100) : 1);
          const safeCases = Math.max(1, inputs.orderCases);
          const localPerCase = inputs.freightMode !== "land"
            ? (inputs.localTransportEur * getR(inputs.localTransportCurrency)) / safeCases : 0;
          const freightPerCase = (inputs.internationalFreightEur * getR(inputs.internationalFreightCurrency)) / safeCases + localPerCase;
          const insuranceCost = (supplierEur + freightPerCase) * (inputs.insurancePct / 100);
          const cifValue = supplierEur + freightPerCase + insuranceCost;
          const customsDuty = cifValue * (inputs.customsDutyPct / 100);
          const abv = selectedProduct?.abv ?? 0;
          const sizeMl = selectedProduct?.size_ml ?? 700;
          const btl = selectedProduct?.bottles_per_case ?? selectedProduct?.case_size ?? 6;
          const excise = (abv / 100) * (sizeMl / 1000) * btl * (inputs.exciseRatePerHl / 100);
          const domPerCase = (inputs.domLogisticsTotal ?? 0) / safeCases;
          const eustBase = cifValue + customsDuty + excise + domPerCase;
          const eust = eustBase * (inputs.importVatRate / 100);
          const fmt2 = (v: number) => `€${(v ?? 0).toFixed(2)}`;
          return (
            <div
              className="p-3 text-[10px] space-y-1.5"
              style={{ background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)" }}
            >
              <div className="font-semibold tracking-[0.06em] uppercase mb-2" style={{ color: "var(--mc-text-secondary)" }}>
                Import VAT / EUSt (Auto-calculated)
              </div>
              <div className="flex justify-between" style={{ color: "var(--mc-text-muted)" }}>
                <span>CIF value (supplier + freight + insurance)</span>
                <span>{fmt2(cifValue)}/case</span>
              </div>
              <div className="flex justify-between" style={{ color: "var(--mc-text-muted)" }}>
                <span>+ Customs duty</span>
                <span>{fmt2(customsDuty)}/case</span>
              </div>
              <div className="flex justify-between" style={{ color: "var(--mc-text-muted)" }}>
                <span>+ Branntweinsteuer</span>
                <span>{fmt2(excise)}/case</span>
              </div>
              <div className="flex justify-between" style={{ color: "var(--mc-text-muted)" }}>
                <span>+ Transport to warehouse</span>
                <span>{fmt2(domPerCase)}/case</span>
              </div>
              <div
                className="flex justify-between pt-1.5 mt-1"
                style={{ borderTop: "1px solid var(--mc-border)", color: "var(--mc-text-secondary)" }}
              >
                <span className="font-medium">EUSt base</span>
                <span>{fmt2(eustBase)}/case</span>
              </div>
              <div className="flex justify-between" style={{ color: "var(--mc-cream)" }}>
                <span>× {inputs.importVatRate}% EUSt</span>
                <span className="font-semibold">{fmt2(eust)}/case</span>
              </div>
              <div className="pt-1" style={{ color: "var(--mc-text-tertiary)" }}>
                Reclaimable as Vorsteuer (§ 15 UStG). Only working capital cost included in landed cost.
              </div>
            </div>
          );
        })()}
      </Section>

      {/* Domestic */}
      <Section title="Domestic Costs" defaultOpen={false}>
        <Field label="Transport to Warehouse — Total for Shipment (EUR)" note="Port / airport to your warehouse. Divided by cases automatically.">
          <NumInput value={inputs.domLogisticsTotal} onChange={(v) => set("domLogisticsTotal", v)} suffix="EUR" />
          {inputs.domLogisticsTotal > 0 && inputs.orderCases > 0 && (
            <p className="mt-1 text-[10px]" style={{ color: "var(--mc-text-tertiary)" }}>
              = €{(inputs.domLogisticsTotal / Math.max(1, inputs.orderCases)).toFixed(2)}/case
            </p>
          )}
        </Field>
        <Field label="Warehousing / Case / Month (EUR)">
          <NumInput value={inputs.warehousingPerCaseMo} onChange={(v) => set("warehousingPerCaseMo", v)} suffix="EUR" />
          {inputs.warehousingPerCaseMo > 0 && (
            <p className="mt-1 text-[10px]" style={{ color: "var(--mc-text-tertiary)" }}>
              {inputs.holdingMonths} mo × €{inputs.warehousingPerCaseMo}/case = €{(inputs.warehousingPerCaseMo * inputs.holdingMonths).toFixed(2)}/case total
            </p>
          )}
        </Field>
        <Field label="Estimated Holding Time (months)">
          <NumInput value={inputs.holdingMonths} onChange={(v) => set("holdingMonths", v)} step={0.5} suffix="mo" />
        </Field>
        <Field label="Distributor Handling Fee">
          <Chips
            options={[
              { label: "Per Case", value: "per_case" },
              { label: "Per Bottle", value: "per_bottle" },
              { label: "Total", value: "total" },
            ]}
            value={inputs.distributorFeeMode}
            onChange={(v) => set("distributorFeeMode", v)}
          />
          <div className="mt-1.5">
            <NumInput
              value={inputs.distributorFeeAmount}
              onChange={(v) => set("distributorFeeAmount", v)}
              suffix="EUR"
            />
          </div>
          {inputs.distributorFeeAmount > 0 && inputs.distributorFeeMode !== "per_case" && (
            <p className="mt-1 text-[10px]" style={{ color: "var(--mc-text-tertiary)" }}>
              = €{(
                inputs.distributorFeeMode === "per_bottle"
                  ? inputs.distributorFeeAmount * (inputs.productId
                      ? (products.find(p => p.id === inputs.productId)?.bottles_per_case ?? products.find(p => p.id === inputs.productId)?.case_size ?? 6)
                      : 6)
                  : inputs.distributorFeeAmount / Math.max(1, inputs.orderCases)
              ).toFixed(2)}/case
            </p>
          )}
        </Field>
      </Section>

      {/* Compliance & Other */}
      <Section title="Compliance & Other" defaultOpen={false}>
        <Field label="EU Labeling / Compliance / Bottle (EUR)" note="Country-specific label (self-applied). Print cost typically €0.05–0.15/bottle. Multiplied by bottles/case automatically.">
          <NumInput value={inputs.labelingPerBottle} onChange={(v) => set("labelingPerBottle", v)} step={0.01} suffix="EUR" />
          {inputs.labelingPerBottle > 0 && (
            <p className="mt-1 text-[10px]" style={{ color: "var(--mc-text-tertiary)" }}>
              = €{(inputs.labelingPerBottle * (selectedProduct
                ? (selectedProduct.bottles_per_case ?? selectedProduct.case_size ?? 6)
                : 6)).toFixed(2)}/case
            </p>
          )}
        </Field>
        <Field
          label="Sample / Tasting Allocation %"
          note="% of shipment given as samples. Cost spread across sold cases."
        >
          <NumInput value={inputs.sampleRatePct} onChange={(v) => set("sampleRatePct", v)} suffix="%" />
        </Field>
        <Field label="Overhead Allocation % of total cost">
          <NumInput value={inputs.overheadPct} onChange={(v) => set("overheadPct", v)} suffix="%" />
        </Field>
      </Section>

      {/* Volume tiers */}
      <Section title="Volume Tiers" defaultOpen={false}>
        <p className="text-[10px]" style={{ color: "var(--mc-text-muted)" }}>
          Different supplier prices at different quantities. Results show how margin changes per tier.
        </p>
        {inputs.volumeTiers.map((tier, i) => (
          <div
            key={i}
            className="p-3 space-y-2"
            style={{ border: "1px solid var(--mc-border)", background: "var(--mc-surface-elevated)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold" style={{ color: "var(--mc-text-secondary)" }}>
                Tier {i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeTier(i)}
                className="p-1 transition-colors"
                style={{ color: "var(--mc-text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-error)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="From cases">
                <NumInput
                  value={tier.from_cases}
                  onChange={(v) => updateTier(i, { from_cases: Math.round(v) })}
                  step={1}
                />
              </Field>
              <Field label="To cases">
                <NumInput
                  value={tier.to_cases ?? 0}
                  onChange={(v) => updateTier(i, { to_cases: v > 0 ? Math.round(v) : null })}
                  step={1}
                />
              </Field>
              <Field label={`Price (${inputs.supplierCurrency})`}>
                <NumInput
                  value={tier.supplier_price}
                  onChange={(v) => updateTier(i, { supplier_price: v })}
                />
              </Field>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addTier}
          className="flex items-center gap-1.5 px-3 py-2 text-xs transition-colors"
          style={{
            border: "1px dashed var(--mc-border)",
            color: "var(--mc-text-muted)",
            width: "100%",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
        >
          <Plus className="w-3 h-3" />
          Add Tier
        </button>
      </Section>

      {/* Target — cost_up only; price_down target is shown at the top */}
      {inputs.mode === "cost_up" && (
        <Section title="Target Margin">
          <MarginSlider label="Desired Margin %" />
        </Section>
      )}
    </div>
  );
}
