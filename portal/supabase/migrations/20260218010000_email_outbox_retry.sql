-- Migration: Add retry and locking columns to email_outbox table
-- Enables retry logic with exponential backoff and concurrency-safe processing

-- ============================================================================
-- 1. Add retry and locking columns
-- ============================================================================

ALTER TABLE public.email_outbox
  ADD COLUMN IF NOT EXISTS attempt_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text;

-- ============================================================================
-- 2. Add index for efficient retry querying
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_email_outbox_retry 
  ON public.email_outbox(status, next_retry_at, created_at)
  WHERE status IN ('pending', 'failed');

-- ============================================================================
-- 3. Add comment explaining retry logic
-- ============================================================================

COMMENT ON COLUMN public.email_outbox.attempt_count IS 'Number of send attempts (0 = first attempt)';
COMMENT ON COLUMN public.email_outbox.next_retry_at IS 'When to retry this email (null = ready now or never)';
COMMENT ON COLUMN public.email_outbox.locked_at IS 'Timestamp when row was locked for processing (prevents concurrent processing)';
COMMENT ON COLUMN public.email_outbox.locked_by IS 'Identifier of the worker that locked this row';





