-- Fix: Allow clients to see their linked distributors (and distributors to see linked clients)
-- Problem: "Users can view own org" only allows id = mecanova_current_partner_id(), so clients
-- cannot fetch distributor partner records when loading the order form. This causes
-- distPartners to be empty and "No distributor assigned" to appear.
--
-- Solution: Add policy to allow viewing partners linked via client_distributors.

CREATE POLICY "Users can view linked orgs"
  ON public.partners
  FOR SELECT
  TO authenticated
  USING (
    -- Clients can see their distributors
    EXISTS (
      SELECT 1 FROM public.client_distributors cd
      WHERE cd.distributor_id = partners.id
        AND cd.client_id = public.mecanova_current_partner_id()
    )
    OR
    -- Distributors can see their clients
    EXISTS (
      SELECT 1 FROM public.client_distributors cd
      WHERE cd.client_id = partners.id
        AND cd.distributor_id = public.mecanova_current_partner_id()
    )
  );
