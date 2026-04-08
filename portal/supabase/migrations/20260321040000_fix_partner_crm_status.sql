-- Ensure all existing partners have crm_status set to 'customer'
-- The DEFAULT was added in migration 20260321010000 but may not have back-filled
-- all rows depending on DB version behavior; this guarantees consistency.

UPDATE partners
SET crm_status = 'customer'
WHERE crm_status IS NULL;
