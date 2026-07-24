
-- =========================================================================
-- PHASE 1: AUTH + PROFILES + RLS OVERHAUL
-- =========================================================================

-- 1) ENUM ------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('agency_admin', 'client', 'supplier');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) PROFILES --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    text NOT NULL DEFAULT '',
  email        text NOT NULL,
  role         public.app_role NOT NULL,
  client_id    uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  supplier_id  uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_role_link_ck CHECK (
    (role = 'agency_admin' AND client_id IS NULL AND supplier_id IS NULL) OR
    (role = 'client'       AND client_id IS NOT NULL AND supplier_id IS NULL) OR
    (role = 'supplier'     AND supplier_id IS NOT NULL AND client_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS profiles_role_idx        ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_client_id_idx   ON public.profiles(client_id);
CREATE INDEX IF NOT EXISTS profiles_supplier_id_idx ON public.profiles(supplier_id);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL           ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- updated_at trigger (reuse existing set_updated_at())
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) SECURITY HELPERS ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles
   WHERE id = auth.uid() AND is_active = true
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_agency_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid()
       AND role = 'agency_admin'
       AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT client_id FROM public.profiles
   WHERE id = auth.uid() AND role = 'client' AND is_active = true
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_supplier_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT supplier_id FROM public.profiles
   WHERE id = auth.uid() AND role = 'supplier' AND is_active = true
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.supplier_has_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_supplier_assignments psa
     WHERE psa.project_id = _project_id
       AND psa.supplier_id = public.current_supplier_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.client_owns_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
     WHERE p.id = _project_id
       AND p.client_id = public.current_client_id()
  )
$$;

REVOKE ALL ON FUNCTION public.current_user_role()             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_agency_admin()               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_client_id()             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_supplier_id()           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.supplier_has_project(uuid)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_owns_project(uuid)       FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_role()          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_agency_admin()            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_client_id()          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_supplier_id()        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.supplier_has_project(uuid)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.client_owns_project(uuid)    TO authenticated, service_role;

-- 4) AUTO PROFILE ON NEW AUTH USER ----------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  meta        jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  m_role      text  := meta->>'role';
  m_client    uuid  := nullif(meta->>'client_id',   '')::uuid;
  m_supplier  uuid  := nullif(meta->>'supplier_id', '')::uuid;
  m_name      text  := coalesce(meta->>'full_name', NEW.email);
BEGIN
  IF m_role IN ('agency_admin','client','supplier') THEN
    INSERT INTO public.profiles (id, email, full_name, role, client_id, supplier_id)
    VALUES (NEW.id, NEW.email, m_name, m_role::public.app_role, m_client, m_supplier)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 5) BOOTSTRAP FIRST AGENCY ADMIN -----------------------------------------
CREATE OR REPLACE FUNCTION public.bootstrap_agency_admin(_email text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE u_id uuid;
BEGIN
  SELECT id INTO u_id FROM auth.users WHERE email = _email LIMIT 1;
  IF u_id IS NULL THEN
    RAISE EXCEPTION 'No auth user with email %. Create the user first in Cloud > Users.', _email;
  END IF;
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (u_id, _email, _email, 'agency_admin', true)
  ON CONFLICT (id) DO UPDATE
    SET role = 'agency_admin',
        client_id = NULL,
        supplier_id = NULL,
        is_active = true;
  RETURN u_id;
END $$;
REVOKE ALL ON FUNCTION public.bootstrap_agency_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_agency_admin(text) TO service_role;

-- 6) DROP ALL EXISTING POLICIES ON PUBLIC OPERATIONAL TABLES --------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename <> 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 7) REVOKE ANON GRANTS FROM OPERATIONAL TABLES ---------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
-- Baseline: authenticated has RLS-gated access; service_role has full access.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 8) PROFILES POLICIES ----------------------------------------------------
CREATE POLICY profiles_self_select    ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_agency_admin());
CREATE POLICY profiles_self_update    ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_agency_admin())
  WITH CHECK (
    public.is_agency_admin() OR (
      id = auth.uid()
      AND role = (SELECT p.role       FROM public.profiles p WHERE p.id = auth.uid())
      AND client_id  IS NOT DISTINCT FROM (SELECT p.client_id   FROM public.profiles p WHERE p.id = auth.uid())
      AND supplier_id IS NOT DISTINCT FROM (SELECT p.supplier_id FROM public.profiles p WHERE p.id = auth.uid())
      AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
    )
  );
CREATE POLICY profiles_admin_insert   ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_agency_admin());
CREATE POLICY profiles_admin_delete   ON public.profiles FOR DELETE TO authenticated
  USING (public.is_agency_admin());

-- 9) CLIENTS --------------------------------------------------------------
CREATE POLICY clients_admin_all       ON public.clients FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY clients_own_read        ON public.clients FOR SELECT TO authenticated
  USING (id = public.current_client_id());
