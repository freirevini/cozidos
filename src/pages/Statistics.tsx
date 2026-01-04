import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import { SeasonSelector, MonthChips, LevelSelector, RoundSelector } from "@/components/classification";
import { Trophy, Target, Award, Equal, TrendingDown } from "lucide-react";
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
}

type FilterType = "goals" | "assists" | "wins" | "draws" | "defeats";

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

      // Se "Todos" anos e "Todos" meses, buscar do player_rankings (totais consolidados)
      if (selectedSeason === null && selectedMonth === null) {
        const { data, error } = await supabase
          .from("player_rankings")
          .select(`*, profiles!inner(avatar_url, level)`)
          .order("pontos_totais", { ascending: false })
          .limit(1000);

        if (error) throw error;

        const mapped = (data || []).map(rank => ({
          ...rank,
          avatar_url: rank.profiles?.avatar_url || null,
          level: rank.profiles?.level || null
        }));
        setRankings(mapped);
      } else {
        // Buscar de player_round_stats com filtros de ano/mês
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

        // Filtrar por mês se selecionado
        let filteredByMonth = selectedMonth !== null
          ? (roundStats || []).filter((rs: any) => {
            const month = new Date(rs.round?.scheduled_date).getMonth() + 1;
            return month === selectedMonth;
          })
          : roundStats || [];

        // Filtrar por rodada se selecionada
        if (selectedRoundId !== null) {
          filteredByMonth = filteredByMonth.filter((rs: any) => rs.round_id === selectedRoundId);
        }

        // Agrupar por jogador
        const playerMap = new Map<string, PlayerRanking>();

        filteredByMonth.forEach((rs: any) => {
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
              pontos_totais: rs.total_points || 0
            });
          }
        });

        const sorted = Array.from(playerMap.values()).sort((a, b) => b.pontos_totais - a.pontos_totais);
        setRankings(sorted);
      }
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  };

  const getStatValue = (player: PlayerRanking, type: FilterType) => {
    switch (type) {
      case "goals": return player.gols;
      case "assists": return player.assistencias;
      case "wins": return player.vitorias;
      case "draws": return player.empates;
      case "defeats": return player.derrotas;
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
      case "wins": filtered.sort((a, b) => b.vitorias - a.vitorias); break;
      case "draws": filtered.sort((a, b) => b.empates - a.empates); break;
      case "defeats": filtered.sort((a, b) => b.derrotas - a.derrotas); break;
    }

    // Remover jogadores com 0 na estatística selecionada
    return filtered.filter(p => getStatValue(p, filterType) > 0);
  }, [rankings, filterType, selectedLevel]);

  const filterButtons = [
    { type: "goals" as FilterType, icon: Trophy, label: "Artilheiros" },
    { type: "assists" as FilterType, icon: Target, label: "Assistências" },
    { type: "wins" as FilterType, icon: Award, label: "Vitórias" },
    { type: "draws" as FilterType, icon: Equal, label: "Empates" },
    { type: "defeats" as FilterType, icon: TrendingDown, label: "Derrotas" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      <Header />

      <main className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/50">
          <div className="container mx-auto px-4 py-2 md:py-3">
            <div className="flex items-center justify-between gap-4">
              <SeasonSelector seasons={seasons} selectedSeason={selectedSeason} onSeasonChange={setSelectedSeason} />

              <h1 className="text-xl font-bold text-primary flex-1 text-center">
                Estatísticas
              </h1>

              <div className="w-10" />
            </div>
          </div>
        </div>

        {/* Stats Filter Chips - Sticky */}
        <div className="sticky top-[44px] md:top-0 z-30 bg-background/95 backdrop-blur border-b border-border/30">
          <div className="container mx-auto px-4 py-2 md:py-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-1">
              {filterButtons.map(({ type, icon: Icon, label }) => (
                <Button
                  key={type}
                  variant={filterType === type ? "default" : "outline"}
                  onClick={() => setFilterType(type)}
                  className="flex-shrink-0 rounded-full"
                  size="sm"
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Round Filter - Above Level Filter */}
        {rounds.length > 0 && (
          <div className="sticky top-[88px] md:top-[52px] z-20 bg-background/95 backdrop-blur border-b border-border/20">
            <div className="container mx-auto px-4 py-2 md:py-3">
              <RoundSelector
                rounds={rounds}
                selectedRoundId={selectedRoundId}
                onRoundChange={setSelectedRoundId}
              />
            </div>
          </div>
        )}

        {/* Level Filter - Sticky */}
        <div className={cn(
          "sticky z-20 bg-background/95 backdrop-blur border-b border-border/20",
          rounds.length > 0 ? "top-[132px] md:top-[104px]" : "top-[88px] md:top-[52px]"
        )}>
          <div className="container mx-auto px-4 py-2 md:py-3">
            <LevelSelector selectedLevel={selectedLevel} onLevelChange={setSelectedLevel} />
          </div>
        </div>

        {/* Month Chips - Sticky */}
        <div className={cn(
          "sticky z-10 bg-background/95 backdrop-blur border-b border-border/20",
          rounds.length > 0 ? "top-[176px] md:top-[156px]" : "top-[132px] md:top-[104px]"
        )}>
          <div className="container mx-auto px-4 py-2 md:py-3">
            <MonthChips
              availableMonths={availableMonths}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 container mx-auto px-2 py-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : sortedStats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum resultado encontrado
            </div>
          ) : (
            <div className="space-y-2">
              {sortedStats.map((player, index) => (
                <div
                  key={player.player_id}
                  onClick={() => navigate(`/profile/${player.player_id}`)}
                  className="group flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/30 hover:bg-primary/10 hover:border-primary/40 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xl font-bold text-primary w-8 flex-shrink-0 text-center">
                      {index + 1}
                    </span>
                    <Avatar className="h-10 w-10 flex-shrink-0 bg-muted ring-2 ring-transparent group-hover:ring-primary/50 transition-all">
                      {player.avatar_url ? (
                        <AvatarImage src={player.avatar_url} alt={player.nickname} className="object-cover" />
                      ) : (
                        <AvatarFallback className="text-sm">
                          {player.nickname.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {player.nickname}
                      </div>
                      {player.level && (
                        <span className="text-xs text-muted-foreground">Nível {player.level}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white flex-shrink-0 ml-2">
                    {getStatValue(player, filterType)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
