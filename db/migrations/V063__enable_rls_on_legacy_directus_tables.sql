-- Enable Row-Level Security on the legacy directus_* tables.
--
-- These 27 tables are leftovers from the archived Directus auth provider
-- (see archive/amplify and CLAUDE.md's "Directus no longer needed" note --
-- auth now runs on Supabase OTP/email + Better Auth for Google; Directus is
-- unreachable and out of scope). They were never dropped, and on the shared
-- dev project (gsugeqozyeokncpbndna) they still had RLS disabled, which
-- Supabase's security advisor flagged as both "table publicly accessible"
-- and "sensitive data publicly accessible" (directus_users.password,
-- .tfa_secret, .token were readable via the anon/authenticated PostgREST
-- API with zero restriction).
--
-- No policies are added: these tables are dead weight, not actively used by
-- any code path, so the correct behavior is to deny all API access rather
-- than author policies for a provider that's no longer live. Enabling RLS
-- with zero policies blocks anon/authenticated access via PostgREST while
-- leaving service_role (which bypasses RLS) unaffected.

ALTER TABLE public.directus_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directus_webhooks ENABLE ROW LEVEL SECURITY;

INSERT INTO hashpass_schema_migrations (id, file_path)
VALUES ('V063__enable_rls_on_legacy_directus_tables', 'db/migrations/V063__enable_rls_on_legacy_directus_tables.sql')
ON CONFLICT (id) DO NOTHING;
