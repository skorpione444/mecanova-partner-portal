-- Append-only price log per product (supplier contract prices).
-- Each entry is recorded as either per-bottle or per-case; the opposite value
-- is derived in the UI from bottles_per_case (snapshotted here so historical
-- conversions stay correct even if the product's case size later changes).
CREATE TABLE public.product_prices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  amount           NUMERIC(12, 4) NOT NULL CHECK (amount >= 0),
  unit             TEXT NOT NULL CHECK (unit IN ('bottle', 'case')),
  currency         TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD', 'MXN')),
  bottles_per_case INTEGER NOT NULL CHECK (bottles_per_case > 0),
  notes            TEXT,
  created_by       UUID NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage product prices"
  ON public.product_prices FOR ALL
  TO authenticated
  USING (public.mecanova_is_admin())
  WITH CHECK (public.mecanova_is_admin());

CREATE INDEX idx_product_prices_product ON public.product_prices(product_id);
CREATE INDEX idx_product_prices_created_at ON public.product_prices(created_at DESC);
