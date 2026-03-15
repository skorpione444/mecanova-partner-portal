-- Allow clients to mark their own invoices as paid
CREATE POLICY "Clients can mark own invoices as paid"
  ON public.invoices
  FOR UPDATE
  USING (
    mecanova_current_role() = 'client'
    AND client_id = mecanova_current_partner_id()
  )
  WITH CHECK (
    mecanova_current_role() = 'client'
    AND client_id = mecanova_current_partner_id()
    AND status = 'paid'
  );
