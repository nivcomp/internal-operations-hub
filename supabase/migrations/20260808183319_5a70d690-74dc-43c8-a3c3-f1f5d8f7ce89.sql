ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.project_messages REPLICA IDENTITY FULL;
ALTER TABLE public.approvals REPLICA IDENTITY FULL;
ALTER TABLE public.prototype_approvals REPLICA IDENTITY FULL;
ALTER TABLE public.project_questions REPLICA IDENTITY FULL;
ALTER TABLE public.proposal_signatures REPLICA IDENTITY FULL;
ALTER TABLE public.change_requests REPLICA IDENTITY FULL;
ALTER TABLE public.projects REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['chat_messages','project_messages','approvals','prototype_approvals','project_questions','proposal_signatures','change_requests','projects']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;