CREATE POLICY clients_supplier_read   ON public.clients FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_supplier_assignments psa
    JOIN public.projects p ON p.id = psa.project_id
    WHERE psa.supplier_id = public.current_supplier_id()
      AND p.client_id = clients.id
  ));

-- 10) PROJECTS ------------------------------------------------------------
CREATE POLICY projects_admin_all      ON public.projects FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY projects_client_read    ON public.projects FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
CREATE POLICY projects_supplier_read  ON public.projects FOR SELECT TO authenticated
  USING (public.supplier_has_project(id));

-- 11) PROJECT_BRIEFS ------------------------------------------------------
CREATE POLICY briefs_admin_all        ON public.project_briefs FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY briefs_client_read      ON public.project_briefs FOR SELECT TO authenticated
  USING (public.client_owns_project(project_id));

-- 12) SCOPES --------------------------------------------------------------
CREATE POLICY scopes_admin_all        ON public.scopes FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY scopes_client_read      ON public.scopes FOR SELECT TO authenticated
  USING (public.client_owns_project(project_id));
CREATE POLICY scopes_supplier_read    ON public.scopes FOR SELECT TO authenticated
  USING (public.supplier_has_project(project_id));

-- 13) SCOPE_ITEMS ---------------------------------------------------------
CREATE POLICY scope_items_admin_all   ON public.scope_items FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY scope_items_client_read ON public.scope_items FOR SELECT TO authenticated
  USING (client_visible = true AND EXISTS (
    SELECT 1 FROM public.scopes s WHERE s.id = scope_items.scope_id
      AND public.client_owns_project(s.project_id)
  ));
CREATE POLICY scope_items_supplier_read ON public.scope_items FOR SELECT TO authenticated
  USING (supplier_visible = true AND EXISTS (
    SELECT 1 FROM public.scopes s WHERE s.id = scope_items.scope_id
      AND public.supplier_has_project(s.project_id)
  ));

-- 14) PROJECT_PRICING / PHASE_PRICING (admin-only base tables) -----------
CREATE POLICY pricing_admin_all       ON public.project_pricing FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY phase_pricing_admin_all ON public.phase_pricing   FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());

-- 15) APPROVALS -----------------------------------------------------------
CREATE POLICY approvals_admin_all     ON public.approvals FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY approvals_client_read   ON public.approvals FOR SELECT TO authenticated
  USING (public.client_owns_project(project_id));
CREATE POLICY approvals_client_write  ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (public.client_owns_project(project_id) AND approver_role = 'client');
CREATE POLICY approvals_client_update ON public.approvals FOR UPDATE TO authenticated
  USING (public.client_owns_project(project_id) AND approver_role = 'client')
  WITH CHECK (public.client_owns_project(project_id) AND approver_role = 'client');

-- 16) CHANGE_REQUESTS -----------------------------------------------------
CREATE POLICY cr_admin_all            ON public.change_requests FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY cr_client_read          ON public.change_requests FOR SELECT TO authenticated
  USING (public.client_owns_project(project_id));
CREATE POLICY cr_client_insert        ON public.change_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.client_owns_project(project_id)
    AND requested_by_client_id = public.current_client_id()
    AND agency_price IS NULL
    AND supplier_cost IS NULL
    AND status IN ('requested','pending','draft','open','new')
  );

-- 17) SUPPLIER_TIME_ENTRIES ----------------------------------------------
CREATE POLICY ste_admin_all           ON public.supplier_time_entries FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY ste_supplier_read       ON public.supplier_time_entries FOR SELECT TO authenticated
  USING (supplier_id = public.current_supplier_id());
CREATE POLICY ste_supplier_insert     ON public.supplier_time_entries FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = public.current_supplier_id()
    AND public.supplier_has_project(project_id)
    AND status <> 'approved'
    AND approved_by IS NULL
  );
CREATE POLICY ste_supplier_update     ON public.supplier_time_entries FOR UPDATE TO authenticated
  USING (supplier_id = public.current_supplier_id() AND status <> 'approved')
  WITH CHECK (
    supplier_id = public.current_supplier_id()
    AND status <> 'approved'
    AND approved_by IS NULL
  );

-- 18) PAYMENTS (client-side) ---------------------------------------------
CREATE POLICY payments_admin_all      ON public.payments FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY payments_client_read    ON public.payments FOR SELECT TO authenticated
  USING (public.client_owns_project(project_id));

-- 19) SUPPLIER_PAYMENTS --------------------------------------------------
CREATE POLICY sp_admin_all            ON public.supplier_payments FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY sp_supplier_read        ON public.supplier_payments FOR SELECT TO authenticated
  USING (supplier_id = public.current_supplier_id());

-- 20) PAID_HOURS ---------------------------------------------------------
CREATE POLICY ph_admin_all            ON public.paid_hours FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY ph_client_read          ON public.paid_hours FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

