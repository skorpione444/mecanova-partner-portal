-- Migration: Create supply_orders table for tracking purchases from suppliers

CREATE TABLE IF NOT EXISTS public.supply_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  supplier_id UUID NOT NULL REFERENCES public.partners(id),
  distributor_id UUID REFERENCES public.partners(id),
  cases_ordered INTEGER NOT NULL CHECK (cases_ordered > 0),
  unit_cost_eur NUMERIC(10, 2),
  expected_arrival_date DATE,
  arrived_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'arrived', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage supply orders"
  ON public.supply_orders
  FOR ALL
  TO authenticated
  USING (public.mecanova_is_admin())
  WITH CHECK (public.mecanova_is_admin());
