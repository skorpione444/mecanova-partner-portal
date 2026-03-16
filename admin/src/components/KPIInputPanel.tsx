"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, ChevronUp, Save } from "lucide-react";
import type { Json } from "@mecanova/shared";

interface LatestValues {
  bank_balance: number;
  monthly_burn: number;
  target_launch_date: string;
  pipeline_distributor: { contacted: number; in_conversation: number; committed: number };
  pipeline_client: { contacted: number; in_conversation: number; committed: number };
  landed_cost_product_id: string;
  landed_cost: {
    purchase: number;
    export: number;
    shipping: number;
    customs: number;
    duties: number;
    labeling: number;
  };
}

interface Product {
  id: string;
  name: string;
}

interface KPIInputPanelProps {
  readonly products: Product[];
  readonly onSaved: () => void;
}

const DEFAULT_VALUES: LatestValues = {
  bank_balance: 0,
  monthly_burn: 0,
  target_launch_date: "",
  pipeline_distributor: { contacted: 0, in_conversation: 0, committed: 0 },
  pipeline_client: { contacted: 0, in_conversation: 0, committed: 0 },
  landed_cost_product_id: "",
  landed_cost: { purchase: 0, export: 0, shipping: 0, customs: 0, duties: 0, labeling: 0 },
};

