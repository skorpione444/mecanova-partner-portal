-- Configurable constants for the pricing calculator
CREATE TABLE public.pricing_system_settings (
  key          TEXT PRIMARY KEY,
  value_numeric NUMERIC(12, 6),
  value_text   TEXT,
  description  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES auth.users(id)
);

ALTER TABLE public.pricing_system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pricing settings"
  ON public.pricing_system_settings FOR ALL
  TO authenticated
  USING (public.mecanova_is_admin())
  WITH CHECK (public.mecanova_is_admin());

INSERT INTO public.pricing_system_settings (key, value_numeric, description) VALUES
  ('branntweinsteuer_per_hl', 1303.00, 'German spirits excise duty per hL pure alcohol (Alkoholsteuergesetz §130)'),
  ('default_fx_usd_eur',      0.92,    'Default USD to EUR exchange rate'),
  ('default_fx_mxn_eur',      0.052,   'Default MXN to EUR exchange rate'),
  ('default_import_vat_rate', 19.00,   'German import VAT rate (Einfuhrumsatzsteuer) %'),
  ('default_cost_of_capital', 8.00,    'Annual cost of capital % for working capital calculations'),
  ('fx_rate_stale_days',      7,       'Days after which FX rate shows a staleness warning');

-- HS code on products for customs classification
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hs_code TEXT;
