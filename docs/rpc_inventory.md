# Inventário de RPCs (Funções SQL) - Cozidos

> Gerado em: 2026-01-23

---

## Resumo

| Total de Funções | Migrações Analisadas | Ausências Críticas |
|------------------|---------------------|-------------------|
| 58 | 50+ arquivos | 0 ✅ |

---

## ✅ Funções Corrigidas

| Função | Status | Arquivo de Migração |
|--------|--------|---------------------|
| `get_match_timeline_events` | ✅ **CORRIGIDO** | [20260123_get_match_timeline_events.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260123_get_match_timeline_events.sql) |

---

## Funções Propostas (A Criar)

| Função | Status | Observação |
|--------|--------|------------|
| `get_classification` | 📋 Proposta | Plano de centralização - Fase 2 |

---

## Funções Relacionadas a Eventos de Partida

| Função | Arquivo de Migração | Descrição |
|--------|---------------------|-----------|
| `get_match_player_events` | [20251210234921_...](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251210234921_2594661a-19d5-4632-aa4d-1fa1e40cd55a.sql) | Retorna contagem de gols, cartões e info de substituição por jogador em uma partida. Usada nos badges do campo. |
| `record_goal_with_assist` | [20260112_fix_preto_team_color.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260112_fix_preto_team_color.sql) | Registra gol com assistência opcional em uma transação |
| `record_substitution` | [20260112_fix_preto_team_color.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260112_fix_preto_team_color.sql) | Registra substituição de jogador |
| `delete_goal_and_recalc` | [20260112_data_integrity.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260112_data_integrity.sql) | Remove gol e recalcula placar da partida |
| `recalc_match_score` | [20260112_data_integrity.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260112_data_integrity.sql) | Recalcula placar de uma partida baseado em gols |
| `sync_match_score_trigger` | [20260112_data_integrity.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260112_data_integrity.sql) | Trigger que sincroniza placar ao inserir/remover gols |
| `close_match` | Migração anterior | Finaliza uma partida |
| `close_all_matches_by_round` | Migração anterior | Finaliza todas as partidas de uma rodada |

---

## Funções de Ranking/Classificação

| Função | Arquivo de Migração | Descrição |
|--------|---------------------|-----------|
| `recalc_all_player_rankings` | [20260115_update_ranking_rules_v2.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260115_update_ranking_rules_v2.sql) | Recalcula rankings de TODOS os jogadores agregando de `player_round_stats` |
| `recalc_round_aggregates` | [20260119_fix_goal_balance_points.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260119_fix_goal_balance_points.sql) | Recalcula estatísticas de uma rodada específica em `player_round_stats` |
| `auto_recalc_on_round_finalize` | [20251231_auto_recalc_on_round_finalize.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251231_auto_recalc_on_round_finalize.sql) | Trigger que dispara recálculo quando rodada é finalizada |
| `recalc_2026_rounds` | [20260110_new_ranking_rules_2026.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260110_new_ranking_rules_2026.sql) | Recalcula todas as rodadas de 2026 |
| `recalc_all_2026_rounds` | [20260116_ranking_rules_2026_v3.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260116_ranking_rules_2026_v3.sql) | Versão atualizada do recálculo de 2026 |
| `apply_ranking_adjustment` | Migração anterior | Aplica ajuste manual ao ranking de um jogador |
| `recalc_on_adjustment_change` | Migração anterior | Trigger para recalcular ao alterar ajustes |
| `get_player_adjustment` | [20260122_ranking_adjustments_season.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260122_ranking_adjustments_season.sql) | Retorna soma de ajustes por jogador, tipo e temporada |
| `import_classification_csv` | [20251225_fix_import_classification...](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251225_fix_import_classification_preserve_data.sql) | Importa classificação de CSV |
| `reset_player_rankings` | Migração anterior | Reseta tabela player_rankings |
| `reset_full_classification` | Migração anterior | Reset completo de classificação |

---

## Funções de Administração de Jogadores