export default function KPIInputPanel({ products, onSaved }: KPIInputPanelProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<LatestValues>(DEFAULT_VALUES);
  const supabase = createClient();

  useEffect(() => {
    if (!open) return;
    const loadLatest = async () => {
      const types = ["bank_balance", "monthly_burn", "target_launch_date", "pipeline_distributor", "pipeline_client"];
      const { data } = await supabase
        .from("kpi_manual_entries")
        .select("*")
        .in("kpi_type", types)
        .order("recorded_at", { ascending: false })
        .limit(50);

      if (!data || data.length === 0) return;

      const latest: Record<string, (typeof data)[0]> = {};
      for (const row of data) {
        if (!latest[row.kpi_type]) latest[row.kpi_type] = row;
      }

      const targetJson = latest.target_launch_date?.value_json as Record<string, unknown> | null;
      setValues((prev) => ({
        ...prev,
        bank_balance: Number(latest.bank_balance?.value_numeric ?? prev.bank_balance),
        monthly_burn: Number(latest.monthly_burn?.value_numeric ?? prev.monthly_burn),
        target_launch_date: (targetJson?.date as string) ?? prev.target_launch_date,
        pipeline_distributor: (latest.pipeline_distributor?.value_json as LatestValues["pipeline_distributor"] | null) ?? prev.pipeline_distributor,
        pipeline_client: (latest.pipeline_client?.value_json as LatestValues["pipeline_client"] | null) ?? prev.pipeline_client,
      }));
    };
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const entries: {
      kpi_type: string;
      value_numeric?: number | null;
      value_json?: Json | null;
      product_id?: string | null;
      recorded_by: string;
    }[] = [
      { kpi_type: "bank_balance", value_numeric: values.bank_balance, value_json: null, product_id: null, recorded_by: user.id },
      { kpi_type: "monthly_burn", value_numeric: values.monthly_burn, value_json: null, product_id: null, recorded_by: user.id },
      { kpi_type: "pipeline_distributor", value_numeric: null, value_json: values.pipeline_distributor, product_id: null, recorded_by: user.id },
      { kpi_type: "pipeline_client", value_numeric: null, value_json: values.pipeline_client, product_id: null, recorded_by: user.id },
    ];

    if (values.target_launch_date) {
      entries.push({
        kpi_type: "target_launch_date",
        value_numeric: null,
        value_json: { date: values.target_launch_date },
        product_id: null,
        recorded_by: user.id,
      });
    }

    if (values.landed_cost_product_id) {
      const total = Object.values(values.landed_cost).reduce((s, v) => s + v, 0);
      entries.push({
        kpi_type: "landed_cost",
        value_numeric: total,
        value_json: values.landed_cost,
        product_id: values.landed_cost_product_id,
        recorded_by: user.id,
      });
    }

    await supabase.from("kpi_manual_entries").insert(entries);
    setSaving(false);
    onSaved();
  };

  const numInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    prefix?: string,
  ) => (
    <div key={label}>
      <label className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-1 block" style={{ color: "var(--mc-text-muted)" }}>
        {label}
      </label>
      <div className="flex items-center">
        {prefix && (
          <span className="text-xs mr-1.5" style={{ color: "var(--mc-text-muted)" }}>{prefix}</span>
        )}
        <input
          type="number"
          className="mc-input w-full"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
      </div>
    </div>
  );

  return (
    <div className="mc-card mb-6 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 transition-colors"
        style={{ color: "var(--mc-text-primary)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mc-surface-warm)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span className="text-xs font-semibold tracking-[0.08em] uppercase">
          Update Metrics
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--mc-border-light)" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            {/* Cash Section */}
            <div>
              <h4 className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-3" style={{ color: "var(--mc-cream-subtle)" }}>
                Cash
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {numInput("Bank Balance", values.bank_balance, (v) => setValues({ ...values, bank_balance: v }), "EUR")}
                {numInput("Monthly Burn Rate", values.monthly_burn, (v) => setValues({ ...values, monthly_burn: v }), "EUR")}
              </div>
            </div>

            {/* Timeline Section */}
            <div>
              <h4 className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-3" style={{ color: "var(--mc-cream-subtle)" }}>
                Timeline
              </h4>
              <div>
                <label className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-1 block" style={{ color: "var(--mc-text-muted)" }}>
                  Target Launch Date
                </label>
                <input
                  type="date"
                  className="mc-input w-full"
                  value={values.target_launch_date}
                  onChange={(e) => setValues({ ...values, target_launch_date: e.target.value })}
                />
              </div>
            </div>

            {/* Distributor Pipeline */}
            <div>
              <h4 className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-3" style={{ color: "var(--mc-cream-subtle)" }}>
                Distributor Pipeline
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {numInput("Contacted", values.pipeline_distributor.contacted, (v) =>
                  setValues({ ...values, pipeline_distributor: { ...values.pipeline_distributor, contacted: v } })
                )}
                {numInput("In Conversation", values.pipeline_distributor.in_conversation, (v) =>
                  setValues({ ...values, pipeline_distributor: { ...values.pipeline_distributor, in_conversation: v } })
                )}
                {numInput("Committed", values.pipeline_distributor.committed, (v) =>
                  setValues({ ...values, pipeline_distributor: { ...values.pipeline_distributor, committed: v } })
                )}
              </div>
            </div>

            {/* Client Pipeline */}
            <div>
              <h4 className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-3" style={{ color: "var(--mc-cream-subtle)" }}>
                Client Pipeline Frankfurt
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {numInput("Contacted", values.pipeline_client.contacted, (v) =>
                  setValues({ ...values, pipeline_client: { ...values.pipeline_client, contacted: v } })
                )}
                {numInput("In Conversation", values.pipeline_client.in_conversation, (v) =>
                  setValues({ ...values, pipeline_client: { ...values.pipeline_client, in_conversation: v } })
                )}
                {numInput("Committed", values.pipeline_client.committed, (v) =>
                  setValues({ ...values, pipeline_client: { ...values.pipeline_client, committed: v } })
                )}
              </div>
            </div>

            {/* Landed Cost */}
            <div className="lg:col-span-2">
              <h4 className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-3" style={{ color: "var(--mc-cream-subtle)" }}>
                Landed Cost per Bottle
              </h4>
              <div className="mb-3">
                <label className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-1 block" style={{ color: "var(--mc-text-muted)" }}>
                  Product
                </label>
                <select
                  className="mc-select w-full lg:w-1/2"
                  value={values.landed_cost_product_id}
                  onChange={(e) => setValues({ ...values, landed_cost_product_id: e.target.value })}
                >
                  <option value="">Select a product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {(["purchase", "export", "shipping", "customs", "duties", "labeling"] as const).map((key) =>
                  numInput(
                    key.charAt(0).toUpperCase() + key.slice(1),
                    values.landed_cost[key],
                    (v) => setValues({ ...values, landed_cost: { ...values.landed_cost, [key]: v } }),
                    "EUR",
                  )
                )}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end mt-5 pt-4" style={{ borderTop: "1px solid var(--mc-border-light)" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="mc-btn-primary flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
              {saving ? "Saving..." : "Save Snapshot"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
