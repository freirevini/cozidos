import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FilterDrawer, { FilterState, FilterBadge } from "@/components/FilterDrawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import {
  Trophy, Target, Award, Equal, TrendingDown, Filter,
  UserCheck, AlertCircle, Square, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PlayerRanking {
  id: string;
  player_id: string;
  nickname: string;
  avatar_url: string | null;
  level: string | null;
  gols: number;
  assistencias: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  pontos_totais: number;
  // Novos campos
  presencas: number;
  cartoes_amarelos: number;
  cartoes_azuis: number;
  saldo_gols: number;
  gols_contra: number;
}

type FilterType =
  | "goals"
  | "assists"
  | "presences"
  | "wins"
  | "draws"
  | "defeats"
  | "ownGoals"
  | "yellowCards"
  | "blueCards"
  | "goalDiff";

export default function Statistics() {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros iguais à Classification
  const [seasons, setSeasons] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(new Date().getFullYear());
  const [availableMonths, setAvailableMonths] = useState<number[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Array<{ id: string; round_number: number; scheduled_date: string }>>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  // Stats filter
  const [filterType, setFilterType] = useState<FilterType>("goals");

  // Filter drawer state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const handleApplyFilters = (filters: FilterState) => {
    setSelectedSeason(filters.season);
    setSelectedMonth(filters.month);
    setSelectedLevel(filters.level);
    setSelectedRoundId(filters.roundId);
  };

  const currentFilters: FilterState = {
    season: selectedSeason,
    month: selectedMonth,
    level: selectedLevel,
    roundId: selectedRoundId,
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadStatistics();
      toast.success("Estatísticas atualizadas!");
    },
    enabled: true,
  });

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    loadAvailableMonths();
    loadRounds();
    loadStatistics();
  }, [selectedSeason, selectedMonth]);

  useEffect(() => {
    loadStatistics();
  }, [selectedRoundId]);

  const loadSeasons = async () => {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select("scheduled_date")
        .not("scheduled_date", "is", null);
      if (error) throw error;

      const years = [...new Set(data?.map(r => new Date(r.scheduled_date!).getFullYear()) || [])].sort((a, b) => b - a);
      if (years.length > 0) {
        setSeasons(years);
        const currentYear = new Date().getFullYear();
        setSelectedSeason(years.includes(currentYear) ? currentYear : years[0]);
      } else {
        setSeasons([new Date().getFullYear()]);
      }
    } catch (error) {
      console.error("Erro ao carregar temporadas:", error);
      setSeasons([new Date().getFullYear()]);
    }
  };

  const loadAvailableMonths = async () => {
    try {
      const query = supabase.from("rounds").select("scheduled_date").not("scheduled_date", "is", null);
      const { data, error } = selectedSeason
        ? await query.gte("scheduled_date", `${selectedSeason}-01-01`).lte("scheduled_date", `${selectedSeason}-12-31`)
        : await query;
      if (error) throw error;
      const months = [...new Set(data?.map(r => new Date(r.scheduled_date!).getMonth() + 1) || [])].sort((a, b) => a - b);
      setAvailableMonths(months);
    } catch (error) {
      console.error("Erro ao carregar meses:", error);
      setAvailableMonths([]);
    }
  };

  const loadRounds = async () => {
    try {
      let query = supabase
        .from("rounds")
        .select("id, round_number, scheduled_date")
        .not("scheduled_date", "is", null)
        .order("scheduled_date", { ascending: false });

      if (selectedSeason !== null) {
        query = query.gte("scheduled_date", `${selectedSeason}-01-01`)
          .lte("scheduled_date", `${selectedSeason}-12-31`);
      }

      if (selectedMonth !== null) {
        const monthStr = selectedMonth.toString().padStart(2, '0');
        query = query.gte("scheduled_date", `${selectedSeason}-${monthStr}-01`)
          .lte("scheduled_date", `${selectedSeason}-${monthStr}-31`);
      }

      const { data, error } = await query;
      if (error) throw error;

      setRounds(data || []);
      // Reset round selection when season/month changes
      setSelectedRoundId(null);
    } catch (error) {
      console.error("Erro ao carregar rodadas:", error);
      setRounds([]);
    }
  };

  const loadStatistics = async () => {
    try {
      setLoading(true);

      // Armazenar estatísticas agrupadas
      const playerMap = new Map<string, PlayerRanking>();

      // 1. Buscar Ranking Base (dependendo dos filtros)
      if (selectedSeason === null && selectedMonth === null) {
        // "Todos os tempos" -> usar player_rankings para base
        const { data, error } = await supabase
          .from("player_rankings")
          .select(`*, profiles!inner(avatar_url, level)`)
          .order("pontos_totais", { ascending: false })
          .limit(1000);

        if (error) throw error;

        (data || []).forEach(rank => {
          playerMap.set(rank.player_id, {
            ...rank,
            avatar_url: rank.profiles?.avatar_url || null,
            level: rank.profiles?.level || null,
            presencas: rank.presencas || 0,
            cartoes_amarelos: rank.cartoes_amarelos || 0,
            cartoes_azuis: rank.cartoes_azuis || 0,
            saldo_gols: rank.saldo_gols || 0,
            gols_contra: 0, // Será preenchido depois
          });
        });
      } else {
        // Filtros ativos -> usar player_round_stats
        let query = supabase
          .from("player_round_stats")
          .select(`
            player_id,
            round_id,
            goals,
            assists,
            victories,
            draws,
            defeats,
            total_points,
            yellow_cards,
            blue_cards,
            goal_difference,
            own_goals,
            round:rounds!inner(scheduled_date),
            profile:profiles!inner(nickname, name, avatar_url, level, is_player, status)
          `);

        // Filtro de ano
        if (selectedSeason !== null) {
          query = query.gte("round.scheduled_date", `${selectedSeason}-01-01`)
            .lte("round.scheduled_date", `${selectedSeason}-12-31`);
        }

        const { data: roundStats, error } = await query;
        if (error) throw error;

        // Filtros de Mês e Rodada em JS
        const filteredStats = (roundStats || []).filter((rs: any) => {
          const date = new Date(rs.round?.scheduled_date);
          const month = date.getMonth() + 1;

          if (selectedMonth !== null && month !== selectedMonth) return false;
          if (selectedRoundId !== null && rs.round_id !== selectedRoundId) return false;

          return true;
        });

        // Agrupar estatísticas
        filteredStats.forEach((rs: any) => {
          if (!rs.profile?.is_player || rs.profile?.status !== 'aprovado') return;

          const playerId = rs.player_id;
          const existing = playerMap.get(playerId);

          if (existing) {
            existing.gols += rs.goals || 0;
            existing.assistencias += rs.assists || 0;
            existing.vitorias += rs.victories || 0;
            existing.empates += rs.draws || 0;
            existing.derrotas += rs.defeats || 0;
            existing.pontos_totais += rs.total_points || 0;
            existing.presencas += 1;
            existing.cartoes_amarelos += rs.yellow_cards || 0;
            existing.cartoes_azuis += rs.blue_cards || 0;
            existing.saldo_gols += rs.goal_difference || 0;
            existing.gols_contra += rs.own_goals || 0;
          } else {
            playerMap.set(playerId, {
              id: playerId,
              player_id: playerId,
              nickname: rs.profile?.nickname || rs.profile?.name || 'Sem nome',
              avatar_url: rs.profile?.avatar_url || null,
              level: rs.profile?.level || null,
              gols: rs.goals || 0,
              assistencias: rs.assists || 0,
              vitorias: rs.victories || 0,
              empates: rs.draws || 0,
              derrotas: rs.defeats || 0,
              pontos_totais: rs.total_points || 0,
              presencas: 1,
              cartoes_amarelos: rs.yellow_cards || 0,
              cartoes_azuis: rs.blue_cards || 0,
              saldo_gols: rs.goal_difference || 0,
              gols_contra: rs.own_goals || 0,
            });
          }
        });
      }

      // Buscar e aplicar ajustes da temporada
      if (selectedSeason !== null) {
        const { data: adjustments } = await supabase
          .from("player_ranking_adjustments")
          .select("player_id, adjustment_type, adjustment_value, season_year")
          .or(`season_year.is.null,season_year.eq.${selectedSeason}`);

        if (adjustments && adjustments.length > 0) {
          adjustments.forEach((adj: any) => {
            const player = playerMap.get(adj.player_id);
            if (!player) return;

            const value = adj.adjustment_value || 0;
            switch (adj.adjustment_type) {
              case 'gols': player.gols += value; break;
              case 'assistencias': player.assistencias += value; break;
              case 'vitorias': player.vitorias += value; break;
              case 'empates': player.empates += value; break;
              case 'derrotas': player.derrotas += value; break;
              case 'presencas': player.presencas += value; break;
              case 'cartoes_amarelos': player.cartoes_amarelos += value; break;
              case 'cartoes_azuis': player.cartoes_azuis += value; break;
              case 'saldo_gols': player.saldo_gols += value; break;
              case 'pontos_totais': player.pontos_totais += value; break;
            }
          });
        }
      }

      // Converter map para array e ordenar
      const sorted = Array.from(playerMap.values()).sort((a, b) => b.pontos_totais - a.pontos_totais);
      setRankings(sorted);

    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  };

  const getStatValue = (player: PlayerRanking, type: FilterType): number => {
    switch (type) {
      case "goals": return player.gols;
      case "assists": return player.assistencias;
      case "presences": return player.presencas;
      case "wins": return player.vitorias;
      case "draws": return player.empates;
      case "defeats": return player.derrotas;
      case "ownGoals": return player.gols_contra;
      case "yellowCards": return player.cartoes_amarelos;
      case "blueCards": return player.cartoes_azuis;
      case "goalDiff": return player.saldo_gols;
      default: return 0;
    }
  };

  // Ordenar e filtrar por tipo de estatística e nível
  const sortedStats = useMemo(() => {
    let filtered = [...rankings];

    // Filtrar por nível se selecionado
    if (selectedLevel !== null) {
      filtered = filtered.filter(p => p.level === selectedLevel);
    }

    // Ordenar pelo tipo de estatística
    switch (filterType) {
      case "goals": filtered.sort((a, b) => b.gols - a.gols); break;
      case "assists": filtered.sort((a, b) => b.assistencias - a.assistencias); break;
      case "presences": filtered.sort((a, b) => b.presencas - a.presencas); break;
      case "wins": filtered.sort((a, b) => b.vitorias - a.vitorias); break;
      case "draws": filtered.sort((a, b) => b.empates - a.empates); break;
      case "defeats": filtered.sort((a, b) => b.derrotas - a.derrotas); break;
      case "ownGoals": filtered.sort((a, b) => b.gols_contra - a.gols_contra); break;
      case "yellowCards": filtered.sort((a, b) => b.cartoes_amarelos - a.cartoes_amarelos); break;
      case "blueCards": filtered.sort((a, b) => b.cartoes_azuis - a.cartoes_azuis); break;
      case "goalDiff": filtered.sort((a, b) => b.saldo_gols - a.saldo_gols); break;
    }

    // Remover jogadores com 0 na estatística selecionada (exceto saldo que pode ser negativo)
    if (filterType === "goalDiff") {
      return filtered.filter(p => p.saldo_gols !== 0);
    }
    return filtered.filter(p => getStatValue(p, filterType) > 0);
  }, [rankings, filterType, selectedLevel]);

  // Top player para card destacado
  const topPlayer = sortedStats[0];
  const otherPlayers = sortedStats.slice(1);

  const filterButtons = [
    { type: "goals" as FilterType, icon: Trophy, label: "Gols" },
    { type: "assists" as FilterType, icon: Target, label: "Assist." },
    { type: "presences" as FilterType, icon: UserCheck, label: "Presenças" },
    { type: "wins" as FilterType, icon: Award, label: "Vitórias" },
    { type: "draws" as FilterType, icon: Equal, label: "Empates" },
    { type: "defeats" as FilterType, icon: TrendingDown, label: "Derrotas" },
    { type: "ownGoals" as FilterType, icon: AlertCircle, label: "G. Contra" },
    { type: "yellowCards" as FilterType, icon: Square, label: "C. Amarelo" },
    { type: "blueCards" as FilterType, icon: Square, label: "C. Azul" },
    { type: "goalDiff" as FilterType, icon: TrendingUp, label: "Saldo" },
  ];

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white flex flex-col relative">
      {/* Background Gradient */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-pink-900/20 via-[#0e0e10]/80 to-[#0e0e10] pointer-events-none z-0" />

      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      <Header />

      {/* Filter Drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onApply={handleApplyFilters}
        currentFilters={currentFilters}
        seasons={seasons}
        availableMonths={availableMonths}
        rounds={rounds}
        showLevel={true}
        showRounds={true}
      />

      <main className="flex-1 flex flex-col relative z-10">
        {/* Top Bar - Simplified */}
        <div className="sticky top-0 z-30 bg-[#0e0e10]/95 backdrop-blur border-b border-white/10">
          <div className="container mx-auto px-4 py-2 md:py-3">
            <div className="flex items-center justify-between gap-2">
              {/* Filter Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterDrawerOpen(true)}
                className="rounded-full gap-2 border-white/10 bg-[#1c1c1e] hover:bg-white/10 text-white"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {(selectedMonth !== null || selectedLevel !== null || selectedRoundId !== null) && (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-pink-500 text-white">
                    {[selectedMonth !== null, selectedLevel !== null, selectedRoundId !== null].filter(Boolean).length}
                  </span>
                )}
              </Button>

              <h1 className="text-xl font-bold text-pink-300 flex-1 text-center">
                Estatísticas
              </h1>

              <div className="w-10" />
            </div>

            {/* Active Filters Badge */}
            {(selectedMonth !== null || selectedLevel !== null || selectedRoundId !== null) && (
              <div className="mt-2">
                <FilterBadge filters={currentFilters} seasons={seasons} rounds={rounds} showLevel={true} />
              </div>
            )}
          </div>
        </div>

        {/* Stats Type Filter - Always visible */}
        <div className="sticky top-[52px] z-20 bg-[#0e0e10]/95 backdrop-blur border-b border-white/10">
          <div className="container mx-auto px-4 py-2">
            <div
              className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-1"
              style={{
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-x',
                scrollSnapType: 'x mandatory'
              }}
            >
              {filterButtons.map(({ type, icon: Icon, label }) => (
                <Button
                  key={type}
                  variant={filterType === type ? "default" : "outline"}
                  onClick={() => setFilterType(type)}
                  className={cn(
                    "flex-shrink-0 rounded-full snap-start text-xs px-3",
                    filterType === type
                      ? "bg-pink-500 hover:bg-pink-600 text-white border-pink-500"
                      : "border-white/10 bg-[#1c1c1e] hover:bg-white/10 text-white"
                  )}
                  size="sm"
                >
                  <Icon className="h-3.5 w-3.5 mr-1.5" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 container mx-auto px-4 py-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-2xl" />
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : sortedStats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum resultado encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {/* Top Player Card */}
              {topPlayer && (
                <div
                  onClick={() => navigate(`/profile/${topPlayer.player_id}`)}
                  className="relative overflow-hidden bg-gradient-to-br from-[#1c1c1e] to-[#252528] rounded-2xl p-5 border border-white/10 shadow-xl cursor-pointer group hover:border-pink-500/30 transition-all duration-300"
                >
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/10 blur-[50px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />

                  <div className="relative z-10 flex items-center gap-4">
                    {/* Avatar Grande */}
                    <div className="relative">
                      <Avatar className="h-28 w-28 border-4 border-white/10 shadow-2xl group-hover:border-white/20 transition-all">
                        {topPlayer.avatar_url ? (
                          <AvatarImage src={topPlayer.avatar_url} alt={topPlayer.nickname} className="object-cover" />
                        ) : (
                          <AvatarFallback className="text-4xl bg-pink-500/20 text-pink-300">
                            {topPlayer.nickname.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider">1º Lugar</span>
                      <h2 className="text-xl font-bold text-white truncate group-hover:text-pink-300 transition-colors">
                        {topPlayer.nickname}
                      </h2>
                      {topPlayer.level && (
                        <span className="text-xs text-gray-400">Nível {topPlayer.level}</span>
                      )}
                    </div>

                    {/* Valor Grande */}
                    <div className="text-right">
                      <span className="text-4xl font-black text-white">
                        {getStatValue(topPlayer, filterType)}
                      </span>
                      <span className="text-xs text-gray-400 block font-medium mt-0.5">
                        {filterButtons.find(f => f.type === filterType)?.label}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de outros jogadores */}
              <div className="space-y-2">
                {otherPlayers.map((player, index) => (
                  <div
                    key={player.player_id}
                    onClick={() => navigate(`/profile/${player.player_id}`)}
                    className="group flex items-center p-3 rounded-xl bg-[#1c1c1e] border border-white/5 hover:bg-white/5 hover:border-pink-500/20 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                  >
                    {/* Posição */}
                    <span className="w-8 text-center font-bold text-lg text-pink-300/80">
                      {index + 2}
                    </span>

                    {/* Avatar */}
                    <Avatar className="h-10 w-10 ml-2 ring-2 ring-white/10 group-hover:ring-pink-500/30 transition-all">
                      {player.avatar_url ? (
                        <AvatarImage src={player.avatar_url} alt={player.nickname} className="object-cover" />
                      ) : (
                        <AvatarFallback className="text-xs">
                          {player.nickname.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0 ml-3">
                      <div className="font-bold text-sm text-white truncate group-hover:text-pink-300 transition-colors">
                        {player.nickname}
                      </div>
                      {player.level && (
                        <span className="text-xs text-gray-500">Nível {player.level}</span>
                      )}
                    </div>

                    {/* Valor */}
                    <span className="font-black text-xl text-white ml-2">
                      {getStatValue(player, filterType)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
