-- Migration: Invoices, Delivered status, Estimated delivery, Inventory adjustments, Client contact
-- Features: Invoice Management, Delivered Status, Estimated Delivery, Inventory Adjustments, Client Info

-- ============================================================================
-- 1. Add 'delivered' to order_status_enum
-- ============================================================================

ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'delivered';

-- ============================================================================
-- 2. Add delivery tracking columns to order_requests
-- ============================================================================

ALTER TABLE public.order_requests
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_delivery_date date,
  ADD COLUMN IF NOT EXISTS estimated_delivery_note text;

-- ============================================================================
-- 3. Add contact fields to partners (org-level contact info)
-- ============================================================================

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- ============================================================================
-- 4. Add note column to inventory_movements for adjustment audit trail
-- ============================================================================

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS note text;

-- ============================================================================
-- 5. Create invoice_status_enum
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.invoice_status_enum AS ENUM ('sent', 'paid', 'overdue');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 6. Create invoices table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  distributor_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  due_date date NOT NULL,
  status public.invoice_status_enum NOT NULL DEFAULT 'sent',
  file_path text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  last_reminder_at timestamptz,
  created_by_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invoices_distributor_id ON public.invoices(distributor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 7. Invoices RLS policies
-- ============================================================================

CREATE POLICY "Admins can manage invoices"
  ON public.invoices
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.mecanova_is_admin())
  WITH CHECK (public.mecanova_is_admin());

CREATE POLICY "Distributors can manage own invoices"
  ON public.invoices
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    public.mecanova_current_role() = 'distributor'
    AND distributor_id = public.mecanova_current_partner_id()
  )
  WITH CHECK (
    public.mecanova_current_role() = 'distributor'
    AND distributor_id = public.mecanova_current_partner_id()
  );

CREATE POLICY "Clients can view their invoices"
  ON public.invoices
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.mecanova_current_role() = 'client'
    AND client_id = public.mecanova_current_partner_id()
  );

-- ============================================================================
-- 8. Invoices table grants
-- ============================================================================

GRANT ALL ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

-- ============================================================================
-- 9. deliver_order function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.deliver_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_distributor_id uuid;
  v_status public.order_status_enum;
BEGIN
  SELECT distributor_id, status
    INTO v_distributor_id, v_status
  FROM public.order_requests
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_distributor_id IS NULL THEN
    RAISE EXCEPTION 'deliver_order failed: order not found';
  END IF;

  IF v_status <> 'accepted'::public.order_status_enum THEN
    RAISE EXCEPTION 'deliver_order failed: order status must be accepted (got %)', v_status;
  END IF;

  IF public.mecanova_current_partner_id() <> v_distributor_id
     AND NOT public.mecanova_is_admin() THEN
    RAISE EXCEPTION 'deliver_order failed: not allowed';
  END IF;

  UPDATE public.order_requests
  SET status = 'delivered'::public.order_status_enum,
      delivered_at = COALESCE(delivered_at, now()),
      updated_at = now()
  WHERE id = p_order_id;
END;
$function$;

-- ============================================================================
-- 10. adjust_inventory function for manual stock adjustments
-- ============================================================================

CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_product_id uuid,
  p_qty_delta integer,
  p_movement_type text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_distributor_id uuid;
  v_new_qty integer;
BEGIN
  v_distributor_id := public.mecanova_current_partner_id();

  IF v_distributor_id IS NULL THEN
    RAISE EXCEPTION 'adjust_inventory: not authenticated';
  END IF;

  IF public.mecanova_current_role() <> 'distributor' AND NOT public.mecanova_is_admin() THEN
    RAISE EXCEPTION 'adjust_inventory: not a distributor';
  END IF;

  -- Ensure inventory_status row exists
  INSERT INTO public.inventory_status (distributor_id, product_id, on_hand_qty, status, updated_at)
  VALUES (v_distributor_id, p_product_id, 0, 'out'::public.inventory_status_enum, now())
  ON CONFLICT (distributor_id, product_id) DO NOTHING;

  -- Record movement for audit trail
  INSERT INTO public.inventory_movements (
    distributor_id, product_id, movement_type, qty_delta, note, created_at
  ) VALUES (
    v_distributor_id, p_product_id, p_movement_type, p_qty_delta, p_note, now()
  );

  -- Update on_hand_qty and recompute status
  UPDATE public.inventory_status
  SET on_hand_qty = GREATEST(on_hand_qty + p_qty_delta, 0),
      status = CASE
        WHEN GREATEST(on_hand_qty + p_qty_delta, 0) = 0
          THEN 'out'::public.inventory_status_enum
        WHEN GREATEST(on_hand_qty + p_qty_delta, 0) <= 10
          THEN 'limited'::public.inventory_status_enum
        ELSE 'in_stock'::public.inventory_status_enum
      END,
      updated_at = now()
  WHERE distributor_id = v_distributor_id
    AND product_id = p_product_id;
