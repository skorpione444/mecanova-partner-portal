-- Migration: Fix profiles table queries to use user_id instead of id
-- Issue: Profiles table uses user_id (uuid) as primary link to auth.users, NOT id
-- This migration fixes SQL helper functions and RLS policies

-- ============================================================================
-- 1. Fix SQL Helper Functions
-- ============================================================================

-- Drop all existing versions of these functions (handles any signature)
-- Using DO blocks to gracefully handle cases where functions don't exist
DO $$ 
DECLARE
  func_record RECORD;
BEGIN
  -- Drop all versions of current_role
  FOR func_record IN 
    SELECT oid::regprocedure FROM pg_proc WHERE proname = 'current_role'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.oid::regprocedure || ' CASCADE';
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$ 
DECLARE
  func_record RECORD;
BEGIN
  -- Drop all versions of current_partner_id
  FOR func_record IN 
    SELECT oid::regprocedure FROM pg_proc WHERE proname = 'current_partner_id'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.oid::regprocedure || ' CASCADE';
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$ 
DECLARE
  func_record RECORD;
BEGIN
  -- Drop all versions of is_admin
  FOR func_record IN 
    SELECT oid::regprocedure FROM pg_proc WHERE proname = 'is_admin'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.oid::regprocedure || ' CASCADE';
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create current_role() to use user_id instead of id
CREATE FUNCTION current_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Create current_partner_id() to use user_id instead of id
CREATE FUNCTION current_partner_id()
RETURNS UUID AS $$
  SELECT partner_id FROM profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Create is_admin() to use user_id instead of id
CREATE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 2. Fix RLS Policies on profiles table
-- ============================================================================

-- Drop existing policies (they will be recreated with correct logic)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Recreate policies using user_id instead of id
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- ============================================================================
-- 3. Fix RLS Policies on other tables that reference profiles
-- ============================================================================

-- Fix documents table policies (if they reference profiles.id)
DROP POLICY IF EXISTS "Partners can view their own documents" ON documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
DROP POLICY IF EXISTS "Partners can create documents" ON documents;
DROP POLICY IF EXISTS "Partners can update their own documents" ON documents;

CREATE POLICY "Partners can view their own documents"
  ON documents FOR SELECT
  USING (
    partner_id = (
      SELECT partner_id FROM profiles WHERE user_id = auth.uid()
    )
    OR is_shared = true
  );

CREATE POLICY "Admins can view all documents"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Partners can create documents"
  ON documents FOR INSERT
  WITH CHECK (
    partner_id = (
      SELECT partner_id FROM profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Partners can update their own documents"
  ON documents FOR UPDATE
  USING (
    partner_id = (
      SELECT partner_id FROM profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    partner_id = (
      SELECT partner_id FROM profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Fix order_requests table policies (if they reference profiles.id)
DROP POLICY IF EXISTS "Partners can view their own orders" ON order_requests;
DROP POLICY IF EXISTS "Admins can view all orders" ON order_requests;
DROP POLICY IF EXISTS "Partners can create orders" ON order_requests;
DROP POLICY IF EXISTS "Partners can update their own orders" ON order_requests;

CREATE POLICY "Partners can view their own orders"
  ON order_requests FOR SELECT
  USING (
    partner_id = (
      SELECT partner_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all orders"
  ON order_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Partners can create orders"
  ON order_requests FOR INSERT
  WITH CHECK (
    partner_id = (
      SELECT partner_id FROM profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Partners can update their own orders"
  ON order_requests FOR UPDATE
  USING (
    partner_id = (
      SELECT partner_id FROM profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    partner_id = (
      SELECT partner_id FROM profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Fix order_request_items table policies (if they reference profiles.id)
DROP POLICY IF EXISTS "Partners can view their own order items" ON order_request_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON order_request_items;
DROP POLICY IF EXISTS "Partners can create order items" ON order_request_items;

CREATE POLICY "Partners can view their own order items"
  ON order_request_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM order_requests o
      WHERE o.id = order_request_items.order_request_id
      AND (
        o.partner_id = (
          SELECT partner_id FROM profiles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE user_id = auth.uid() 
          AND role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Admins can view all order items"
  ON order_request_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Partners can create order items"
  ON order_request_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM order_requests o
      WHERE o.id = order_request_items.order_request_id
      AND (
        o.partner_id = (
          SELECT partner_id FROM profiles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE user_id = auth.uid() 
          AND role = 'admin'
        )
      )
    )
  );

-- Fix partners table policies (if they reference profiles.id)
DROP POLICY IF EXISTS "Admins can view all partners" ON partners;
DROP POLICY IF EXISTS "Partners can view their own partner record" ON partners;

CREATE POLICY "Admins can view all partners"
  ON partners FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Partners can view their own partner record"
  ON partners FOR SELECT
  USING (
    id = (
      SELECT partner_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Fix products table policies (if they reference profiles.id)
-- Products are typically readable by all authenticated users
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;

CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Fix inventory_status table policies (if they reference profiles.id)
DROP POLICY IF EXISTS "Authenticated users can view inventory" ON inventory_status;
DROP POLICY IF EXISTS "Admins can manage inventory" ON inventory_status;

CREATE POLICY "Authenticated users can view inventory"
  ON inventory_status FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage inventory"
  ON inventory_status FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- ============================================================================
-- 4. Grant necessary permissions
-- ============================================================================

-- Ensure the functions are accessible
GRANT EXECUTE ON FUNCTION current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION current_partner_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- After running this migration:
-- 1. Test login as admin user - profile should load correctly
-- 2. Test login as partner user - profile should load correctly
-- 3. Verify role-based UI works (admin sees all, partner sees scoped data)
-- 4. Verify RLS policies work correctly for all tables

