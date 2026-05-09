-- Add address, notes, website to partners; website to prospects

ALTER TABLE partners
  ADD COLUMN address text,
  ADD COLUMN notes text,
  ADD COLUMN website text;

ALTER TABLE prospects
  ADD COLUMN website text;
