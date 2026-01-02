/**
 * Maps technical database errors to user-friendly messages
 * Prevents leaking internal system details while maintaining helpful feedback
 */
export const getUserFriendlyError = (error: any): string => {
  const message = error?.message?.toLowerCase() || '';

  // RLS and permission errors
  if (message.includes('row-level security') || message.includes('permission denied')) {
    return 'Você não tem permissão para realizar esta ação.';
  }

  // Duplicate round in same week
  if (message.includes('rodada agendada para esta semana') || message.includes('já existe uma rodada')) {
    return 'Já existe uma rodada agendada para esta semana. Exclua a rodada existente ou escolha outra data.';
  }

  // Duplicate key errors
  if (message.includes('duplicate key') || message.includes('already exists')) {
    return 'Já existe um registro com estes dados.';
  }

  // Foreign key constraint errors - specific case for created_by
  if (message.includes('player_ranking_adjustments_created_by_fkey')) {
    return 'Erro de autenticação. Sua sessão pode ter expirado. Faça login novamente.';
  }

  // JWT and token errors
  if (message.includes('jwt') || message.includes('token expired') || message.includes('invalid token')) {
    return 'Token de autenticação inválido ou expirado. Faça login novamente.';
  }

  // General session errors
  if (message.includes('auth.uid()') || message.includes('session')) {
    return 'Sessão expirada ou inválida. Faça login novamente.';
  }

  // Foreign key constraint errors (generic)
  if (message.includes('foreign key') || message.includes('referenced')) {
    return 'Não é possível excluir: existem dados relacionados.';
  }

  // Check constraint violations
  if (message.includes('violates check constraint')) {
    return 'Os dados informados não atendem aos requisitos.';
  }

  // Not found errors
  if (message.includes('not found') || message.includes('no rows')) {
    return 'Registro não encontrado.';
  }

  // Authentication errors
  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return 'Email ou senha incorretos.';
  }

  // User already registered
  if (message.includes('user already registered')) {
    return 'Este email já está cadastrado.';
  }

  // Log full error for debugging (only detailed info in development)
  if (process.env.NODE_ENV === 'development') {
    console.error('[DB Error Details]', {
      code: error?.code,
      hint: error?.hint,
      message: error?.message,
      details: error?.details
    });
  } else {
    // In production, just log that an error occurred
    console.error('[DB Error]', error?.code || 'UNKNOWN_ERROR');
  }

  // Generic fallback
  return 'Ocorreu um erro inesperado. Tente novamente.';
};
