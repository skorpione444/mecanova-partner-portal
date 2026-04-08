-- Add bottles_per_case to products for informational display in fulfillment planning modal
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS bottles_per_case INTEGER;
