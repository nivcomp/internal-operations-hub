-- Scoped external API credentials, idempotency and immutable audit storage.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.api_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  key_prefix text NOT NULL UNIQUE,
  key_hash text NOT NULL UNIQUE CHECK (char_length(key_hash) = 64),
  scopes text[] NOT NULL DEFAULT ARRAY['schema.read','data.read']::text[],
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  CHECK (scopes <@ ARRAY['schema.read','data.read','data.write','data.delete','actions.execute','audit.read']::text[])
);

CREATE TABLE IF NOT EXISTS private.api_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_client_id uuid NOT NULL REFERENCES private.api_clients(id),
  request_id uuid NOT NULL,
  operation text NOT NULL,
  table_name text,
  record_id text,
  http_status integer NOT NULL,
  reason text NOT NULL DEFAULT '',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_audit_events_client_created_idx
  ON private.api_audit_events(api_client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_audit_events_request_idx
  ON private.api_audit_events(request_id);

CREATE TABLE IF NOT EXISTS private.api_idempotency (
  api_client_id uuid NOT NULL REFERENCES private.api_clients(id),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL CHECK (char_length(request_hash) = 64),
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  PRIMARY KEY (api_client_id, idempotency_key)
);

ALTER TABLE private.api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.api_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.api_idempotency ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.api_key_create(
  p_name text,
  p_key_prefix text,
  p_key_hash text,
  p_scopes text[],
  p_created_by uuid,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS TABLE (
  id uuid, name text, key_prefix text, scopes text[], created_at timestamptz,
  last_used_at timestamptz, expires_at timestamptz, revoked_at timestamptz
)
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO private.api_clients(name, key_prefix, key_hash, scopes, created_by, expires_at)
  VALUES (trim(p_name), p_key_prefix, p_key_hash, p_scopes, p_created_by, p_expires_at)
  RETURNING api_clients.id, api_clients.name, api_clients.key_prefix, api_clients.scopes,
    api_clients.created_at, api_clients.last_used_at, api_clients.expires_at, api_clients.revoked_at;
$$;

CREATE OR REPLACE FUNCTION public.api_key_list()
RETURNS TABLE (
  id uuid, name text, key_prefix text, scopes text[], created_at timestamptz,
  last_used_at timestamptz, expires_at timestamptz, revoked_at timestamptz
)
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, c.name, c.key_prefix, c.scopes, c.created_at,
    c.last_used_at, c.expires_at, c.revoked_at
  FROM private.api_clients c
  ORDER BY c.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.api_key_revoke(p_id uuid, p_revoked_by uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE private.api_clients
  SET revoked_at = COALESCE(revoked_at, now()), revoked_by = COALESCE(revoked_by, p_revoked_by)
  WHERE id = p_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_key_authenticate(p_key_hash text)
RETURNS TABLE (
  id uuid, name text, key_prefix text, scopes text[], created_at timestamptz,
  last_used_at timestamptz, expires_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE private.api_clients c
  SET last_used_at = CASE
    WHEN c.last_used_at IS NULL OR c.last_used_at < now() - interval '5 minutes' THEN now()
    ELSE c.last_used_at
  END
  WHERE c.key_hash = p_key_hash
    AND c.revoked_at IS NULL
    AND (c.expires_at IS NULL OR c.expires_at > now())
  RETURNING c.id, c.name, c.key_prefix, c.scopes, c.created_at, c.last_used_at, c.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_audit_append(
  p_api_client_id uuid,
  p_request_id uuid,
  p_operation text,
  p_http_status integer,
  p_table_name text DEFAULT NULL,
  p_record_id text DEFAULT NULL,
  p_reason text DEFAULT '',
  p_detail jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO private.api_audit_events(
    api_client_id, request_id, operation, table_name, record_id, http_status, reason, detail
  ) VALUES (
    p_api_client_id, p_request_id, p_operation, p_table_name, p_record_id,
    p_http_status, left(COALESCE(p_reason, ''), 1000), COALESCE(p_detail, '{}'::jsonb)
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_audit_list(
  p_api_client_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  id uuid, request_id uuid, operation text, table_name text, record_id text,
  http_status integer, reason text, detail jsonb, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT e.id, e.request_id, e.operation, e.table_name, e.record_id,
    e.http_status, e.reason, e.detail, e.created_at
  FROM private.api_audit_events e
  WHERE e.api_client_id = p_api_client_id
  ORDER BY e.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200)
  OFFSET GREATEST(p_offset, 0);
$$;

CREATE OR REPLACE FUNCTION public.api_idempotency_get(
  p_api_client_id uuid,
  p_idempotency_key text
) RETURNS TABLE (request_hash text, response_status integer, response_body jsonb)
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT i.request_hash, i.response_status, i.response_body
  FROM private.api_idempotency i
  WHERE i.api_client_id = p_api_client_id
    AND i.idempotency_key = p_idempotency_key
    AND i.expires_at > now();
$$;

CREATE OR REPLACE FUNCTION public.api_idempotency_save(
  p_api_client_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_response_status integer,
  p_response_body jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO private.api_idempotency(
    api_client_id, idempotency_key, request_hash, response_status, response_body
  ) VALUES (
    p_api_client_id, left(p_idempotency_key, 200), p_request_hash, p_response_status, p_response_body
  ) ON CONFLICT (api_client_id, idempotency_key) DO NOTHING;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON TABLE private.api_clients, private.api_audit_events, private.api_idempotency FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_key_create(text,text,text,text[],uuid,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_key_list() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_key_revoke(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_key_authenticate(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_audit_append(uuid,uuid,text,integer,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_audit_list(uuid,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_idempotency_get(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_idempotency_save(uuid,text,text,integer,jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.api_key_create(text,text,text,text[],uuid,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_key_list() TO service_role;
GRANT EXECUTE ON FUNCTION public.api_key_revoke(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_key_authenticate(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_audit_append(uuid,uuid,text,integer,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_audit_list(uuid,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_idempotency_get(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_idempotency_save(uuid,text,text,integer,jsonb) TO service_role;