-- Prospects table
-- Venues discovered via map/Places search that haven't yet become partners

CREATE TABLE prospects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  address text,
  city text,
  lat double precision,
  lng double precision,
  venue_type venue_type_enum,
  crm_status crm_status_enum DEFAULT 'uncontacted' NOT NULL,
  google_place_id text UNIQUE,
  contact_person text,
  contact_email text,
  contact_phone text,
  notes text,
  converted_to_partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_prospects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_prospects_updated_at();

-- RLS: admin-only
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on prospects"
  ON prospects
  FOR ALL
  TO authenticated
  USING (mecanova_is_admin())
  WITH CHECK (mecanova_is_admin());
