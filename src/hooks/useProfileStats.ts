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

      const currentYear = new Date().getFullYear();
      const isHybridEligible = !year || year === currentYear;

      // --- 1. Fetch Base Matrix (Player Rankings) ---
      let baseStats: ProfileStats | null = null;
      let rankingUpdatedAt: string | null = null;

      if (isHybridEligible) {
        const { data: rankingData } = await supabase
          .from("player_rankings")
          .select("*")
          .eq("player_id", profileId)
          .single();

        if (rankingData) {
          baseStats = {
            presencas: rankingData.presencas || 0,
            gols: rankingData.gols || 0,
            assistencias: rankingData.assistencias || 0,
            vitorias: rankingData.vitorias || 0,
            empates: rankingData.empates || 0,
            derrotas: rankingData.derrotas || 0,
            cartoes_amarelos: rankingData.cartoes_amarelos || 0,
            cartoes_azuis: rankingData.cartoes_azuis || 0,
            punicoes: rankingData.punicoes || 0,
            pontos_totais: rankingData.pontos_totais || 0,
            partidas: (rankingData.vitorias || 0) + (rankingData.empates || 0) + (rankingData.derrotas || 0),
          };
          rankingUpdatedAt = rankingData.updated_at;
        }
      }

      // --- 2. Calculate Range / Delta Filter ---
      let matchQuery = supabase
        .from("player_round_stats")
        .select(`
          *,
          round:rounds!inner(id, round_number, scheduled_date)
        `)
        .eq("player_id", profileId);

      // Filter Logic
      if (year) {
        // Standard Year Filter
        matchQuery = matchQuery
          .gte('round.scheduled_date', `${year}-01-01`)
          .lte('round.scheduled_date', `${year}-12-31`);
      }

      // If Hybrid and we have a Base, only fetch matches AFTER the ranking update
      // BUT: For charts/history, we usually want ALL matches of the period anyway.
      // Strategy: Fetch ALL matches for the period to support charts, 
      // but calculate Totals by summing Base + Delta(matches > updated_at).

      const { data: playerRoundStats, error: statsError } = await matchQuery;
      if (statsError) throw statsError;

      // --- 3. Filter for Goals/Assists/Punishments (Standard) ---
      // We need these for the charts/graphs regardless of Hybrid Logic
      let goalsQuery = supabase
        .from("goals")
        .select(`id, is_own_goal, match:matches!inner(round:rounds!inner(scheduled_date))`)
        .eq("player_id", profileId)
        .eq("is_own_goal", false);

      let assistsQuery = supabase
        .from("assists")
        .select(`id, goal:goals!inner(match:matches!inner(round:rounds!inner(scheduled_date)))`)
        .eq("player_id", profileId);

      let punishmentsQuery = supabase
        .from("punishments")
        .select(`id, points, round:rounds!inner(scheduled_date)`)
        .eq("player_id", profileId);

      if (year) {
        goalsQuery = goalsQuery.gte('match.round.scheduled_date', `${year}-01-01`).lte('match.round.scheduled_date', `${year}-12-31`);
        assistsQuery = assistsQuery.gte('goal.match.round.scheduled_date', `${year}-01-01`).lte('goal.match.round.scheduled_date', `${year}-12-31`);
        punishmentsQuery = punishmentsQuery.gte('round.scheduled_date', `${year}-01-01`).lte('round.scheduled_date', `${year}-12-31`);
      }

      const [{ data: goals }, { data: assists }, { data: punishments }] = await Promise.all([
        goalsQuery,
        assistsQuery,
        punishmentsQuery
      ]);

      // Refine Mês (Client-Side)
      let filteredRoundStats = playerRoundStats || [];
      const filteredGoals = goals || [];
      const filteredAssists = assists || [];
      const filteredPunishments = punishments || [];

      if (month) {
        filteredRoundStats = filteredRoundStats.filter((rs: any) => new Date(rs.round?.scheduled_date).getMonth() + 1 === month);
        // Note: We don't filter Goals/Assists arrays for the TOTAL aggregation if we are using Hybrid,
        // but for Charts we might. 
      }

      // --- 4. Calculate Final Stats ---
      let aggregated: ProfileStats;

      if (baseStats && isHybridEligible && !month) {
        // HYBRID LOGIC: Base + Delta
        // Delta = Matches that happened strictly AFTER the ranking update
        // This avoids double counting if the styling update timestamp is accurate.
        // However, usually 'updated_at' updates on any change. 
        // Risk: If a match happened at 10:00, and Ranking updated at 10:05 (including that match),
        // we should NOT add it. So we strictly want matches > updated_at.

        const deltaRoundStats = filteredRoundStats.filter((rs: any) => {
          if (!rankingUpdatedAt || !rs.round?.scheduled_date) return false;
          return new Date(rs.round.scheduled_date) > new Date(rankingUpdatedAt);
        });

        // We need to fetch specific goals/assists for Delta too, or filter existing ones
        const deltaGoals = filteredGoals.filter(g => {
          const d = g.match?.round?.scheduled_date;
          return d && rankingUpdatedAt && new Date(d) > new Date(rankingUpdatedAt);
        });
        const deltaAssists = filteredAssists.filter(a => {
          const d = a.goal?.match?.round?.scheduled_date;
          return d && rankingUpdatedAt && new Date(d) > new Date(rankingUpdatedAt);
        });
        const deltaPunishments = filteredPunishments.filter(p => {
          const d = p.round?.scheduled_date;
          return d && rankingUpdatedAt && new Date(d) > new Date(rankingUpdatedAt);
        });

        const deltaAggregated = deltaRoundStats.reduce((acc: ProfileStats, rs: any) => ({
          presencas: acc.presencas + ((rs.presence_points || 0) > 0 ? 1 : 0),
          gols: acc.gols,
          assistencias: acc.assistencias,
          vitorias: acc.vitorias + (rs.victories || 0),
          empates: acc.empates + (rs.draws || 0),
          derrotas: acc.derrotas + (rs.defeats || 0),
          cartoes_amarelos: acc.cartoes_amarelos + (rs.yellow_cards || 0),
          cartoes_azuis: acc.cartoes_azuis + (rs.blue_cards || 0),
          punicoes: acc.punicoes,
          pontos_totais: acc.pontos_totais + (rs.total_points || 0),
          partidas: acc.partidas + (rs.victories || 0) + (rs.draws || 0) + (rs.defeats || 0),
        }), { ...emptyStats });

        deltaAggregated.gols = deltaGoals.length;
        deltaAggregated.assistencias = deltaAssists.length;
        deltaAggregated.punicoes = deltaPunishments.reduce((sum, p) => sum + Math.abs(p.points || 0), 0);

        // SUM Base + Delta
        aggregated = {
          presencas: baseStats.presencas + deltaAggregated.presencas,
          gols: baseStats.gols + deltaAggregated.gols,
          assistencias: baseStats.assistencias + deltaAggregated.assistencias,
          vitorias: baseStats.vitorias + deltaAggregated.vitorias,
          empates: baseStats.empates + deltaAggregated.empates,
          derrotas: baseStats.derrotas + deltaAggregated.derrotas,
          cartoes_amarelos: baseStats.cartoes_amarelos + deltaAggregated.cartoes_amarelos,
          cartoes_azuis: baseStats.cartoes_azuis + deltaAggregated.cartoes_azuis,
          punicoes: baseStats.punicoes + deltaAggregated.punicoes,
          pontos_totais: baseStats.pontos_totais + deltaAggregated.pontos_totais,
          partidas: baseStats.partidas + deltaAggregated.partidas
        };

      } else {
        // STANDARD LOGIC (From Matches only)
        // Used for Month filters or Past Years (where we assume no current ranking snapshot)

        aggregated = filteredRoundStats.reduce((acc: ProfileStats, rs: any) => ({
          presencas: acc.presencas + ((rs.presence_points || 0) > 0 ? 1 : 0),
          gols: acc.gols, // Will update from goals query
          assistencias: acc.assistencias, // Will update from assists query
          vitorias: acc.vitorias + (rs.victories || 0),
          empates: acc.empates + (rs.draws || 0),
          derrotas: acc.derrotas + (rs.defeats || 0),
          cartoes_amarelos: acc.cartoes_amarelos + (rs.yellow_cards || 0),
          cartoes_azuis: acc.cartoes_azuis + (rs.blue_cards || 0),
          punicoes: acc.punicoes, // Will update from punishments query
          pontos_totais: acc.pontos_totais + (rs.total_points || 0),
          partidas: acc.partidas + (rs.victories || 0) + (rs.draws || 0) + (rs.defeats || 0),
        }), { ...emptyStats });

        aggregated.gols = filteredGoals.length;
        aggregated.assistencias = filteredAssists.length;
        aggregated.punicoes = filteredPunishments.reduce((sum, p) => sum + Math.abs(p.points || 0), 0);
      }

      setStats(aggregated);

      // --- 5. Generate Charts (Always from Matches Logic) ---
      // Charts show the *event history*, so they should reflect the filteredRoundStats
      // even if the Totals above are hybrid. 
      // This might cause a slight "visual mismatch" (Sum of chart != Total) if admins Manual Edited stats,
      // but it's the correct behavior: Charts show *Games*, Totals show *Official Stats*.

      const roundStatsArray: RoundStats[] = filteredRoundStats.map((rs: any) => ({
        round_id: rs.round?.id || rs.round_id,
        round_number: rs.round?.round_number || 0,
        round_date: rs.round?.scheduled_date || null,
        presencas: (rs.presence_points || 0) > 0 ? 1 : 0,
        gols: 0,
        assistencias: 0,
        vitorias: rs.victories || 0,
        empates: rs.draws || 0,
        derrotas: rs.defeats || 0,
        cartoes_amarelos: rs.yellow_cards || 0,
        cartoes_azuis: rs.blue_cards || 0,
        punicoes: rs.punishments || 0,
        pontos_totais: rs.total_points || 0,
        partidas: (rs.victories || 0) + (rs.draws || 0) + (rs.defeats || 0),
      })).sort((a, b) => a.round_number - b.round_number);

      // Map goals/assists to rounds
      for (const goal of filteredGoals) {
        const roundDate = goal.match?.round?.scheduled_date;
        const roundStat = roundStatsArray.find(rs => rs.round_date === roundDate);
        if (roundStat) roundStat.gols += 1;
      }
      for (const assist of filteredAssists) {
        const roundDate = assist.goal?.match?.round?.scheduled_date;
        const roundStat = roundStatsArray.find(rs => rs.round_date === roundDate);
        if (roundStat) roundStat.assistencias += 1;
      }

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
