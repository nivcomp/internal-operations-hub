CREATE OR REPLACE FUNCTION public.protect_approved_prototype_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.prototype_approvals a WHERE a.prototype_version_id = OLD.id AND a.decision = 'approved') THEN
    RAISE EXCEPTION 'Approved prototype versions are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;