-- Order payment / receivables tracking.
-- Lightweight payment fields on the order itself (not the formal invoices artifact):
-- amount owed + due date captured at delivery, partial payments via amount_paid,
-- paid_at set when fully settled. Also add amount_paid to invoices so the unified
-- Receivables view can show partial payments for invoices too.
ALTER TABLE public.order_requests
  ADD COLUMN IF NOT EXISTS payment_due_date date,
  ADD COLUMN IF NOT EXISTS amount_due  numeric(12,2),
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at     timestamptz;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_order_requests_payment_due
  ON public.order_requests(payment_due_date) WHERE paid_at IS NULL;

NOTIFY pgrst, 'reload schema';
