-- Shipments: group several product pricings that share fixed import costs.
-- The 3 transport legs + pallets are shipment-level; each shipment_item runs the
-- existing pricing calculator with the leg costs split per bottle across the shipment.
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  pallets INTEGER,
  freight_mode TEXT NOT NULL DEFAULT 'sea' CHECK (freight_mode IN ('sea','air','land')),
  local_transport_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  local_transport_currency TEXT NOT NULL DEFAULT 'MXN' CHECK (local_transport_currency IN ('EUR','USD','MXN')),
  intl_freight_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  intl_freight_currency TEXT NOT NULL DEFAULT 'USD' CHECK (intl_freight_currency IN ('EUR','USD','MXN')),
  dom_logistics_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_cases INTEGER NOT NULL DEFAULT 1 CHECK (quantity_cases > 0),
  supplier_price_per_case NUMERIC(12,4),
  supplier_currency TEXT NOT NULL DEFAULT 'EUR' CHECK (supplier_currency IN ('EUR','USD','MXN')),
  mode TEXT NOT NULL DEFAULT 'cost_up' CHECK (mode IN ('cost_up','price_down')),
  calculation_snapshot JSONB,
  result_landed_cost_case  NUMERIC(12,2),
  result_min_price_case    NUMERIC(12,2),
  result_max_supplier_case NUMERIC(12,2),
  result_actual_margin_pct NUMERIC(6,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage shipments"
  ON public.shipments FOR ALL TO authenticated
  USING (public.mecanova_is_admin()) WITH CHECK (public.mecanova_is_admin());

CREATE POLICY "Admins manage shipment items"
  ON public.shipment_items FOR ALL TO authenticated
  USING (public.mecanova_is_admin()) WITH CHECK (public.mecanova_is_admin());

CREATE INDEX idx_shipment_items_shipment ON public.shipment_items(shipment_id);
CREATE INDEX idx_shipments_created_at ON public.shipments(created_at DESC);

NOTIFY pgrst, 'reload schema';
