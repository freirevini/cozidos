-- Criar ENUM para status da rodada
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'round_status') THEN
    CREATE TYPE public.round_status AS ENUM ('a_iniciar', 'em_andamento', 'finalizada');
  END IF;
END $$;

-- Atualizar status existentes para valores válidos do novo ENUM
UPDATE public.rounds 
SET status = CASE 
  WHEN status = 'pending' THEN 'a_iniciar'
  WHEN status = 'in_progress' THEN 'em_andamento'
  WHEN status = 'completed' THEN 'finalizada'
  ELSE 'a_iniciar'
END
WHERE status NOT IN ('a_iniciar', 'em_andamento', 'finalizada');

-- Remover o default antes de alterar o tipo
ALTER TABLE public.rounds ALTER COLUMN status DROP DEFAULT;

-- Alterar a coluna status para usar o novo ENUM
ALTER TABLE public.rounds 
  ALTER COLUMN status TYPE public.round_status 
  USING (CASE 
    WHEN status IN ('pending', 'a_iniciar') THEN 'a_iniciar'::public.round_status
    WHEN status IN ('in_progress', 'em_andamento') THEN 'em_andamento'::public.round_status
    WHEN status IN ('completed', 'finalizada') THEN 'finalizada'::public.round_status
    ELSE 'a_iniciar'::public.round_status
  END);

-- Definir novo valor padrão
ALTER TABLE public.rounds 
  ALTER COLUMN status SET DEFAULT 'a_iniciar'::public.round_status;