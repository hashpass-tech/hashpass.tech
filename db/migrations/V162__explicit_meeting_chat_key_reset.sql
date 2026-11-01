-- Allow an account owner to explicitly reset a lost meeting-chat key after
-- acknowledging that old ciphertext cannot be recovered. Normal key publish
-- remains idempotent-only; this dedicated RPC is called through the
-- authenticated app API and locks the current key to prevent concurrent
-- resets from silently replacing one another.
CREATE OR REPLACE FUNCTION public.reset_user_chat_public_key(
  p_user_id uuid,
  p_expected_public_key text,
  p_public_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_public_key text;
  v_has_backup_columns boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  IF coalesce(p_expected_public_key, '') !~ '^[0-9a-fA-F]{64}$'
     OR coalesce(p_public_key, '') !~ '^[0-9a-fA-F]{64}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_public_key');
  END IF;

  SELECT public_key
  INTO v_current_public_key
  FROM public.user_chat_keys
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'key_not_found');
  END IF;

  -- Make retries safe if the server committed the reset but the client lost
  -- the response. A second, different reset must still match the current key.
  IF v_current_public_key = p_public_key THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  IF v_current_public_key <> p_expected_public_key THEN
    RETURN jsonb_build_object('success', false, 'error', 'key_changed');
  END IF;

  SELECT count(*) = 3
  INTO v_has_backup_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_chat_keys'
    AND column_name IN (
      'encrypted_private_key_backup',
      'backup_salt',
      'backup_created_at'
    );

  IF v_has_backup_columns THEN
    EXECUTE $query$
      UPDATE public.user_chat_keys
      SET public_key = $1,
          updated_at = now(),
          encrypted_private_key_backup = NULL,
          backup_salt = NULL,
          backup_created_at = NULL
      WHERE user_id = $2
    $query$
    USING p_public_key, p_user_id;
  ELSE
    UPDATE public.user_chat_keys
    SET public_key = p_public_key,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_user_chat_public_key(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_user_chat_public_key(uuid, text, text)
  TO service_role;
