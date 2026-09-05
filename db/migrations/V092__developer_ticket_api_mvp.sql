-- Developer API MVP: environment-scoped applications, hashed API keys,
-- idempotent external ticket issuance and an auditable credential registry.

BEGIN;

CREATE TABLE IF NOT EXISTS public.developer_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_slug text NOT NULL,
  name text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('test', 'live')),
  event_ids text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_slug, name, environment)
);

CREATE TABLE IF NOT EXISTS public.developer_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.developer_apps(id) ON DELETE CASCADE,
  key_prefix text NOT NULL,
  secret_hash text NOT NULL UNIQUE CHECK (secret_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS developer_api_keys_app_idx ON public.developer_api_keys(app_id);

CREATE TABLE IF NOT EXISTS public.developer_tickets (
  id text PRIMARY KEY DEFAULT ('tkt_' || replace(gen_random_uuid()::text, '-', '')),
  app_id uuid NOT NULL REFERENCES public.developer_apps(id),
  event_id text NOT NULL REFERENCES public.events(id),
  external_reference text NOT NULL,
  ticket_type_id text NOT NULL,
  attendee jsonb NOT NULL,
  payment jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'checked_in', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (app_id, event_id, external_reference)
);
CREATE INDEX IF NOT EXISTS developer_tickets_event_created_idx
  ON public.developer_tickets(event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.developer_api_idempotency (
  api_key_id uuid NOT NULL REFERENCES public.developer_api_keys(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  PRIMARY KEY (api_key_id, idempotency_key)
);

ALTER TABLE public.developer_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_api_idempotency ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.issue_developer_ticket(
  p_secret_hash text,
  p_environment text,
  p_event_id text,
  p_idempotency_key text,
  p_request_hash text,
  p_external_reference text,
  p_ticket_type_id text,
  p_attendee jsonb,
  p_payment jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key public.developer_api_keys%ROWTYPE;
  v_app public.developer_apps%ROWTYPE;
  v_previous public.developer_api_idempotency%ROWTYPE;
  v_ticket public.developer_tickets%ROWTYPE;
  v_response jsonb;
BEGIN
  IF p_environment NOT IN ('test', 'live') OR length(p_idempotency_key) NOT BETWEEN 8 AND 255 THEN
    RAISE EXCEPTION 'Invalid environment or idempotency key' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_key FROM public.developer_api_keys
    WHERE secret_hash = p_secret_hash AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid API key' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO STRICT v_app FROM public.developer_apps WHERE id = v_key.app_id;
  IF v_app.status <> 'active' OR v_app.environment <> p_environment
     OR NOT (p_event_id = ANY(v_app.event_ids))
     OR NOT ('tickets:write' = ANY(v_key.scopes)) THEN
    RAISE EXCEPTION 'API key is not authorized for this event' USING ERRCODE = '42501';
  END IF;

  -- Serialize only retries for this key, not all traffic belonging to the app.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_key.id::text || ':' || p_idempotency_key, 0));

  SELECT * INTO v_previous FROM public.developer_api_idempotency
    WHERE api_key_id = v_key.id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_previous.request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'Idempotency key reused with a different request' USING ERRCODE = '23505';
    END IF;
    RETURN v_previous.response_body || jsonb_build_object('idempotentReplay', true);
  END IF;

  INSERT INTO public.developer_tickets (
    app_id, event_id, external_reference, ticket_type_id, attendee, payment, metadata
  ) VALUES (
    v_app.id, p_event_id, p_external_reference, p_ticket_type_id,
    p_attendee, p_payment, COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING * INTO v_ticket;

  v_response := jsonb_build_object(
    'id', v_ticket.id,
    'eventId', v_ticket.event_id,
    'externalReference', v_ticket.external_reference,
    'ticketTypeId', v_ticket.ticket_type_id,
    'status', v_ticket.status,
    'attendee', v_ticket.attendee,
    'createdAt', v_ticket.created_at,
    'idempotentReplay', false
  );
  INSERT INTO public.developer_api_idempotency
    (api_key_id, idempotency_key, request_hash, response_body)
    VALUES (v_key.id, p_idempotency_key, p_request_hash, v_response);
  UPDATE public.developer_api_keys SET last_used_at = now() WHERE id = v_key.id;
  RETURN v_response;
END;
$$;

REVOKE ALL ON TABLE public.developer_apps, public.developer_api_keys,
  public.developer_tickets, public.developer_api_idempotency FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_developer_ticket(
  text, text, text, text, text, text, text, jsonb, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_developer_ticket(
  text, text, text, text, text, text, text, jsonb, jsonb, jsonb
) TO service_role;

COMMIT;
