-- Meeting chat is authenticated by the app API (Better Auth identity mapped
-- to auth.users), not by the browser's Supabase publishable key. The old
-- SECURITY DEFINER RPCs allowed auth.uid() IS NULL and were executable by
-- PUBLIC, so callers without a Supabase session could impersonate a meeting
-- participant by supplying their UUID. Restrict those RPCs to service_role;
-- the API resolves identity and validates meeting membership before calling.
REVOKE ALL PRIVILEGES ON TABLE public.meeting_chat_messages, public.chat_last_seen, public.user_chat_keys
  FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.meeting_chat_messages, public.chat_last_seen, public.user_chat_keys
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.send_meeting_chat_message(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_meeting_chat_messages(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_chat_last_seen(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_chat_last_seen(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_meeting_chat_participant(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_chat_public_key(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.publish_user_chat_public_key(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.store_chat_key_backup(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_chat_key_backup(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_chat_key_backup(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.send_meeting_chat_message(uuid, uuid, text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_meeting_chat_messages(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.update_chat_last_seen(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_chat_last_seen(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_meeting_chat_participant(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_chat_public_key(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_user_chat_public_key(uuid, text)
  TO service_role;

-- This profile lookup used to run from the browser with a Supabase session.
-- Chat now authenticates through the app API, so allow the API's service-role
-- client to use it after the route has checked both meeting participants.
CREATE OR REPLACE FUNCTION public.get_meeting_chat_participant(
  p_meeting_id uuid,
  p_other_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_name text;
  v_avatar_url text;
  v_profile_name text;
  v_profile_avatar_url text;
BEGIN
  SELECT * INTO v_meeting FROM public.meetings WHERE id = p_meeting_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'meeting_not_found');
  END IF;

  IF coalesce(auth.role(), '') <> 'service_role' AND (
    auth.uid() IS NULL OR (
      auth.uid() IS DISTINCT FROM v_meeting.requester_id
      AND auth.uid() IS DISTINCT FROM v_meeting.host_id
      AND auth.uid() IS DISTINCT FROM v_meeting.attendee_id
      AND NOT EXISTS (
        SELECT 1 FROM public.bsl_speakers speaker
        WHERE speaker.id::text = v_meeting.speaker_id::text
          AND speaker.user_id = auth.uid()
      )
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  IF p_other_user_id IS DISTINCT FROM v_meeting.requester_id
    AND p_other_user_id IS DISTINCT FROM v_meeting.host_id
    AND p_other_user_id IS DISTINCT FROM v_meeting.attendee_id
    AND NOT EXISTS (
      SELECT 1 FROM public.bsl_speakers speaker
      WHERE speaker.id::text = v_meeting.speaker_id::text
        AND speaker.user_id = p_other_user_id
    ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_participant');
  END IF;

  SELECT NULLIF(speaker.name, ''), NULLIF(speaker.imageurl, '')
  INTO v_name, v_avatar_url
  FROM public.bsl_speakers speaker
  WHERE speaker.user_id = p_other_user_id
  LIMIT 1;

  IF v_name IS NULL OR v_avatar_url IS NULL THEN
    SELECT
      COALESCE(NULLIF(profile.display_name, ''), NULLIF(profile.full_name, '')),
      NULLIF(profile.avatar_url, '')
    INTO v_profile_name, v_profile_avatar_url
    FROM public.user_profiles profile
    WHERE profile.user_id::text = p_other_user_id::text
    LIMIT 1;

    IF FOUND THEN
      v_name := COALESCE(v_name, v_profile_name);
      v_avatar_url := COALESCE(v_avatar_url, v_profile_avatar_url);
    END IF;
  END IF;

  IF v_name IS NULL OR v_avatar_url IS NULL THEN
    SELECT
      COALESCE(NULLIF(profile.full_name, ''), NULLIF(registry.full_name, '')),
      COALESCE(NULLIF(profile.avatar_url, ''), NULLIF(registry.avatar_url, ''))
    INTO v_profile_name, v_profile_avatar_url
    FROM public."user" registry
    LEFT JOIN public.profiles profile ON profile.id = registry.id
    WHERE registry.auth_user_id = p_other_user_id::text
       OR registry.provider_ids->>'supabase' = p_other_user_id::text
    LIMIT 1;

    IF FOUND THEN
      v_name := COALESCE(v_name, v_profile_name);
      v_avatar_url := COALESCE(v_avatar_url, v_profile_avatar_url);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'name', v_name,
    'avatar_url', v_avatar_url
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_meeting_chat_participant(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_meeting_chat_participant(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.store_chat_key_backup(uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_chat_key_backup(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_chat_key_backup(uuid)
  TO service_role;

-- Publishing an identical key is idempotent and must preserve its encrypted
-- backup. Replacing a registered key is a destructive rotation because all
-- existing conversation keys depend on it; require a separate recovery/reset
-- flow instead of letting a browser race or reinstall silently rotate it.
CREATE OR REPLACE FUNCTION public.publish_user_chat_public_key(
  p_user_id uuid,
  p_public_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  IF length(coalesce(p_public_key, '')) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_public_key');
  END IF;

  INSERT INTO public.user_chat_keys (user_id, public_key)
  VALUES (p_user_id, p_public_key)
  ON CONFLICT (user_id) DO UPDATE SET
    updated_at = now()
  WHERE public.user_chat_keys.public_key = EXCLUDED.public_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'key_already_registered');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.publish_user_chat_public_key(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_user_chat_public_key(uuid, text)
  TO service_role;
