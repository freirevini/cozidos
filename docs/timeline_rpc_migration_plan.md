# Plano de Transição Segura: Timeline RPC

## Contexto

### Situação Atual
O carregamento de eventos da timeline em `MatchDetails.tsx` (função `loadEvents`) realiza **4 queries separadas**:

1. `goals` - Com join de `assists`
2. `cards` - Com queries adicionais para determinar `team_color`
3. `substitutions`
4. Eventos sintéticos (match_start/match_end)

**Problemas atuais:**
- Múltiplas roundtrips ao banco (latência)
- Queries N+1 para cartões (busca team_color individualmente)
- Lógica de mapeamento duplicada no frontend

### Objetivo
Migrar para uma única RPC `get_match_timeline_events(p_match_id)` que retorne todos os eventos formatados, com:
- Zero breaking changes visuais
- Melhor performance
- Código mais limpo

---

## Contrato de Saída (TimelineEvent)

```typescript
interface TimelineEvent {
  id: string;
  type: "goal" | "assist" | "amarelo" | "azul" | "substitution" | "match_start" | "match_end";
  minute: number;
  team_color?: string;
  is_own_goal?: boolean;
  player?: { id?: string; name: string; nickname: string | null; avatar_url?: string | null; };
  assist?: { id?: string; name: string; nickname: string | null; avatar_url?: string | null; };
  playerOut?: { id?: string; name: string; nickname: string | null; avatar_url?: string | null; };
  playerIn?: { id?: string; name: string; nickname: string | null; avatar_url?: string | null; };
}
```

A RPC deve retornar exatamente este formato.

---

## Fases de Implementação

### Fase 0 — Preparação (Backend Only)

**Objetivo:** Criar RPC no banco sem uso no frontend.

**Tarefas:**
- [x] Criar função SQL `get_match_timeline_events(p_match_id UUID)`
- [x] Retornar JSON array com formato compatível
- [x] Validar manualmente via SQL Editor

**SQL Proposto (com complementos):**
```sql
CREATE OR REPLACE FUNCTION get_match_timeline_events(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
  v_match RECORD;
  v_end_minute INT;
BEGIN
  -- Get match info
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN v_result; END IF;

  -- Match start event
  IF v_match.started_at IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'id', 'start-' || p_match_id,
      'type', 'match_start',
      'minute', 0
    );
  END IF;

  -- Goals (with assists)
  v_result := v_result || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', g.id,
      'type', 'goal',
      'minute', g.minute,
      'team_color', g.team_color,
      'is_own_goal', COALESCE(g.is_own_goal, false),
      'player', CASE WHEN p.id IS NOT NULL THEN jsonb_build_object(
        'id', p.id, 'name', p.name, 'nickname', p.nickname, 'avatar_url', p.avatar_url
      ) ELSE NULL END,
      'assist', (
        SELECT jsonb_build_object(
          'id', ap.id, 'name', ap.name, 'nickname', ap.nickname, 'avatar_url', ap.avatar_url
        )
        FROM assists a
        JOIN profiles ap ON ap.id = a.player_id
        WHERE a.goal_id = g.id
        LIMIT 1
      )
    ))
    FROM goals g
    LEFT JOIN profiles p ON p.id = g.player_id
    WHERE g.match_id = p_match_id
  ), '[]'::JSONB);

  -- Cards (with team_color resolution including match_absence_substitutes)
  -- COMPLEMENTO 1: Added match_absence_substitutes as fallback
  -- COMPLEMENTO 3: Explicit card_type normalization
  v_result := v_result || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id,
      'type', CASE 
        WHEN c.card_type = 'amarelo' THEN 'amarelo'
        WHEN c.card_type = 'azul' THEN 'azul'
        ELSE c.card_type::TEXT
      END,
      'minute', c.minute,
      'team_color', COALESCE(
        -- 1. Check if entered via substitution
        (SELECT team_color FROM substitutions WHERE player_in_id = c.player_id AND match_id = p_match_id LIMIT 1),
        -- 2. Check original roster
        (SELECT team_color FROM round_team_players WHERE player_id = c.player_id AND round_id = v_match.round_id LIMIT 1),
        -- 3. Check absence substitutes (COMPLEMENTO 1)
        (SELECT team_color FROM match_absence_substitutes WHERE substitute_player_id = c.player_id AND match_id = p_match_id LIMIT 1)
      ),
      'player', CASE WHEN p.id IS NOT NULL THEN jsonb_build_object(
        'id', p.id, 'name', p.name, 'nickname', p.nickname, 'avatar_url', p.avatar_url
      ) ELSE NULL END
    ))
    FROM cards c
    LEFT JOIN profiles p ON p.id = c.player_id
    WHERE c.match_id = p_match_id
  ), '[]'::JSONB);

  -- Substitutions
  v_result := v_result || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'type', 'substitution',
      'minute', s.minute,
      'team_color', s.team_color,
      'playerOut', CASE WHEN po.id IS NOT NULL THEN jsonb_build_object(
        'id', po.id, 'name', po.name, 'nickname', po.nickname, 'avatar_url', po.avatar_url
      ) ELSE NULL END,
      'playerIn', CASE WHEN pi.id IS NOT NULL THEN jsonb_build_object(
        'id', pi.id, 'name', pi.name, 'nickname', pi.nickname, 'avatar_url', pi.avatar_url
      ) ELSE NULL END
    ))
    FROM substitutions s
    LEFT JOIN profiles po ON po.id = s.player_out_id
    LEFT JOIN profiles pi ON pi.id = s.player_in_id
    WHERE s.match_id = p_match_id
  ), '[]'::JSONB);

  -- Match end event (if finished)
  -- COMPLEMENTO 2: Subtract paused seconds from end minute
  IF v_match.status = 'finished' AND v_match.finished_at IS NOT NULL AND v_match.started_at IS NOT NULL THEN
    v_end_minute := GREATEST(0, 
      FLOOR(
        (EXTRACT(EPOCH FROM (v_match.finished_at - v_match.started_at)) 
         - COALESCE(v_match.match_timer_total_paused_seconds, 0)
        ) / 60
      )::INT
    );
    v_result := v_result || jsonb_build_object(
      'id', 'end-' || p_match_id,
      'type', 'match_end',
      'minute', v_end_minute
    );
  END IF;

  -- Sort by minute
  SELECT jsonb_agg(e ORDER BY (e->>'minute')::INT) INTO v_result
  FROM jsonb_array_elements(v_result) e;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

COMMENT ON FUNCTION get_match_timeline_events IS 
'Retorna eventos da timeline de uma partida em formato JSON. Inclui gols, cartões, substituições e eventos de início/fim.';
```

