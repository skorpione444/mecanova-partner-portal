-- Stock transfers: internal movement of inventory between Mecanova storage locations

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           UUID          NOT NULL REFERENCES public.products(id),
  from_dist_id         UUID          NOT NULL REFERENCES public.partners(id),
  to_dist_id           UUID          NOT NULL REFERENCES public.partners(id),
  cases_qty            INTEGER       NOT NULL CHECK (cases_qty > 0),
  transport_method     TEXT          NOT NULL DEFAULT 'other'
    CHECK (transport_method IN ('car', 'train', 'dhl', 'other')),
  transport_note       TEXT,
  logistics_cost_eur   NUMERIC(10,2),
  expected_arrival_date DATE,
  arrived_at           TIMESTAMPTZ,
  status               TEXT          NOT NULL DEFAULT 'in_transit'
    CHECK (status IN ('in_transit', 'arrived', 'cancelled')),
  notes                TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage stock transfers"
  ON public.stock_transfers FOR ALL
  TO authenticated
  USING (public.mecanova_is_admin())
  WITH CHECK (public.mecanova_is_admin());
