-- Additional contact persons per partner (one-to-many).
-- The partner's existing partners.contact_* columns remain the PRIMARY contact
-- (still used by orders/CRM/search); this table holds extra contacts on top.
CREATE TABLE public.partner_contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id       UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  contact_person   TEXT,
  contact_position TEXT,
  contact_email    TEXT,
  contact_phone    TEXT,
  notes            TEXT,
  created_by       UUID NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage partner contacts"
  ON public.partner_contacts FOR ALL
  TO authenticated
  USING (public.mecanova_is_admin())
  WITH CHECK (public.mecanova_is_admin());

CREATE INDEX idx_partner_contacts_partner    ON public.partner_contacts(partner_id);
CREATE INDEX idx_partner_contacts_created_at ON public.partner_contacts(created_at DESC);
