-- Fix: Break RLS recursion on client_distributors table
-- Problem: RLS policy on client_distributors queries profiles, which may trigger
-- other policies that query client_distributors, causing infinite recursion (error 54001)

-- The issue: If the RLS policy on client_distributors uses a subquery like:
--   client_id = (SELECT partner_id FROM profiles WHERE user_id = auth.uid())
-- This subquery triggers RLS on profiles, which might have policies that query
-- client_distributors, creating infinite recursion.

-- Solution: Use the existing SECURITY DEFINER function current_partner_id()
-- which bypasses RLS on profiles, breaking the recursion cycle.

-- Step 1: Ensure current_partner_id() function exists (from fix_profiles_user_id.sql)
-- If it doesn't exist, create it:
CREATE OR REPLACE FUNCTION current_partner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT partner_id FROM profiles WHERE user_id = auth.uid();
$$;

-- Step 2: Drop existing policies on client_distributors
DROP POLICY IF EXISTS "Clients can view their distributor mappings" ON client_distributors;
DROP POLICY IF EXISTS "Admins can view all client_distributors" ON client_distributors;
DROP POLICY IF EXISTS "Authenticated users can view client_distributors" ON client_distributors;
DROP POLICY IF EXISTS "Clients can view their own distributor mappings" ON client_distributors;

-- Step 3: Recreate policies using current_partner_id() function to avoid recursion
-- This function uses SECURITY DEFINER, so it bypasses RLS on profiles

-- Policy: Clients can view their own distributor mappings
CREATE POLICY "Clients can view their distributor mappings"
  ON client_distributors FOR SELECT
  USING (
    client_id = current_partner_id()
  );

-- Policy: Admins can view all client_distributors
-- Use is_admin() function if it exists, otherwise use direct query
CREATE POLICY "Admins can view all client_distributors"
  ON client_distributors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Step 4: Grant execute permission (if not already granted)
GRANT EXECUTE ON FUNCTION current_partner_id() TO authenticated;

-- Verification:
-- After running this, test by logging in as clienta@test.mecanova.de
-- and querying: SELECT * FROM client_distributors;
-- Should return the mapping without stack overflow error

