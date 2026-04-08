-- Add contact_position to partners (job title of the contact person)
ALTER TABLE partners ADD COLUMN IF NOT EXISTS contact_position text;

-- Add contact_position to prospects too
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_position text;

-- Create crm-files storage bucket (private, 50MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('crm-files', 'crm-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: admin can upload and download from crm-files
CREATE POLICY "Admin full access to crm-files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'crm-files' AND (SELECT mecanova_is_admin()))
WITH CHECK (bucket_id = 'crm-files' AND (SELECT mecanova_is_admin()));
