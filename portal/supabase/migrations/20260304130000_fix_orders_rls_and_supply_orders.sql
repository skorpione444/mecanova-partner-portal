-- Migration: Fix order_requests RLS for distributors + add supply order support
-- Problem: order_requests RLS only checks partner_id (= client_id), so distributors
-- cannot see, accept, or reject orders assigned to them.
-- Also: client_distributors RLS only allows clients to see their mappings, not distributors.

-- ============================================================================
-- 1. Fix order_requests RLS
-- ============================================================================

DROP POLICY IF EXISTS "Partners can view their own orders" ON order_requests;
DROP POLICY IF EXISTS "Admins can view all orders" ON order_requests;
DROP POLICY IF EXISTS "Partners can create orders" ON order_requests;
DROP POLICY IF EXISTS "Partners can update their own orders" ON order_requests;
DROP POLICY IF EXISTS "Clients can view their orders" ON order_requests;
DROP POLICY IF EXISTS "Distributors can view assigned orders" ON order_requests;
DROP POLICY IF EXISTS "Users can create orders" ON order_requests;
DROP POLICY IF EXISTS "Clients can update own orders" ON order_requests;
DROP POLICY IF EXISTS "Distributors can update assigned orders" ON order_requests;
DROP POLICY IF EXISTS "Admins can manage all orders" ON order_requests;

-- Clients see orders where they are the client
CREATE POLICY "Clients can view their orders"
  ON order_requests FOR SELECT
  USING (client_id = public.mecanova_current_partner_id());

-- Distributors see orders assigned to them (but not drafts)
CREATE POLICY "Distributors can view assigned orders"
  ON order_requests FOR SELECT
  USING (
    distributor_id = public.mecanova_current_partner_id()
    AND status <> 'created'
  );

-- Admins see all
CREATE POLICY "Admins can view all orders"
  ON order_requests FOR SELECT
  USING (public.mecanova_is_admin());

-- Insert: the partner_id must match current user's partner, or admin
CREATE POLICY "Users can create orders"
  ON order_requests FOR INSERT
  WITH CHECK (
    partner_id = public.mecanova_current_partner_id()
    OR public.mecanova_is_admin()
  );

-- Update: clients can update their own orders
CREATE POLICY "Clients can update own orders"
  ON order_requests FOR UPDATE
  USING (client_id = public.mecanova_current_partner_id())
  WITH CHECK (client_id = public.mecanova_current_partner_id());

-- Update: distributors can update orders assigned to them
CREATE POLICY "Distributors can update assigned orders"
  ON order_requests FOR UPDATE
  USING (distributor_id = public.mecanova_current_partner_id())
  WITH CHECK (distributor_id = public.mecanova_current_partner_id());

-- Update: admins can update all
CREATE POLICY "Admins can manage all orders"
  ON order_requests FOR ALL
  USING (public.mecanova_is_admin())
  WITH CHECK (public.mecanova_is_admin());

-- ============================================================================
-- 2. Fix order_request_items RLS
-- ============================================================================

DROP POLICY IF EXISTS "Partners can view their own order items" ON order_request_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON order_request_items;
DROP POLICY IF EXISTS "Partners can create order items" ON order_request_items;
DROP POLICY IF EXISTS "Users can view order items" ON order_request_items;
DROP POLICY IF EXISTS "Users can create order items" ON order_request_items;

CREATE POLICY "Users can view order items"
  ON order_request_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM order_requests o
      WHERE o.id = order_request_items.order_request_id
      AND (
        o.client_id = public.mecanova_current_partner_id()
        OR o.distributor_id = public.mecanova_current_partner_id()
        OR public.mecanova_is_admin()
      )
    )
  );

CREATE POLICY "Users can create order items"
  ON order_request_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM order_requests o
      WHERE o.id = order_request_items.order_request_id
      AND (
        o.client_id = public.mecanova_current_partner_id()
        OR public.mecanova_is_admin()
      )
    )
  );

-- ============================================================================
-- 3. Fix client_distributors RLS: distributors should see their client mappings
-- ============================================================================

DROP POLICY IF EXISTS "Distributors can view their client mappings" ON client_distributors;

CREATE POLICY "Distributors can view their client mappings"
  ON client_distributors FOR SELECT
  USING (distributor_id = public.mecanova_current_partner_id());

-- ============================================================================
-- 4. Add create_supply_order function for distributors ordering from Mecanova
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_supply_order()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_distributor_id uuid;
  v_mecanova_id uuid;
  v_order_id uuid;
BEGIN
  SELECT p.partner_id
    INTO v_distributor_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND p.role = 'distributor';

  IF v_distributor_id IS NULL THEN
    RAISE EXCEPTION 'create_supply_order failed: caller is not a distributor';
  END IF;

  SELECT id INTO v_mecanova_id
  FROM public.partners
  WHERE is_mecanova = true
  LIMIT 1;

  IF v_mecanova_id IS NULL THEN
    RAISE EXCEPTION 'create_supply_order failed: Mecanova partner not found';
  END IF;

  INSERT INTO public.order_requests (
    partner_id,
    client_id,
    distributor_id,
    created_by_user,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_distributor_id,
    v_distributor_id,
    v_mecanova_id,
    auth.uid(),
    'created'::public.order_status_enum,
    now(),
    now()
  )
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_supply_order() TO authenticated;
