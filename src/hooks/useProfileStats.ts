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

      // IMPORTANT FIX: Only use hybrid (player_rankings) when NO year filter is selected
      // When a specific year is selected, ALWAYS calculate from player_round_stats
      const isHybridEligible = year === null && month === null;

      // ========== PHASE 5 OPTIMIZATION: Parallel Queries ==========
      // Build all queries first, then execute in parallel

      // Build round stats query with year filter if applicable
      let matchQueryBuilder = supabase
        .from("player_round_stats")
        .select(`
          *,
          round:rounds!inner(id, round_number, scheduled_date)
        `)
        .eq("player_id", profileId);

      if (year) {
        matchQueryBuilder = matchQueryBuilder
          .gte('round.scheduled_date', `${year}-01-01`)
          .lte('round.scheduled_date', `${year}-12-31`);
      }

      // Build goals query
      let goalsQueryBuilder = supabase
        .from("goals")
        .select(`id, is_own_goal, match:matches!inner(round:rounds!inner(scheduled_date))`)
        .eq("player_id", profileId)
        .eq("is_own_goal", false);

      // Build assists query
      let assistsQueryBuilder = supabase
        .from("assists")
        .select(`id, goal:goals!inner(match:matches!inner(round:rounds!inner(scheduled_date)))`)
        .eq("player_id", profileId);

      // Build punishments query
      let punishmentsQueryBuilder = supabase
        .from("punishments")
        .select(`id, points, round:rounds!inner(scheduled_date)`)
        .eq("player_id", profileId);

      if (year) {
        goalsQueryBuilder = goalsQueryBuilder.gte('match.round.scheduled_date', `${year}-01-01`).lte('match.round.scheduled_date', `${year}-12-31`);
        assistsQueryBuilder = assistsQueryBuilder.gte('goal.match.round.scheduled_date', `${year}-01-01`).lte('goal.match.round.scheduled_date', `${year}-12-31`);
        punishmentsQueryBuilder = punishmentsQueryBuilder.gte('round.scheduled_date', `${year}-01-01`).lte('round.scheduled_date', `${year}-12-31`);
      }

      // Execute ALL queries in parallel
      const [
        rankingResult,
        roundStatsResult,
        goalsResult,
        assistsResult,
        punishmentsResult
      ] = await Promise.all([
        // Query 1: Player rankings (only if hybrid eligible)
        isHybridEligible
          ? supabase
            .from("player_rankings")
            .select("*")
            .eq("player_id", profileId)
            .single()
          : Promise.resolve({ data: null, error: null }),

        // Query 2: Player round stats
        matchQueryBuilder,

        // Query 3: Goals
        goalsQueryBuilder,

        // Query 4: Assists
        assistsQueryBuilder,

        // Query 5: Punishments
        punishmentsQueryBuilder
      ]);

      // Extract data from results
      const { data: rankingData } = rankingResult;
      const { data: playerRoundStats, error: statsError } = roundStatsResult;
      const { data: goals } = goalsResult;
      const { data: assists } = assistsResult;
      const { data: punishments } = punishmentsResult;

      if (statsError) throw statsError;

      // --- Process Base Stats (Hybrid Logic) ---
      let baseStats: ProfileStats | null = null;
      let rankingUpdatedAt: string | null = null;

      if (isHybridEligible && rankingData) {
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
        // Used for any year/month filter - calculate from player_round_stats

        aggregated = filteredRoundStats.reduce((acc: ProfileStats, rs: any) => ({
          presencas: acc.presencas + 1, // Each round in player_round_stats = 1 presence
          gols: acc.gols + (rs.goals || 0),
          assistencias: acc.assistencias + (rs.assists || 0),
          vitorias: acc.vitorias + (rs.victories || 0),
          empates: acc.empates + (rs.draws || 0),
          derrotas: acc.derrotas + (rs.defeats || 0),
          cartoes_amarelos: acc.cartoes_amarelos + (rs.yellow_cards || 0),
          cartoes_azuis: acc.cartoes_azuis + (rs.blue_cards || 0),
          punicoes: acc.punicoes + (rs.punishments || 0),
          pontos_totais: acc.pontos_totais + (rs.total_points || 0),
          partidas: acc.partidas + (rs.victories || 0) + (rs.draws || 0) + (rs.defeats || 0),
        }), { ...emptyStats });

        // NOTE: Goals/assists already come from player_round_stats (populated by recalc_round_aggregates)
        // Do NOT add filteredGoals.length again - that would cause double counting
      }

      // Buscar e aplicar ajustes da temporada
      if (year !== null) {
        const { data: adjustments } = await supabase
          .from("player_ranking_adjustments")
          .select("player_id, adjustment_type, adjustment_value, season_year")
          .eq("player_id", profileId)
          .or(`season_year.is.null,season_year.eq.${year}`);

        if (adjustments && adjustments.length > 0) {
          adjustments.forEach((adj: any) => {
            const value = adj.adjustment_value || 0;
            switch (adj.adjustment_type) {
              case 'gols': aggregated.gols += value; break;
              case 'assistencias': aggregated.assistencias += value; break;
              case 'vitorias': aggregated.vitorias += value; break;
              case 'empates': aggregated.empates += value; break;
              case 'derrotas': aggregated.derrotas += value; break;
              case 'presencas': aggregated.presencas += value; break;
              case 'cartoes_amarelos': aggregated.cartoes_amarelos += value; break;
              case 'cartoes_azuis': aggregated.cartoes_azuis += value; break;
              case 'punicoes': aggregated.punicoes += value; break;
              case 'pontos_totais': aggregated.pontos_totais += value; break;
            }
          });
        }
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
        presencas: 1, // Each entry = 1 presence
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
      })).sort((a, b) => a.round_number - b.round_number);

      // NOTE: Goals/assists already in player_round_stats, no need to add again from goals/assists tables

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
