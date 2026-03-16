CREATE TABLE kpi_manual_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_type text NOT NULL,
  product_id uuid REFERENCES products(id),
  value_numeric numeric,
  value_json jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kpi_manual_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON kpi_manual_entries
  FOR ALL USING (mecanova_is_admin()) WITH CHECK (mecanova_is_admin());

CREATE INDEX idx_kpi_type_date ON kpi_manual_entries (kpi_type, recorded_at DESC);
