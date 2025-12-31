# Cozidos FC - Regras do Projeto

## Stack Tecnologico
- **Frontend:** React 18 (Vite), TypeScript, Shadcn UI, Tailwind CSS
- **Backend:** Supabase (Database, Auth, Storage, Edge Functions)
- **Linguagem:** Sempre responder em portugues brasileiro

## Regras de Seguranca do Codigo

### Avaliacao de Impacto (OBRIGATORIO)
Antes de qualquer alteracao:

1. **Avaliar escopo**: A mudanca afeta APENAS o que foi solicitado?
2. **Verificar dependencias**: Outros componentes usam este codigo?
3. **Testar regressao**: A funcionalidade existente continua funcionando?

**Se houver risco de impacto colateral:**
- AVISAR o usuario antes de implementar
- Explicar quais areas podem ser afetadas
- Propor alternativa mais segura se possivel

**Principio fundamental:**
> Alterar SOMENTE o que foi solicitado. Nunca modificar logicas adjacentes sem confirmacao explicita do usuario.

### Arquivos Estaveis (nao alterar sem solicitacao)
- src/pages/Auth.tsx - Login/Cadastro
- src/contexts/AuthContext.tsx - Autenticacao
- src/lib/errorHandler.ts - Tratamento de erros
- Funcoes de calculo de pontuacao
- Triggers e functions do Supabase

## Arquitetura de Dados

### Hierarquia Principal
profiles -> round_team_players -> round_teams -> rounds -> matches -> goals/cards

### Conceitos Criticos

#### Ghost Profiles (Perfis Fantasmas)
- Perfis podem existir SEM usuario vinculado
- Usuario pode reivindicar ghost profile via claim_token
- REGRA: Um usuario NUNCA deve ter 2 perfis ativos

#### Rodadas
- Status: a_iniciar, em_andamento, encerrada
- Round 0 e historico - NUNCA exibir em listas
- Filtrar com: .neq(round_number, 0)

## Padroes de Codigo

### Queries Supabase
Excluir rodadas historicas:
.or(is_historical.is.null,is_historical.eq.false)
.neq(round_number, 0)

### Mobile First
- Botoes min 44px altura
- Evitar modais - preferir Drawers
- Testar scroll em listas longas

## Cores dos Times
branco, vermelho, azul, laranja

## Seguranca
- NUNCA expor claim_token para nao-donos
- NUNCA expor email para nao-donos/nao-admins
- Usar view profiles_public para queries publicas
