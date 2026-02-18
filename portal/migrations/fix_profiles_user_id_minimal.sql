CREATE OR REPLACE FUNCTION current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
SELECT role FROM profiles WHERE user_id = auth.uid();
$func$;

CREATE OR REPLACE FUNCTION current_partner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
SELECT partner_id FROM profiles WHERE user_id = auth.uid();
$func$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
SELECT EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'
);
$func$;





