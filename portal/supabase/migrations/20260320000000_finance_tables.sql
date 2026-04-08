-- ============================================================
-- Finance Tables: bank_transactions + holvi_sync_log
-- ============================================================

-- bank_transactions: synced from Holvi, enriched by admin
CREATE TABLE public.bank_transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holvi_transaction_id  text UNIQUE,
  amount                numeric(12,2) NOT NULL,
  direction             text NOT NULL CHECK (direction IN ('in', 'out')),
  description           text,
  transaction_date      date NOT NULL,

  -- Categorization (auto or manual)
  cost_type   text NOT NULL DEFAULT 'uncategorized'
                CHECK (cost_type IN ('infrastructure', 'operational', 'income', 'transfer', 'uncategorized')),
  category    text,   -- subscription, logistics, production, travel, marketing, sale, bank_fee, etc.
  assigned_to text    CHECK (assigned_to IN ('company', 'felix', 'sebastian')),

  -- Enrichment
  notes           text,
  travel_reason   text,
  travel_who_met  text,

  -- Reconciliation
  matched_invoice_id uuid REFERENCES public.invoices(id),

  synced_at   timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);

-- holvi_sync_log: audit trail for each sync run
CREATE TABLE public.holvi_sync_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at             timestamptz DEFAULT now(),
  transactions_fetched  int DEFAULT 0,
  transactions_new      int DEFAULT 0,
  status                text NOT NULL CHECK (status IN ('success', 'error')),
  error_message         text
);

-- RLS: admins only
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holvi_sync_log    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_bank_transactions"
  ON public.bank_transactions FOR ALL TO authenticated
  USING (mecanova_is_admin()) WITH CHECK (mecanova_is_admin());

CREATE POLICY "admin_holvi_sync_log"
  ON public.holvi_sync_log FOR ALL TO authenticated
  USING (mecanova_is_admin()) WITH CHECK (mecanova_is_admin());

-- Indexes
CREATE INDEX idx_bank_tx_date       ON public.bank_transactions (transaction_date DESC);
CREATE INDEX idx_bank_tx_dir_type   ON public.bank_transactions (direction, cost_type);
CREATE INDEX idx_bank_tx_holvi_id   ON public.bank_transactions (holvi_transaction_id);
CREATE INDEX idx_bank_tx_category   ON public.bank_transactions (category);
