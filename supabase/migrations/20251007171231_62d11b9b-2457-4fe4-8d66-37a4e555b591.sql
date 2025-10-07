-- Adicionar campo player_type_detail na tabela profiles
-- Criar enum para tipo de jogador (mensal ou avulso)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'player_type_enum') THEN
    CREATE TYPE player_type_enum AS ENUM ('mensal', 'avulso');
  END IF;
END $$;

-- Adicionar coluna player_type_detail se não existir
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS player_type_detail player_type_enum;