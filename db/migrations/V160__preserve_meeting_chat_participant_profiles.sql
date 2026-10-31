-- Preserve valid speaker/profile fields when a fallback lookup has no row.
-- SELECT INTO assigns NULLs on an empty result, which previously erased the
-- speaker image/name loaded by the first lookup and left chat with initials.
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

  IF auth.uid() IS NULL OR (
    auth.uid() IS DISTINCT FROM v_meeting.requester_id
    AND auth.uid() IS DISTINCT FROM v_meeting.host_id
    AND auth.uid() IS DISTINCT FROM v_meeting.attendee_id
    AND NOT EXISTS (
      SELECT 1 FROM public.bsl_speakers speaker
      WHERE speaker.id::text = v_meeting.speaker_id::text
        AND speaker.user_id = auth.uid()
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

GRANT EXECUTE ON FUNCTION public.get_meeting_chat_participant(uuid, uuid) TO authenticated;
