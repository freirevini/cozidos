/**
 * Utilitários centralizados para cronômetro de partida
 * Garante sincronização entre Admin e Usuários
 */

export interface MatchTimerData {
  match_timer_started_at: string | null;
  match_timer_paused_at: string | null;
  match_timer_total_paused_seconds: number | null;
  status: string;
}

/**
 * Calcula os segundos decorridos da partida baseado em timestamps reais
 * Sincronizado entre admin e usuários
 */
export function getMatchElapsedSeconds(match: MatchTimerData): number {
  if (!match.match_timer_started_at || match.status !== 'in_progress') {
    return 0;
  }

  const startTime = new Date(match.match_timer_started_at).getTime();
  if (isNaN(startTime)) return 0;

  const now = Date.now();
  let pausedSeconds = match.match_timer_total_paused_seconds || 0;

  if (match.match_timer_paused_at) {
    const pausedAt = new Date(match.match_timer_paused_at).getTime();
    if (!isNaN(pausedAt)) {
      pausedSeconds += Math.floor((now - pausedAt) / 1000);
    }
  }

  return Math.max(0, Math.floor((now - startTime) / 1000) - pausedSeconds);
}

/**
 * Calcula o minuto atual da partida
 */
export function getMatchCurrentMinute(match: MatchTimerData): number {
  return Math.floor(getMatchElapsedSeconds(match) / 60);
}

/**
 * Formata o cronômetro no formato MM:SS
 */
export function formatMatchTimer(match: MatchTimerData): string {
  if (match.status === 'finished') {
    return 'Encerrado';
  }
  
  if (match.status !== 'in_progress' || !match.match_timer_started_at) {
    return '--:--';
  }

  const totalSeconds = getMatchElapsedSeconds(match);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Formata o minuto para exibição de eventos
 * Regra: <= 12 minutos = "X'", > 12 minutos = "12' + Y"
 */
export function formatEventMinute(minute: number, matchDuration: number = 12): string {
  if (minute > matchDuration) {
    return `${matchDuration}' + ${minute - matchDuration}`;
  }
  return `${minute}'`;
}

/**
 * Retorna apenas o minuto para exibição simples (sem formato MM:SS)
 */
export function formatMinuteOnly(match: MatchTimerData, matchDuration: number = 12): string {
  if (match.status === 'finished') {
    return 'Encerrado';
  }
  
  if (match.status !== 'in_progress' || !match.match_timer_started_at) {
    return '--';
  }

  const minute = getMatchCurrentMinute(match);
  return formatEventMinute(minute, matchDuration);
}
