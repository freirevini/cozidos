-- Adicionar campos de atraso e falta na tabela player_attendance
-- Esses campos já existem como enum no attendance_status

-- Verificar se a tabela de punições já tem todos os campos necessários
-- (ela já existe)

-- Não precisamos de alterações no banco para atrasos e faltas pois 
-- já existe o campo status na player_attendance que pode ser 'atrasado' ou 'falta'

-- Adicionar um campo opcional para o tempo de início da partida
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS match_timer_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS match_timer_paused_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS match_timer_total_paused_seconds INTEGER DEFAULT 0;