CREATE TABLE research_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  template_used text,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_count int NOT NULL DEFAULT 0,
  admin_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE research_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON research_sessions
  FOR ALL USING (mecanova_is_admin()) WITH CHECK (mecanova_is_admin());

CREATE INDEX idx_research_sessions_user_date ON research_sessions (admin_user_id, created_at DESC);
