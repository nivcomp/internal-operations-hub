
CREATE POLICY "admin reads crm imports" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crm-imports' AND private.is_agency_admin());
CREATE POLICY "admin uploads crm imports" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-imports' AND private.is_agency_admin());
CREATE POLICY "admin updates crm imports" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'crm-imports' AND private.is_agency_admin())
  WITH CHECK (bucket_id = 'crm-imports' AND private.is_agency_admin());
CREATE POLICY "admin deletes crm imports" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crm-imports' AND private.is_agency_admin());