END;
$function$;

-- ============================================================================
-- 11. get_order_client_info function (SECURITY DEFINER to access auth.users)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_order_client_info(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_client record;
  v_contact_name text;
  v_contact_email text;
  v_contact_phone text;
BEGIN
  SELECT client_id, distributor_id
    INTO v_order
  FROM public.order_requests
  WHERE id = p_order_id;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'get_order_client_info: order not found';
  END IF;

  IF public.mecanova_current_partner_id() <> v_order.distributor_id
     AND NOT public.mecanova_is_admin() THEN
    RAISE EXCEPTION 'get_order_client_info: not allowed';
  END IF;

  SELECT * INTO v_client
  FROM public.partners
  WHERE id = v_order.client_id;

  -- Get contact info from profile/auth as fallback
  SELECT pr.full_name, u.email, pr.phone
    INTO v_contact_name, v_contact_email, v_contact_phone
  FROM public.profiles pr
  JOIN auth.users u ON u.id = pr.user_id
  WHERE pr.partner_id = v_order.client_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'company_name', v_client.name,
    'country', v_client.country,
    'vat_id', v_client.vat_id,
    'billing_address', v_client.billing_address,
    'shipping_address', v_client.shipping_address,
    'contact_person', COALESCE(v_client.contact_person, v_contact_name),
    'contact_email', COALESCE(v_client.contact_email, v_contact_email),
    'contact_phone', COALESCE(v_client.contact_phone, v_contact_phone)
  );
END;
$function$;

