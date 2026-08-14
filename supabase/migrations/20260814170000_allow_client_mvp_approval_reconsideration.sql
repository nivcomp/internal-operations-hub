-- Let a client reconsider an accidental MVP approval without deleting history.
-- Each new decision is append-only; the latest row is the current decision.

ALTER TABLE public.prototype_approvals
  DROP CONSTRAINT IF EXISTS prototype_approvals_prototype_version_id_approved_by_key;

CREATE INDEX IF NOT EXISTS prototype_approvals_current_decision_idx
  ON public.prototype_approvals(prototype_version_id, approved_by, created_at DESC, id DESC);

-- A client only needs their own decision history. Agency admins retain their
-- separate policy and can still review all client decisions for the project.
DROP POLICY IF EXISTS "client reads own prototype approvals" ON public.prototype_approvals;
CREATE POLICY "client reads own prototype approvals" ON public.prototype_approvals
FOR SELECT TO authenticated
USING (
  approved_by = auth.uid()
  AND private.client_owns_project(project_id)
);

COMMENT ON TABLE public.prototype_approvals IS
  'Append-only client MVP decisions. The newest decision per version and approver is current.';
