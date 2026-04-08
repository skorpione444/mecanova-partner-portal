-- Add CRM fields to partners table
-- Existing partners default to 'customer' status since they're already in a relationship

ALTER TABLE partners
  ADD COLUMN lat double precision,
  ADD COLUMN lng double precision,
  ADD COLUMN venue_type venue_type_enum,
  ADD COLUMN crm_status crm_status_enum DEFAULT 'customer',
  ADD COLUMN google_place_id text;
