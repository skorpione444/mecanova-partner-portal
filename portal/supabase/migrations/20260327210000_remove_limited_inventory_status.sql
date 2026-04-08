-- Remove 'limited' from inventory_status_enum; reclassify all 'limited' rows as 'in_stock'

-- Step 1: Update all existing 'limited' rows to 'in_stock'
UPDATE public.inventory_status
  SET status = 'in_stock'
  WHERE status = 'limited';

-- Step 2: Recreate enum without 'limited'
ALTER TYPE public.inventory_status_enum RENAME TO inventory_status_enum_old;
CREATE TYPE public.inventory_status_enum AS ENUM ('in_stock', 'out');
ALTER TABLE public.inventory_status
  ALTER COLUMN status TYPE public.inventory_status_enum
  USING status::text::public.inventory_status_enum;
DROP TYPE public.inventory_status_enum_old;
