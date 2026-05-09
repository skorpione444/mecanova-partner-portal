-- Add prospect_type to prospects, defaulting existing rows to 'client' (Buyer)
ALTER TABLE prospects
  ADD COLUMN prospect_type partner_type NOT NULL DEFAULT 'client';
