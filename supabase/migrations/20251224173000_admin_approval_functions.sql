-- Admin Approval Functions for Gradual Permission System
-- Migration: 20251224_admin_approval_functions.sql

-- ============================================================
-- 1. admin_approve_new_player: Approve pending user as NEW player
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_approve_new_player(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  -- Verify caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas admins podem aprovar jogadores');
  END IF;

  -- Find the pending profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id AND status = 'pendente'::public.player_status;

  IF v_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil pendente não encontrado para este usuário');
  END IF;

  -- Update status to approved
  UPDATE public.profiles
  SET 
    status = 'aprovado'::public.player_status,
    is_approved = true,
    is_player = true
  WHERE id = v_profile.id;

  -- Log action
  INSERT INTO public.audit_log (action, actor_id, target_profile_id, metadata)
  VALUES (
    'admin_approve_new_player',
    auth.uid(),
    v_profile.id,
    jsonb_build_object('user_id', p_user_id, 'nickname', v_profile.nickname)
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Jogador aprovado com sucesso',
    'profile_id', v_profile.id
  );
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.admin_approve_new_player(uuid) TO authenticated;

-- ============================================================
-- 2. admin_link_existing_player: Link pending user to orphan profile
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_link_existing_player(p_user_id uuid, p_orphan_profile_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pending_profile RECORD;
  v_orphan_profile RECORD;
BEGIN
  -- Verify caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas admins podem vincular jogadores');
  END IF;

  -- Find the pending profile (the one created at signup)
  SELECT * INTO v_pending_profile
  FROM public.profiles
  WHERE user_id = p_user_id AND status = 'pendente'::public.player_status;

  IF v_pending_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil pendente não encontrado para este usuário');
  END IF;

  -- Find the orphan profile (must have no user_id)
  SELECT * INTO v_orphan_profile
  FROM public.profiles
  WHERE id = p_orphan_profile_id AND user_id IS NULL;

  IF v_orphan_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil órfão não encontrado ou já vinculado');
  END IF;

  -- Transfer user_id to orphan profile and approve it
  UPDATE public.profiles
  SET 
    user_id = p_user_id,
    status = 'aprovado'::public.player_status,
    is_approved = true,
    is_player = true
  WHERE id = p_orphan_profile_id;

  -- Delete the pending temp profile (cleanup)
  DELETE FROM public.profiles WHERE id = v_pending_profile.id;

  -- Log action
  INSERT INTO public.audit_log (action, actor_id, target_profile_id, metadata)
  VALUES (
    'admin_link_existing_player',
    auth.uid(),
    p_orphan_profile_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'orphan_nickname', v_orphan_profile.nickname,
      'deleted_temp_profile_id', v_pending_profile.id
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário vinculado ao jogador existente com sucesso',
    'linked_profile_id', p_orphan_profile_id,
    'inherited_nickname', v_orphan_profile.nickname
  );
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.admin_link_existing_player(uuid, uuid) TO authenticated;

-- ============================================================
-- 3. admin_reject_user: Reject pending user (delete completely)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_reject_user(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  -- Verify caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas admins podem recusar usuários');
  END IF;

  -- Find the pending profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF v_profile IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil não encontrado para este usuário');
  END IF;

  -- Log before deletion
  INSERT INTO public.audit_log (action, actor_id, target_profile_id, metadata)
  VALUES (
    'admin_reject_user',
    auth.uid(),
    v_profile.id,
    jsonb_build_object('user_id', p_user_id, 'nickname', v_profile.nickname, 'email', v_profile.email)
  );

  -- Delete profile (CASCADE will clean up related data)
  DELETE FROM public.profiles WHERE id = v_profile.id;

  -- Note: The auth.users deletion must be done via Edge Function (delete-auth-user)
  -- This function only removes the profile data

  RETURN json_build_object(
    'success', true,
    'message', 'Usuário rejeitado e perfil removido',
    'user_id', p_user_id,
    'requires_auth_deletion', true
  );
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.admin_reject_user(uuid) TO authenticated;

-- ============================================================
-- 4. Helper: Get orphan profiles (for admin UI dropdown)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_orphan_profiles()
RETURNS TABLE (
  id uuid,
  nickname text,
  name text,
  email text,
  level text,
  "position" text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.nickname, p.name, p.email, p.level, p.position
  FROM public.profiles p
  WHERE p.user_id IS NULL 
    AND p.is_player = true
  ORDER BY p.nickname;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.get_orphan_profiles() TO authenticated;
