import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileStats {
  presencas: number;
  gols: number;
  assistencias: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  cartoes_amarelos: number;
  cartoes_azuis: number;
  punicoes: number;
  pontos_totais: number;
  partidas: number;
}

export interface RoundStats extends ProfileStats {
  round_id: string;
  round_number: number;
  round_date: string | null;
}

export interface CalculatedMetrics {
  mediaGolsJogo: number;
  mediaAssistenciasJogo: number;
  participacaoGols: number;
  taxaVitorias: number;
}

export interface BestWorstPeriod {
  period: string;
  pontos: number;
  gols: number;
  assistencias: number;
  vitorias: number;
  empates: number;
  derrotas: number;
}

const emptyStats: ProfileStats = {
  presencas: 0,
  gols: 0,
  assistencias: 0,
  vitorias: 0,
  empates: 0,
  derrotas: 0,
  cartoes_amarelos: 0,
  cartoes_azuis: 0,
  punicoes: 0,
  pontos_totais: 0,
  partidas: 0,
};

export function useProfileStats(profileId: string | undefined, year: number | null, month: number | null) {
  const [stats, setStats] = useState<ProfileStats>(emptyStats);
  const [roundStats, setRoundStats] = useState<RoundStats[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) {
      setLoading(false);
      return;
    }
    loadAvailableYears(profileId);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    loadStats(profileId, year, month);
  }, [profileId, year, month]);

  const loadAvailableYears = async (profileId: string) => {
    try {
      // Buscar anos onde o player teve participação (player_round_stats)
      const { data: roundData } = await supabase
        .from("player_round_stats")
        .select("round:rounds!inner(scheduled_date)")
        .eq("player_id", profileId);

      const years = new Set<string>();

      if (roundData && roundData.length > 0) {
        roundData.forEach((r: any) => {
          if (r.round?.scheduled_date) {
            years.add(new Date(r.round.scheduled_date).getFullYear().toString());
          }
        });
      }

      // Se não tiver histórico, adiciona o ano atual como fallback
      if (years.size === 0) {
        years.add(new Date().getFullYear().toString());
      }

      const sortedYears = Array.from(years).sort((a, b) => Number(b) - Number(a));
      setAvailableYears(sortedYears);
    } catch (error) {
      console.error("Error loading available years:", error);
      // Fallback erro
      setAvailableYears([new Date().getFullYear().toString()]);
    }
  };

  const loadStats = async (profileId: string, year: number | null, month: number | null) => {
    try {
      setLoading(true);

      // ========== PHASE 5 OPTIMIZATION: Parallel Queries ==========
      // 1. Get Totals from RPC (Unified Logic)
      // 2. Get History from player_round_stats (for Charts/Timeline)

      const [classificationResult, historyResult] = await Promise.all([
        // Query 1: Unified Classification (Totals)
        supabase.rpc('get_classification', {
          p_season_year: year,
          p_month: month
          // Note: We fetch all and filter by ID clientside. 
          // For < 1000 players this is fine. Ideally RPC would accept player_id.
        }),

        // Query 2: Detailed History for Charts (Matches)
        // We still need this because get_classification returns only Totals
        supabase
          .from("player_round_stats")
          .select(`
            *,
            round:rounds!inner(id, round_number, scheduled_date)
          `)
          .eq("player_id", profileId)
          .gte("round.scheduled_date", year ? `${year}-01-01` : "2000-01-01")
          .lte("round.scheduled_date", year ? `${year}-12-31` : "2099-12-31")
          .order("round(scheduled_date)", { ascending: true })
      ]);

      const { data: classificationData, error: classError } = classificationResult;
      const { data: historyData, error: historyError } = historyResult;

      if (classError) throw classError;
      if (historyError) throw historyError;

      // 1. Set Totals (Stats)
      const playerTotal = (classificationData || []).find((p: any) => p.player_id === profileId);

      if (playerTotal) {
        setStats({
          presencas: playerTotal.presencas || 0,
          gols: playerTotal.gols || 0,
          assistencias: playerTotal.assistencias || 0,
          vitorias: playerTotal.vitorias || 0,
          empates: playerTotal.empates || 0,
          derrotas: playerTotal.derrotas || 0,
          cartoes_amarelos: playerTotal.cartoes_amarelos || 0,
          cartoes_azuis: playerTotal.cartoes_azuis || 0,
          punicoes: playerTotal.punicoes || 0,
          pontos_totais: playerTotal.pontos_totais || 0,
          // Partidas = V + E + D
          partidas: (playerTotal.vitorias || 0) + (playerTotal.empates || 0) + (playerTotal.derrotas || 0),
        });
      } else {
        setStats(emptyStats);
      }

      // 2. Set History (Charts)
      // Filter by month if needed (RPC handles Total filtering, but History query above handled Year only)
      let filteredHistory = historyData || [];
      if (month) {
        filteredHistory = filteredHistory.filter((rs: any) =>
          new Date(rs.round?.scheduled_date).getMonth() + 1 === month
        );
      }

      const roundStatsArray: RoundStats[] = filteredHistory.map((rs: any) => ({
        round_id: rs.round?.id || rs.round_id,
        round_number: rs.round?.round_number || 0,
        round_date: rs.round?.scheduled_date || null,
        presencas: 1,
        gols: rs.goals || 0,
        assistencias: rs.assists || 0,
        vitorias: rs.victories || 0,
        empates: rs.draws || 0,
        derrotas: rs.defeats || 0,
        cartoes_amarelos: rs.yellow_cards || 0,
        cartoes_azuis: rs.blue_cards || 0,
        punicoes: rs.punishments || 0,
        pontos_totais: rs.total_points || 0,
        partidas: (rs.victories || 0) + (rs.draws || 0) + (rs.defeats || 0),
      })).sort((a: any, b: any) => a.round_number - b.round_number);

      setRoundStats(roundStatsArray);

    } catch (error) {
      console.error("Error loading profile stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculated metrics
  const calculatedMetrics = useMemo((): CalculatedMetrics => {
    const totalGames = stats.partidas || 1;
    return {
      mediaGolsJogo: stats.gols / totalGames,
      mediaAssistenciasJogo: stats.assistencias / totalGames,
      participacaoGols: stats.partidas > 0 ? ((stats.gols + stats.assistencias) / stats.partidas) * 100 : 0,
      taxaVitorias: stats.partidas > 0 ? (stats.vitorias / stats.partidas) * 100 : 0,
    };
  }, [stats]);

  // Best/Worst periods
  const bestWorstPeriods = useMemo(() => {
    if (roundStats.length === 0) return null;

    // Best/Worst by round
    const sortedByPoints = [...roundStats].sort((a, b) => b.pontos_totais - a.pontos_totais);
    const bestRound = sortedByPoints[0];
    const worstRound = sortedByPoints[sortedByPoints.length - 1];

    // Best/Worst by month (aggregate by month)
    const monthlyStats: Record<string, ProfileStats & { month: string }> = {};
    for (const rs of roundStats) {
      if (!rs.round_date) continue;
      const date = new Date(rs.round_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { ...emptyStats, month: monthLabel };
      }

      monthlyStats[monthKey].presencas += rs.presencas;
      monthlyStats[monthKey].gols += rs.gols;
      monthlyStats[monthKey].assistencias += rs.assistencias;
      monthlyStats[monthKey].vitorias += rs.vitorias;
      monthlyStats[monthKey].empates += rs.empates;
      monthlyStats[monthKey].derrotas += rs.derrotas;
      monthlyStats[monthKey].pontos_totais += rs.pontos_totais;
    }

    const monthlyArray = Object.values(monthlyStats);
    if (monthlyArray.length === 0) return null;

    const sortedMonths = monthlyArray.sort((a, b) => b.pontos_totais - a.pontos_totais);
    const bestMonth = sortedMonths[0];
    const worstMonth = sortedMonths[sortedMonths.length - 1];

    return {
      bestRound: bestRound ? {
        period: `Rodada ${bestRound.round_number}`,
        pontos: bestRound.pontos_totais,
        gols: bestRound.gols,
        assistencias: bestRound.assistencias,
        vitorias: bestRound.vitorias,
        empates: bestRound.empates,
        derrotas: bestRound.derrotas,
      } : null,
      worstRound: worstRound ? {
        period: `Rodada ${worstRound.round_number}`,
        pontos: worstRound.pontos_totais,
        gols: worstRound.gols,
        assistencias: worstRound.assistencias,
        vitorias: worstRound.vitorias,
        empates: worstRound.empates,
        derrotas: worstRound.derrotas,
      } : null,
      bestMonth: bestMonth ? {
        period: bestMonth.month,
        pontos: bestMonth.pontos_totais,
        gols: bestMonth.gols,
        assistencias: bestMonth.assistencias,
        vitorias: bestMonth.vitorias,
        empates: bestMonth.empates,
        derrotas: bestMonth.derrotas,
      } : null,
      worstMonth: worstMonth ? {
        period: worstMonth.month,
        pontos: worstMonth.pontos_totais,
        gols: worstMonth.gols,
        assistencias: worstMonth.assistencias,
        vitorias: worstMonth.vitorias,
        empates: worstMonth.empates,
        derrotas: worstMonth.derrotas,
      } : null,
    };
  }, [roundStats]);

  return {
    stats,
    roundStats,
    availableYears,
    calculatedMetrics,
    bestWorstPeriods,
    loading,
  };
}