| Função | Arquivo de Migração | Descrição |
|--------|---------------------|-----------|
| `admin_approve_new_player` | [20251224173000_admin_approval_functions.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251224173000_admin_approval_functions.sql) | Aprova novo jogador pendente |
| `admin_link_existing_player` | [20251224173000_admin_approval_functions.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251224173000_admin_approval_functions.sql) | Vincula usuário a profile órfão existente |
| `admin_link_pending_to_profile` | [20251208105318_...](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251208105318_7452b7b7-741e-4102-87f4-4e7487f98ea9.sql) | Vincula usuário pendente a profile |
| `admin_reject_user` | [20251224173000_admin_approval_functions.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251224173000_admin_approval_functions.sql) | Rejeita cadastro de usuário |
| `admin_reset_round` | [20260111_fix_admin_reset_round.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260111_fix_admin_reset_round.sql) | Reseta uma rodada (remove dados de partidas/gols) |
| `merge_players` | [20251226_fix_merge_players_no_recalc.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251226_fix_merge_players_no_recalc.sql) | Mescla dois perfis de jogador (duplicatas) |
| `delete_player_complete` | [20260119_fix_delete_player.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260119_fix_delete_player.sql) | Remove jogador completamente (com dependências) |
| `delete_player_by_id` | Migração anterior | Remove jogador por ID |
| `delete_player_by_email` | Migração anterior | Remove jogador por email |
| `get_orphan_profiles` | [20251224173000_admin_approval_functions.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251224173000_admin_approval_functions.sql) | Lista profiles sem user_id vinculado |
| `import_players_csv` | [20251224113742_...](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251224113742_4330d03e-3d20-48db-8587-0da61de87e89.sql) | Importa jogadores de CSV |
| `reset_all_players` | [20251220045115_...](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251220045115_85763b32-7789-4af8-a005-071616ee098f.sql) | Reseta todos os jogadores |
| `reset_all_data` | Migração anterior | Reseta todos os dados do sistema |

---

## Funções de Autenticação e Perfil

| Função | Arquivo de Migração | Descrição |
|--------|---------------------|-----------|
| `handle_new_user` | [20251007164518_...](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251007164518_87800191-a592-4632-8376-064c1bcb9ca7.sql) | Trigger ao criar novo usuário auth |
| `handle_profile_created` | Migração anterior | Trigger ao criar profile |
| `assign_default_role_on_profile` | [20251008012605_...](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251008012605_5bcc6fb5-7de5-4434-b5d1-1afdac5730ec.sql) | Atribui role padrão ao profile |
| `generate_claim_token` | [20251208105318_...](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251208105318_7452b7b7-741e-4102-87f4-4e7487f98ea9.sql) | Gera token para claim de profile |
| `claim_profile_with_token` | [20251208105318_...](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251208105318_7452b7b7-741e-4102-87f4-4e7487f98ea9.sql) | Vincula usuário a profile via token |
| `link_player_to_user` | Migração anterior | Vincula jogador a usuário |
| `check_profile_sync_status` | Migração anterior | Verifica sincronização de profiles |
| `sync_missing_profiles` | Migração anterior | Cria profiles faltantes para usuários |
| `get_users_without_profiles` | Migração anterior | Lista usuários sem profile |
| `find_matching_profiles` | Migração anterior | Busca profiles que combinam com usuário |
| `is_admin` | Migração anterior | Verifica se usuário é admin |
| `has_role` | Migração anterior | Verifica se usuário tem role específica |

---

## Funções de Convidados (Guests)

| Função | Arquivo de Migração | Descrição |
|--------|---------------------|-----------|
| `create_guest_player` | [20260111_update_guest_player_pool.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260111_update_guest_player_pool.sql) | Cria jogador convidado temporário |
| `allocate_guest_to_team` | [20260111_update_guest_player_pool.sql](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20260111_update_guest_player_pool.sql) | Aloca convidado a um time na rodada |

---

## Funções Utilitárias

| Função | Arquivo de Migração | Descrição |
|--------|---------------------|-----------|
| `check_one_round_per_week` | [20251007185349_...](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251007185349_36f104f4-c9d6-481e-9a62-975bbc82ec14.sql) | Valida regra de uma rodada por semana |
| `auto_finalize_stale_rounds` | [20251222163412_...](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251222163412_f43ac750-dc32-4712-8d3f-b00251ca73a5.sql) | Finaliza automaticamente rodadas antigas |
| `calculate_age_years` | Migração anterior | Calcula idade em anos |
| `update_player_age` | Migração anterior | Atualiza idade do jogador |
| `set_player_birth_date` | Migração anterior | Define data de nascimento |
| `generate_player_id` | Migração anterior | Gera ID único para jogador |
| `generate_player_key` | Migração anterior | Gera chave de acesso para jogador |
| `set_player_key` | Migração anterior | Define chave de jogador |
| `update_player_id` | Migração anterior | Atualiza ID de jogador |
| `normalize_email` | Migração anterior | Normaliza formato de email |
| `update_updated_at_column` | [20251008012637_...](file:///c:/Users/vinic/Documents/CozidosGithub/supabase/migrations/20251008012637_4f3bdf70-5ac4-44af-b346-32a242395aab.sql) | Trigger para atualizar campo updated_at |
| `sync_is_approved_with_status` | Migração anterior | Sincroniza campo is_approved com status |
| `recalc_rankings_on_round_delete` | Migração anterior | Trigger para recalcular ao deletar rodada |

---

## Status

> [!NOTE]
> ✅ Todas as funções críticas agora possuem migrações locais versionadas.
