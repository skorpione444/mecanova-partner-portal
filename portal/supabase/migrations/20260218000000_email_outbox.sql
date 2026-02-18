-- Migration: Email Outbox Pattern for Order Status Change Notifications
-- Creates email_outbox table and trigger to enqueue emails when order_requests.status changes

-- ============================================================================
-- 1. Create email_outbox table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  to_email text NOT NULL,
  template text NOT NULL,
  subject text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  order_request_id uuid REFERENCES public.order_requests(id) ON DELETE CASCADE,
  last_error text,
  sent_at timestamptz
);

-- ============================================================================
-- 2. Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_email_outbox_status_created_at ON public.email_outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_outbox_order_request_id ON public.email_outbox(order_request_id);

-- ============================================================================
-- 3. Create trigger function to enqueue emails
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_order_emails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recipient_email text;
  email_template text;
  email_subject text;
  email_payload jsonb;
BEGIN
  -- Only process if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Status changed, proceed with email enqueueing
  ELSE
    -- Status unchanged, skip
    RETURN NEW;
  END IF;

  -- Handle status = 'submitted' -> email distributor
  IF NEW.status = 'submitted' THEN
    -- Resolve distributor email via profiles -> auth.users
    SELECT auth.users.email INTO recipient_email
    FROM auth.users
    JOIN public.profiles ON profiles.user_id = auth.users.id
    WHERE profiles.partner_id = NEW.distributor_id
      AND profiles.role = 'distributor'
    LIMIT 1;

    -- Only enqueue if email found
    IF recipient_email IS NOT NULL THEN
      email_template := 'order_submitted_to_distributor';
      email_subject := 'New order submitted';
      email_payload := jsonb_build_object(
        'order_request_id', NEW.id,
        'status', NEW.status,
        'client_id', NEW.client_id,
        'distributor_id', NEW.distributor_id,
        'submitted_at', NEW.submitted_at
      );

      INSERT INTO public.email_outbox (
        to_email,
        template,
        subject,
        payload,
        order_request_id
      ) VALUES (
        recipient_email,
        email_template,
        email_subject,
        email_payload,
        NEW.id
      );
    END IF;
  END IF;

  -- Handle status = 'accepted' -> email client
  IF NEW.status = 'accepted' THEN
    -- Resolve client email via profiles -> auth.users
    SELECT auth.users.email INTO recipient_email
    FROM auth.users
    JOIN public.profiles ON profiles.user_id = auth.users.id
    WHERE profiles.partner_id = NEW.client_id
      AND profiles.role = 'client'
    LIMIT 1;

    -- Only enqueue if email found
    IF recipient_email IS NOT NULL THEN
      email_template := 'order_accepted_to_client';
      email_subject := 'Your order was accepted';
      email_payload := jsonb_build_object(
        'order_request_id', NEW.id,
        'status', NEW.status,
        'client_id', NEW.client_id,
        'distributor_id', NEW.distributor_id,
        'accepted_at', NEW.accepted_at
      );

      INSERT INTO public.email_outbox (
        to_email,
        template,
        subject,
        payload,
        order_request_id
      ) VALUES (
        recipient_email,
        email_template,
        email_subject,
        email_payload,
        NEW.id
      );
    END IF;
  END IF;

  -- Handle status = 'rejected' -> email client
  IF NEW.status = 'rejected' THEN
    -- Resolve client email via profiles -> auth.users
    SELECT auth.users.email INTO recipient_email
    FROM auth.users
    JOIN public.profiles ON profiles.user_id = auth.users.id
    WHERE profiles.partner_id = NEW.client_id
      AND profiles.role = 'client'
    LIMIT 1;

    -- Only enqueue if email found
    IF recipient_email IS NOT NULL THEN
      email_template := 'order_rejected_to_client';
      email_subject := 'Your order was rejected';
      email_payload := jsonb_build_object(
        'order_request_id', NEW.id,
        'status', NEW.status,
        'client_id', NEW.client_id,
        'distributor_id', NEW.distributor_id,
        'rejected_at', NEW.rejected_at
      );

      INSERT INTO public.email_outbox (
        to_email,
        template,
        subject,
        payload,
        order_request_id
      ) VALUES (
        recipient_email,
        email_template,
        email_subject,
        email_payload,
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. Create trigger on order_requests table
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_enqueue_order_emails ON public.order_requests;

CREATE TRIGGER trigger_enqueue_order_emails
  AFTER UPDATE OF status ON public.order_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_order_emails();

-- ============================================================================
-- 5. Grant necessary permissions
-- ============================================================================

-- Allow service role to read/update email_outbox (for edge function)
-- RLS will be enabled but service role bypasses it
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access (edge function uses service role)
CREATE POLICY "Service role can manage email_outbox"
  ON public.email_outbox
  FOR ALL
  USING (true)
  WITH CHECK (true);