-- ============================================================================
-- 12. send_invoice_reminder function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_invoice_reminder(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice record;
  v_client_email text;
  v_distributor_name text;
BEGIN
  SELECT i.*, p.name as client_name
    INTO v_invoice
  FROM public.invoices i
  JOIN public.partners p ON p.id = i.client_id
  WHERE i.id = p_invoice_id;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'send_invoice_reminder: invoice not found';
  END IF;

  IF v_invoice.status = 'paid'::public.invoice_status_enum THEN
    RAISE EXCEPTION 'send_invoice_reminder: invoice already paid';
  END IF;

  IF public.mecanova_current_partner_id() <> v_invoice.distributor_id
     AND NOT public.mecanova_is_admin() THEN
    RAISE EXCEPTION 'send_invoice_reminder: not allowed';
  END IF;

  SELECT u.email INTO v_client_email
  FROM public.profiles pr
  JOIN auth.users u ON u.id = pr.user_id
  WHERE pr.partner_id = v_invoice.client_id
  LIMIT 1;

  SELECT name INTO v_distributor_name
  FROM public.partners
  WHERE id = v_invoice.distributor_id;

  IF v_client_email IS NULL THEN
    RAISE EXCEPTION 'send_invoice_reminder: no client email found';
  END IF;

  INSERT INTO public.email_outbox (
    id, to_email, template, subject, payload, status
  ) VALUES (
    gen_random_uuid(),
    v_client_email,
    'invoice_reminder',
    'Payment Reminder: Invoice ' || v_invoice.invoice_number,
    jsonb_build_object(
      'invoice_id', v_invoice.id,
      'invoice_number', v_invoice.invoice_number,
      'amount', v_invoice.amount,
      'currency', v_invoice.currency,
      'due_date', v_invoice.due_date,
      'client_name', v_invoice.client_name,
      'distributor_name', v_distributor_name
    ),
    'pending'
  );

  UPDATE public.invoices
  SET last_reminder_at = now()
  WHERE id = p_invoice_id;
END;
$function$;

-- ============================================================================
-- 13. Update enqueue_order_emails trigger to handle 'delivered' status
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
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Status changed, proceed
  ELSE
    RETURN NEW;
  END IF;

  -- submitted -> email distributor
  IF NEW.status = 'submitted' THEN
    SELECT auth.users.email INTO recipient_email
    FROM auth.users
    JOIN public.profiles ON profiles.user_id = auth.users.id
    WHERE profiles.partner_id = NEW.distributor_id
      AND profiles.role = 'distributor'
    LIMIT 1;

    IF recipient_email IS NOT NULL THEN
      INSERT INTO public.email_outbox (to_email, template, subject, payload, order_request_id)
      VALUES (
        recipient_email,
        'order_submitted_to_distributor',
        'New order submitted',
        jsonb_build_object(
          'order_request_id', NEW.id, 'status', NEW.status,
          'client_id', NEW.client_id, 'distributor_id', NEW.distributor_id,
          'submitted_at', NEW.submitted_at
        ),
        NEW.id
      );
    END IF;
  END IF;

  -- accepted -> email client
  IF NEW.status = 'accepted' THEN
    SELECT auth.users.email INTO recipient_email
    FROM auth.users
    JOIN public.profiles ON profiles.user_id = auth.users.id
    WHERE profiles.partner_id = NEW.client_id
      AND profiles.role = 'client'
    LIMIT 1;

    IF recipient_email IS NOT NULL THEN
      INSERT INTO public.email_outbox (to_email, template, subject, payload, order_request_id)
      VALUES (
        recipient_email,
        'order_accepted_to_client',
        'Your order was accepted',
        jsonb_build_object(
          'order_request_id', NEW.id, 'status', NEW.status,
          'client_id', NEW.client_id, 'distributor_id', NEW.distributor_id,
          'accepted_at', NEW.accepted_at
        ),
        NEW.id
      );
    END IF;
  END IF;

  -- rejected -> email client
  IF NEW.status = 'rejected' THEN
    SELECT auth.users.email INTO recipient_email
    FROM auth.users
    JOIN public.profiles ON profiles.user_id = auth.users.id
    WHERE profiles.partner_id = NEW.client_id
      AND profiles.role = 'client'
    LIMIT 1;

    IF recipient_email IS NOT NULL THEN
      INSERT INTO public.email_outbox (to_email, template, subject, payload, order_request_id)
      VALUES (
        recipient_email,
        'order_rejected_to_client',
        'Your order was rejected',
        jsonb_build_object(
          'order_request_id', NEW.id, 'status', NEW.status,
          'client_id', NEW.client_id, 'distributor_id', NEW.distributor_id,
          'rejected_at', NEW.rejected_at
        ),
        NEW.id
      );
    END IF;
  END IF;

  -- delivered -> email client
  IF NEW.status = 'delivered' THEN
    SELECT auth.users.email INTO recipient_email
    FROM auth.users
    JOIN public.profiles ON profiles.user_id = auth.users.id
    WHERE profiles.partner_id = NEW.client_id
      AND profiles.role = 'client'
    LIMIT 1;

    IF recipient_email IS NOT NULL THEN
      INSERT INTO public.email_outbox (to_email, template, subject, payload, order_request_id)
      VALUES (
        recipient_email,
        'order_delivered_to_client',
        'Your order has been delivered',
        jsonb_build_object(
          'order_request_id', NEW.id, 'status', NEW.status,
          'client_id', NEW.client_id, 'distributor_id', NEW.distributor_id,
          'delivered_at', NEW.delivered_at
        ),
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 14. Add phone column to profiles
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

-- ============================================================================
-- 15. Storage policy: allow distributors to upload invoices
-- ============================================================================

CREATE POLICY "distributors_upload_invoices"
  ON storage.objects
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'invoices'
    AND public.mecanova_current_role() = 'distributor'
  );
