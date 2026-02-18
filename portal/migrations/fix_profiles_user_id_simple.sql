CREATE OR REPLACE FUNCTION current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $body$
SELECT role FROM profiles WHERE user_id = auth.uid();
$body$;

CREATE OR REPLACE FUNCTION current_partner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $body$
SELECT partner_id FROM profiles WHERE user_id = auth.uid();
$body$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $body$
SELECT EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'
);
$body$;

