-- Documents hub: top-level categories + legal/contract metadata
-- Adds a category column on top of the existing type enum so the admin can
-- group the library into Legal / Contracts / Sales / Operations / Marketing,
-- plus expiry/counterparty/status tracking for legal docs and contracts.

CREATE TYPE document_category_enum AS ENUM (
  'legal',
  'contracts',
  'sales',
  'operations',
  'marketing'
);

ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'legal_registration';
ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'permit';
ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'license';
ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'contract_supplier';
ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'contract_distributor';
ALTER TYPE document_type_enum ADD VALUE IF NOT EXISTS 'nda';

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS category document_category_enum,
  ADD COLUMN IF NOT EXISTS expires_at date,
  ADD COLUMN IF NOT EXISTS counterparty text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'draft')),
  ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.documents
SET category = CASE type::text
  WHEN 'compliance'    THEN 'legal'::document_category_enum
  WHEN 'invoice'       THEN 'operations'::document_category_enum
  WHEN 'delivery_note' THEN 'operations'::document_category_enum
  WHEN 'price_list'    THEN 'sales'::document_category_enum
  WHEN 'fact_sheet'    THEN 'sales'::document_category_enum
  WHEN 'brand_deck'    THEN 'sales'::document_category_enum
  WHEN 'spec_sheet'    THEN 'sales'::document_category_enum
  WHEN 'marketing'     THEN 'marketing'::document_category_enum
  WHEN 'presentation'  THEN 'marketing'::document_category_enum
  ELSE 'operations'::document_category_enum
END
WHERE category IS NULL;

ALTER TABLE public.documents
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN category SET DEFAULT 'operations';

CREATE INDEX IF NOT EXISTS documents_category_idx
  ON public.documents (category);

CREATE INDEX IF NOT EXISTS documents_expires_idx
  ON public.documents (expires_at)
  WHERE expires_at IS NOT NULL;
