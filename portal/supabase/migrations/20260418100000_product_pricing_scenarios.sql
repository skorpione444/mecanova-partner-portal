-- Named pricing scenarios for both cost-up and price-down calculator modes
CREATE TABLE public.product_pricing_scenarios (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  product_id               UUID REFERENCES public.products(id) ON DELETE SET NULL,
  created_by               UUID NOT NULL REFERENCES auth.users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Calculator mode
  mode                     TEXT NOT NULL DEFAULT 'cost_up' CHECK (mode IN ('cost_up', 'price_down')),

  -- Supplier price & currency
  supplier_currency        TEXT NOT NULL DEFAULT 'EUR' CHECK (supplier_currency IN ('EUR', 'USD', 'MXN')),
  fx_rate_to_eur           NUMERIC(12, 6),
  fx_buffer_pct            NUMERIC(5, 2) DEFAULT 3.0,
  supplier_price_per_case  NUMERIC(10, 2),
  payment_terms_days       INTEGER DEFAULT 30,
  collection_terms_days    INTEGER DEFAULT 60,
  cost_of_capital_pct      NUMERIC(5, 2) DEFAULT 8.0,
  moq_cases                INTEGER,

  -- Freight
  freight_per_case         NUMERIC(10, 2) DEFAULT 0,
  freight_mode             TEXT DEFAULT 'sea' CHECK (freight_mode IN ('sea', 'air', 'land')),
  insurance_pct            NUMERIC(5, 2) DEFAULT 0.5,
  breakage_pct             NUMERIC(5, 2) DEFAULT 1.0,

  -- Import duties
  hs_code                  TEXT,
  customs_duty_pct         NUMERIC(5, 2) DEFAULT 0.0,
  customs_processing_eur   NUMERIC(10, 2) DEFAULT 0,
  customs_cases_in_shipment INTEGER DEFAULT 1,

  -- Excise (stored for audit even though auto-calculated)
  excise_rate_per_hl       NUMERIC(10, 2) DEFAULT 1303.00,
  excise_per_case_eur      NUMERIC(10, 2),

  -- VAT
  import_vat_rate          NUMERIC(5, 2) DEFAULT 19.0,
  import_vat_per_case_eur  NUMERIC(10, 2),

  -- Domestic costs
  dom_logistics_per_case   NUMERIC(10, 2) DEFAULT 0,
  warehousing_per_case_mo  NUMERIC(10, 2) DEFAULT 0,
  holding_months           NUMERIC(5, 2) DEFAULT 1.0,
  distributor_fee_per_case NUMERIC(10, 2) DEFAULT 0,

  -- Compliance
  labeling_per_case        NUMERIC(10, 2) DEFAULT 0,
  sample_rate_pct          NUMERIC(5, 2) DEFAULT 3.0,
  overhead_pct             NUMERIC(5, 2) DEFAULT 0,

  -- Mode-specific targets
  target_margin_pct        NUMERIC(5, 2),
  target_price_per_case    NUMERIC(10, 2),
  client_tier              TEXT,

  -- Stored results (denormalised for display)
  result_landed_cost_case  NUMERIC(10, 2),
  result_min_price_case    NUMERIC(10, 2),
  result_max_supplier_case NUMERIC(10, 2),
  result_actual_margin_pct NUMERIC(5, 2),

  -- Volume tiers: [{from_cases,to_cases,supplier_price,result_min_price,result_margin_pct}]
  volume_tiers             JSONB DEFAULT '[]',

  -- Full snapshot for audit/export
  calculation_snapshot     JSONB,

  notes                    TEXT
);

ALTER TABLE public.product_pricing_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pricing scenarios"
  ON public.product_pricing_scenarios FOR ALL
  TO authenticated
  USING (public.mecanova_is_admin())
  WITH CHECK (public.mecanova_is_admin());

CREATE INDEX idx_pricing_scenarios_product ON public.product_pricing_scenarios(product_id);
CREATE INDEX idx_pricing_scenarios_created_by ON public.product_pricing_scenarios(created_by);
CREATE INDEX idx_pricing_scenarios_created_at ON public.product_pricing_scenarios(created_at DESC);