-- 21) PROJECT_MESSAGES ---------------------------------------------------
CREATE POLICY pm_admin_all            ON public.project_messages FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY pm_client_read          ON public.project_messages FOR SELECT TO authenticated
  USING (public.client_owns_project(project_id)
    AND (visibility ILIKE '%client%' OR visibility = 'all' OR visibility = 'public'));
CREATE POLICY pm_client_insert        ON public.project_messages FOR INSERT TO authenticated
  WITH CHECK (public.client_owns_project(project_id)
    AND author_role = 'client'
    AND (visibility ILIKE '%client%' OR visibility = 'all' OR visibility = 'public'));
CREATE POLICY pm_supplier_read        ON public.project_messages FOR SELECT TO authenticated
  USING (public.supplier_has_project(project_id)
    AND (visibility ILIKE '%supplier%' OR visibility = 'all' OR visibility = 'public'));
CREATE POLICY pm_supplier_insert      ON public.project_messages FOR INSERT TO authenticated
  WITH CHECK (public.supplier_has_project(project_id)
    AND author_role = 'supplier'
    AND (visibility ILIKE '%supplier%' OR visibility = 'all' OR visibility = 'public'));

-- 22) DECISION_LOGS (admin only) -----------------------------------------
CREATE POLICY dl_admin_all            ON public.decision_logs FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());

-- 23) FILES --------------------------------------------------------------
CREATE POLICY files_admin_all         ON public.files FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY files_client_read       ON public.files FOR SELECT TO authenticated
  USING (public.client_owns_project(project_id)
    AND (visibility ILIKE '%client%' OR visibility = 'all' OR visibility = 'public'));
CREATE POLICY files_supplier_read     ON public.files FOR SELECT TO authenticated
  USING (public.supplier_has_project(project_id)
    AND (visibility ILIKE '%supplier%' OR visibility = 'all' OR visibility = 'public'));

-- 24) SUPPLIERS ----------------------------------------------------------
CREATE POLICY suppliers_admin_all     ON public.suppliers FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY suppliers_self_read     ON public.suppliers FOR SELECT TO authenticated
  USING (id = public.current_supplier_id());

-- 25) SUPPLIER_PROFILES --------------------------------------------------
CREATE POLICY spr_admin_all           ON public.supplier_profiles FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY spr_self_read           ON public.supplier_profiles FOR SELECT TO authenticated
  USING (supplier_id = public.current_supplier_id());
CREATE POLICY spr_self_update         ON public.supplier_profiles FOR UPDATE TO authenticated
  USING (supplier_id = public.current_supplier_id())
  WITH CHECK (supplier_id = public.current_supplier_id());

-- 26) SUPPLIER_SKILL_SUGGESTIONS (admin only) ---------------------------
CREATE POLICY sks_admin_all           ON public.supplier_skill_suggestions FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());

-- 27) ACTIVITY_LOGS (admin only) ----------------------------------------
CREATE POLICY al_admin_all            ON public.activity_logs FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());

-- 28) PROJECT_SUPPLIER_ASSIGNMENTS --------------------------------------
CREATE POLICY psa_admin_all           ON public.project_supplier_assignments FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY psa_supplier_read       ON public.project_supplier_assignments FOR SELECT TO authenticated
  USING (supplier_id = public.current_supplier_id());

-- 29) AI_SESSIONS (admin only) ------------------------------------------
CREATE POLICY ai_admin_all            ON public.ai_sessions FOR ALL TO authenticated
  USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());

-- 30) VIEWS FOR CLIENT-SAFE PRICING ------------------------------------
CREATE OR REPLACE VIEW public.client_project_pricing_view AS
SELECT pp.id, pp.project_id, pp.currency, pp.client_price,
       pp.created_at, pp.updated_at
  FROM public.project_pricing pp
  JOIN public.projects p ON p.id = pp.project_id
 WHERE public.is_agency_admin()
    OR p.client_id = public.current_client_id();

CREATE OR REPLACE VIEW public.client_phase_pricing_view AS
SELECT ph.id, ph.pricing_id, ph.phase_name, ph.client_price,
       ph.created_at, ph.updated_at
  FROM public.phase_pricing ph
  JOIN public.project_pricing pp ON pp.id = ph.pricing_id
  JOIN public.projects p ON p.id = pp.project_id
 WHERE public.is_agency_admin()
    OR p.client_id = public.current_client_id();

REVOKE ALL ON public.client_project_pricing_view FROM PUBLIC, anon;
REVOKE ALL ON public.client_phase_pricing_view   FROM PUBLIC, anon;
GRANT  SELECT ON public.client_project_pricing_view TO authenticated, service_role;
GRANT  SELECT ON public.client_phase_pricing_view   TO authenticated, service_role;
