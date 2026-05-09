-- ============================================================
-- Holvi → Revolut migration
-- Wipes existing bank data (per product decision: clean slate)
-- Renames sync log, swaps dedup column, adds Revolut metadata
-- Adds revolut_credentials singleton table for OAuth state.
-- ============================================================

-- 1. Wipe existing rows
DELETE FROM public.bank_transactions;
DELETE FROM public.holvi_sync_log;

-- 2. Swap dedup column on bank_transactions
DROP INDEX IF EXISTS public.idx_bank_tx_holvi_id;
ALTER TABLE public.bank_transactions DROP COLUMN holvi_transaction_id;
ALTER TABLE public.bank_transactions
  ADD COLUMN revolut_transaction_id text UNIQUE,
  ADD COLUMN merchant_name          text,
  ADD COLUMN mcc_code               text,
  ADD COLUMN currency               text NOT NULL DEFAULT 'EUR';
CREATE INDEX idx_bank_tx_revolut_id ON public.bank_transactions (revolut_transaction_id);

-- 3. Rename sync log
ALTER TABLE public.holvi_sync_log RENAME TO revolut_sync_log;
ALTER POLICY "admin_holvi_sync_log" ON public.revolut_sync_log RENAME TO "admin_revolut_sync_log";

-- 4. Credentials table (singleton — id always 1)
-- Stores OAuth refresh token (rotates on each use), cached access token,
-- private key PEM, client_id. Service-role API routes upsert id=1.
CREATE TABLE public.revolut_credentials (
  id                       smallint     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  client_id                text         NOT NULL,
  private_key_pem          text         NOT NULL,
  refresh_token            text         NOT NULL,
  access_token             text,
  access_token_expires_at  timestamptz,
  updated_at               timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.revolut_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_revolut_credentials"
  ON public.revolut_credentials FOR ALL TO authenticated
  USING (mecanova_is_admin()) WITH CHECK (mecanova_is_admin());
