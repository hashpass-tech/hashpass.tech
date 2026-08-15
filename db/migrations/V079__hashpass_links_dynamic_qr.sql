-- HashPass Links: centralized dynamic QR, privacy-conscious analytics, audit, and QR auth.
CREATE TYPE qr_link_status AS ENUM ('active', 'paused', 'expired', 'archived');
CREATE TYPE qr_auth_status AS ENUM ('pending', 'approved', 'denied', 'expired', 'consumed', 'cancelled');

CREATE TABLE qr_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid,
  public_slug text NOT NULL UNIQUE CHECK (public_slug ~ '^[A-Za-z0-9_-]{8,32}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text CHECK (char_length(description) <= 1000),
  destination_url text NOT NULL,
  campaign_source text, campaign_medium text, campaign_name text, campaign_term text, campaign_content text,
  visual_config jsonb NOT NULL DEFAULT '{"foreground":"#071426","background":"#ffffff","modules":"square","finderEye":"rounded","logo":false,"errorCorrection":"Q","margin":4,"logoSize":18}',
  status qr_link_status NOT NULL DEFAULT 'active',
  expires_at timestamptz, archived_at timestamptz, deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qr_links_owner_updated_idx ON qr_links(owner_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE qr_scan_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  qr_link_id uuid NOT NULL REFERENCES qr_links(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(), visitor_hash text NOT NULL,
  country text, city text, device_type text NOT NULL DEFAULT 'unknown', os text, browser text,
  referrer text, bot_classification text NOT NULL DEFAULT 'unknown', campaign jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX qr_scans_link_time_idx ON qr_scan_events(qr_link_id, scanned_at DESC);

CREATE TABLE qr_link_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, qr_link_id uuid NOT NULL REFERENCES qr_links(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, event_type text NOT NULL,
  before_summary jsonb, after_summary jsonb, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE qr_auth_challenges (
  id text PRIMARY KEY CHECK (char_length(id) >= 32), browser_binding_hash text NOT NULL, state_hash text NOT NULL,
  code_challenge text NOT NULL, status qr_auth_status NOT NULL DEFAULT 'pending', expires_at timestamptz NOT NULL,
  approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, authorization_code_hash text, authorization_code_secret text,
  consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), CHECK (expires_at <= created_at + interval '5 minutes')
);
CREATE INDEX qr_auth_expiry_idx ON qr_auth_challenges(expires_at) WHERE status = 'pending';
CREATE TABLE qr_auth_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, challenge_id text NOT NULL REFERENCES qr_auth_challenges(id) ON DELETE CASCADE,
  type text NOT NULL, actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE qr_links ENABLE ROW LEVEL SECURITY; ALTER TABLE qr_scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_link_audit_events ENABLE ROW LEVEL SECURITY; ALTER TABLE qr_auth_challenges ENABLE ROW LEVEL SECURITY; ALTER TABLE qr_auth_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY qr_links_owner_all ON qr_links FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY qr_scans_owner_read ON qr_scan_events FOR SELECT USING (EXISTS (SELECT 1 FROM qr_links q WHERE q.id = qr_link_id AND q.owner_id = auth.uid()));
CREATE POLICY qr_audit_owner_read ON qr_link_audit_events FOR SELECT USING (EXISTS (SELECT 1 FROM qr_links q WHERE q.id = qr_link_id AND q.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION touch_qr_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER qr_link_updated BEFORE UPDATE ON qr_links FOR EACH ROW EXECUTE FUNCTION touch_qr_link();

-- Aggregate in PostgreSQL so high-volume links are never silently capped by an
-- application-side row limit. The service role supplies the authenticated owner.
CREATE OR REPLACE FUNCTION qr_link_analytics(p_qr_link_id uuid, p_owner_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH authorized AS (
    SELECT id FROM qr_links WHERE id = p_qr_link_id AND owner_id = p_owner_id AND deleted_at IS NULL
  ), events AS (
    SELECT e.* FROM qr_scan_events e JOIN authorized a ON a.id = e.qr_link_id
  ), totals AS (
    SELECT count(*) total, count(DISTINCT visitor_hash) unique_total,
      count(*) FILTER (WHERE bot_classification = 'human') human_total,
      count(*) FILTER (WHERE bot_classification <> 'human') bot_total FROM events
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM authorized) THEN NULL ELSE jsonb_build_object(
    'totalScans', (SELECT total FROM totals),
    'uniqueScans', (SELECT unique_total FROM totals),
    'humanScans', (SELECT human_total FROM totals),
    'botScans', (SELECT bot_total FROM totals),
    'timeline', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', day, 'scans', scans) ORDER BY day)
      FROM (SELECT scanned_at::date day, count(*) scans FROM events GROUP BY 1) t), '[]'::jsonb),
    'devices', COALESCE((SELECT jsonb_object_agg(device_type, scans)
      FROM (SELECT device_type, count(*) scans FROM events GROUP BY 1) d), '{}'::jsonb),
    'locations', COALESCE((SELECT jsonb_agg(jsonb_build_object('country', country, 'city', city, 'scans', scans) ORDER BY scans DESC)
      FROM (SELECT country, city, count(*) scans FROM events WHERE country IS NOT NULL GROUP BY 1, 2) l), '[]'::jsonb),
    'campaigns', COALESCE((SELECT jsonb_agg(jsonb_build_object('campaign', campaign, 'scans', scans) ORDER BY scans DESC)
      FROM (SELECT campaign, count(*) scans FROM events WHERE campaign <> '{}'::jsonb GROUP BY 1) c), '[]'::jsonb),
    'recent', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY "scannedAt" DESC) FROM
      (SELECT scanned_at AS "scannedAt", device_type AS device,
        bot_classification <> 'human' AS bot, referrer, browser, os, campaign
       FROM events ORDER BY scanned_at DESC LIMIT 100) r), '[]'::jsonb)
  ) END;
$$;
REVOKE ALL ON FUNCTION qr_link_analytics(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qr_link_analytics(uuid, uuid) TO service_role;
