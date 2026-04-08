-- CRM Interactions table
-- Each row belongs to exactly one entity: a prospect OR a partner, never both.

CREATE TABLE crm_interactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id uuid REFERENCES prospects(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  interaction_type crm_interaction_type_enum NOT NULL,
  summary text NOT NULL,
  body text,
  file_path text,
  file_name text,
  occurred_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Enforce exactly one entity
  CONSTRAINT exactly_one_entity CHECK (
    (prospect_id IS NOT NULL AND partner_id IS NULL) OR
    (prospect_id IS NULL AND partner_id IS NOT NULL)
  )
);

CREATE INDEX crm_interactions_prospect_idx ON crm_interactions (prospect_id, occurred_at DESC);
CREATE INDEX crm_interactions_partner_idx ON crm_interactions (partner_id, occurred_at DESC);

-- RLS: admin-only
ALTER TABLE crm_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on crm_interactions"
  ON crm_interactions
  FOR ALL
  TO authenticated
  USING (mecanova_is_admin())
  WITH CHECK (mecanova_is_admin());
