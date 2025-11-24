-- SOLUÇÃO DEFINITIVA: Ajustar constraint e criar perfil

-- 1. Remover constraint única de user_id (permite múltiplas roles por usuário)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;

-- 2. Criar constraint composta correta (user_id + role única)
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_unique UNIQUE (user_id, role);

-- 3. Agora inserir o perfil faltante (o trigger funcionará corretamente)
INSERT INTO public.profiles (id, user_id, email, name, is_player, status)
VALUES (
  '2c193f61-be8f-4246-bc7e-8cc69e4a1f6f'::uuid,
  '2c193f61-be8f-4246-bc7e-8cc69e4a1f6f'::uuid,
  'vinicius.freiresilva@hotmail.com',
  'Vinicius',
  false,
  'aprovado'::public.player_status
)
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  email = EXCLUDED.email,
  name = EXCLUDED.name;

-- 4. Log de confirmação
DO $$
BEGIN
  RAISE NOTICE 'Perfil criado/atualizado para user_id: 2c193f61-be8f-4246-bc7e-8cc69e4a1f6f';
END $$;