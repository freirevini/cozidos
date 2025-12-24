-- SOLUÇÃO DEFINITIVA: Ajustar constraint e criar perfil

-- 1. Remover constraint única de user_id (permite múltiplas roles por usuário)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;

-- 2. Criar constraint composta correta (user_id + role única)
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_unique UNIQUE (user_id, role);

-- 3. INSERT removido para evitar erro de FK em ambientes novos
-- O usuário admin deve ser criado manualmente após o db push
-- INSERT INTO public.profiles (...) removido - causava FK constraint error
