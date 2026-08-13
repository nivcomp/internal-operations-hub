-- Client-uploaded project files (private bucket, first folder = project id)
CREATE POLICY "project files admin all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'project-files' AND private.is_agency_admin())
  WITH CHECK (bucket_id = 'project-files' AND private.is_agency_admin());

CREATE POLICY "project files client insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND array_length(storage.foldername(name), 1) >= 1
    AND private.client_owns_project(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "project files client read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-files'
    AND array_length(storage.foldername(name), 1) >= 1
    AND private.client_owns_project(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "project files supplier read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-files'
    AND array_length(storage.foldername(name), 1) >= 1
    AND private.supplier_has_project(((storage.foldername(name))[1])::uuid)
  );

-- Clients may register their own uploads in the project file list
CREATE POLICY "files_client_insert" ON public.files FOR INSERT TO authenticated
  WITH CHECK (private.client_owns_project(project_id) AND visibility = 'client_visible');