**Validação:**
```sql
SELECT get_match_timeline_events('d1ef3307-ea1d-42a3-a4a6-09e10633f809');
```

---

### Fase 1 — Shadow Mode (Execução Paralela)

**Objetivo:** Comparar resultados sem afetar UI.

**Implementação:**
```typescript
// Em MatchDetails.tsx -> loadEvents()

const loadEvents = async () => {
  // ... código atual ...
  
  // Shadow mode: executar RPC em paralelo
  const { data: rpcEvents, error: rpcError } = await supabase.rpc('get_match_timeline_events', { p_match_id: matchId });
  
  if (rpcError) {
    console.warn('[Timeline RPC] Erro na RPC:', rpcError);
  } else {
    // Comparar resultados
    const currentCount = allEvents.length;
    const rpcCount = (rpcEvents || []).length;
    if (currentCount !== rpcCount) {
      console.warn(`[Timeline RPC] Divergência: atual=${currentCount}, RPC=${rpcCount}`);
    } else {
      console.log('[Timeline RPC] Resultados consistentes ✓');
    }
  }
  
  // Continua usando allEvents atual
  setEvents(allEvents);
};
```

**Duração:** 1-2 semanas de validação em produção.

---

### Fase 2 — Habilitação com Fallback

**Objetivo:** Usar RPC como primário, com fallback automático.

**Implementação:**
```typescript
const loadEvents = async () => {
  if (!matchId || !match) return;

  try {
    // Tentar RPC primeiro
    const { data: rpcEvents, error: rpcError } = await supabase.rpc('get_match_timeline_events', { p_match_id: matchId });
    
    if (!rpcError && rpcEvents) {
      console.log('[Timeline] Usando RPC ✓');
      
      // Converter para formato esperado (já deve estar correto)
      const events: TimelineEvent[] = rpcEvents.map((e: any) => ({
        id: e.id,
        type: e.type,
        minute: e.minute,
        team_color: e.team_color,
        is_own_goal: e.is_own_goal,
        player: e.player,
        assist: e.assist,
        playerOut: e.playerOut,
        playerIn: e.playerIn,
      }));
      
      setEvents(events);
      return;
    }
    
    // Fallback: código atual
    console.warn('[Timeline] RPC falhou, usando fallback:', rpcError);
    await loadEventsLegacy();
    
  } catch (error) {
    console.error('[Timeline] Erro, usando fallback:', error);
    await loadEventsLegacy();
  }
};

// Mover código atual para função separada
const loadEventsLegacy = async () => {
  // ... todo o código atual de loadEvents ...
};
```

**Feature Flag (opcional):**
```typescript
const USE_TIMELINE_RPC = localStorage.getItem('TIMELINE_RPC') === 'true';
```

---

### Fase 3 — Migração Definitiva

**Objetivo:** Remover código legado.

**Tarefas:**
- [x] Remover função `loadEventsLegacy()` - ✅ Concluído
- [x] Remover comparação shadow mode - ✅ Concluído
- [x] Remover feature flags - N/A (não foram usados)
- [ ] Atualizar `ManageMatch.tsx` (se aplicável) - Timeline não é usada em ManageMatch
- [x] Documentar RPC no código - ✅ Adicionado JSDoc

**Código Final:**
```typescript
const loadEvents = async () => {
  if (!matchId || !match) return;

  try {
    const { data, error } = await supabase.rpc('get_match_timeline_events', { p_match_id: matchId });
    
    if (error) throw error;
    
    setEvents((data || []) as TimelineEvent[]);
  } catch (error) {
    console.error('Erro ao carregar eventos:', error);
    setEvents([]);
  }
};
```

---

## Métricas de Sucesso

| Métrica | Antes | Após |
|---------|-------|------|
| Queries por load | 4+ | 1 |
| Latência média | ~500ms | ~100ms |
| Divergências | N/A | 0 |
| Erros de fallback | N/A | 0 |

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| RPC com bug | Fallback automático para código legado |
| Formato divergente | Validação em shadow mode |
| Performance da RPC | Índices otimizados (match_id) |
| Eventos faltando | Comparação de contagem em shadow mode |

---

## Cronograma Estimado

| Fase | Duração | Dependência |
|------|---------|-------------|
| Fase 0 | 1 dia | Nenhuma |
| Fase 1 | 1-2 semanas | Deploy Fase 0 |
| Fase 2 | 1 semana | Validação Fase 1 |
| Fase 3 | 1 dia | Zero erros Fase 2 |

**Total: ~3-4 semanas**
