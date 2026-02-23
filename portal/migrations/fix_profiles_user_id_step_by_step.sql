-- Step 1: Create current_role function
-- Copy and run this first statement:

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT role FROM profiles WHERE user_id = auth.uid();
$$;

-- Step 2: Create current_partner_id function
-- Copy and run this second statement:

CREATE OR REPLACE FUNCTION public.current_partner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT partner_id FROM profiles WHERE user_id = auth.uid();
$$;

-- Step 3: Create is_admin function
-- Copy and run this third statement:

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'
);
$$;






