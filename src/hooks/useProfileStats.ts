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
  const [availableYears, setAvailableYears] = useState<number[]>([]);
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
      const { data: roundData } = await supabase
        .from("player_round_stats")
        .select("round:rounds(scheduled_date)")
        .eq("player_id", profileId);

      if (roundData) {
        const years = new Set<number>();
        roundData.forEach((r: any) => {
          if (r.round?.scheduled_date) {
            years.add(new Date(r.round.scheduled_date).getFullYear());
          }
        });
        const sortedYears = Array.from(years).sort((a, b) => b - a);
        setAvailableYears(sortedYears);
      }
    } catch (error) {
      console.error("Error loading available years:", error);
    }
  };

  const loadStats = async (profileId: string, year: number | null, month: number | null) => {
    try {
      setLoading(true);

      // Fetch round stats with round info
      const { data: playerRoundStats } = await supabase
        .from("player_round_stats")
        .select(`
          *,
          round:rounds(id, round_number, scheduled_date)
        `)
        .eq("player_id", profileId);

      if (!playerRoundStats || playerRoundStats.length === 0) {
        setStats(emptyStats);
        setRoundStats([]);
        setLoading(false);
        return;
      }

      // Filter by year and month
      let filteredRoundStats = playerRoundStats.filter((rs: any) => {
        if (!rs.round?.scheduled_date) return false;
        const date = new Date(rs.round.scheduled_date);
        if (year && date.getFullYear() !== year) return false;
        if (month && (date.getMonth() + 1) !== month) return false;
        return true;
      });

      // Count goals for filtered period
      let goalsQuery = supabase
        .from("goals")
        .select(`
          id,
          is_own_goal,
          match:matches(round:rounds(scheduled_date))
        `)
        .eq("player_id", profileId)
        .eq("is_own_goal", false);

      const { data: goals } = await goalsQuery;
      
      let filteredGoals = goals?.filter((g: any) => {
        if (!g.match?.round?.scheduled_date) return false;
        const date = new Date(g.match.round.scheduled_date);
        if (year && date.getFullYear() !== year) return false;
        if (month && (date.getMonth() + 1) !== month) return false;
        return true;
      }) || [];

      // Count assists for filtered period
      const { data: assists } = await supabase
        .from("assists")
        .select(`
          id,
          goal:goals(match:matches(round:rounds(scheduled_date)))
        `)
        .eq("player_id", profileId);

      let filteredAssists = assists?.filter((a: any) => {
        if (!a.goal?.match?.round?.scheduled_date) return false;
        const date = new Date(a.goal.match.round.scheduled_date);
        if (year && date.getFullYear() !== year) return false;
        if (month && (date.getMonth() + 1) !== month) return false;
        return true;
      }) || [];

      // Count punishments for filtered period
      const { data: punishments } = await supabase
        .from("punishments")
        .select(`
          id,
          points,
          round:rounds(scheduled_date)
        `)
        .eq("player_id", profileId);

      let filteredPunishments = punishments?.filter((p: any) => {
        if (!p.round?.scheduled_date) return false;
        const date = new Date(p.round.scheduled_date);
        if (year && date.getFullYear() !== year) return false;
        if (month && (date.getMonth() + 1) !== month) return false;
        return true;
      }) || [];

      // Aggregate stats
      const aggregated = filteredRoundStats.reduce((acc: ProfileStats, rs: any) => ({
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

      aggregated.gols = filteredGoals.length;
      aggregated.assistencias = filteredAssists.length;
      aggregated.punicoes = filteredPunishments.reduce((sum, p) => sum + Math.abs(p.points || 0), 0);

      setStats(aggregated);

      // Build round stats for chart
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

      // Add goals per round
      for (const goal of filteredGoals) {
        const roundDate = goal.match?.round?.scheduled_date;
        const roundStat = roundStatsArray.find(rs => rs.round_date === roundDate);
        if (roundStat) roundStat.gols += 1;
      }

      // Add assists per round
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
