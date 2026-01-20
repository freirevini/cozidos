import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FilterDrawer, { FilterState, FilterBadge } from "@/components/FilterDrawer";
import { Skeleton } from "@/components/ui/skeleton";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import { Info, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { motion } from "framer-motion";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SeasonSelector, MonthChips, LevelSelector, PlayerRankItem } from "@/components/classification";
import { cn } from "@/lib/utils";
interface PlayerStats {
  player_id: string;
  nickname: string;
  avatar_url: string | null;
  level: string | null;
  presencas: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  atrasos: number;
  faltas: number;
  punicoes: number;
  cartoes_amarelos: number;
  cartoes_azuis: number;
  gols: number;
  assistencias: number;
  saldo_gols: number;
  pontos_totais: number;
}
type TabType = "todos" | "nivel";
const PAGE_SIZE = 200;
export default function Classification() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);

  // Pagination state
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Season/Month/Level filters
  const [seasons, setSeasons] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(new Date().getFullYear());
  const [availableMonths, setAvailableMonths] = useState<number[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabType>("todos");
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  // Filter drawer state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const handleApplyFilters = (filters: FilterState) => {
    setSelectedSeason(filters.season);
    setSelectedMonth(filters.month);
    setSelectedLevel(filters.level);
    // If level is selected, switch to nivel tab
    if (filters.level) {
      setSelectedTab("nivel");
    }
  };

  const currentFilters: FilterState = {
    season: selectedSeason,
    month: selectedMonth,
    level: selectedLevel,
    roundId: null,
  };
  useEffect(() => {
    loadSeasons();
    loadStats();
    const channel = supabase.channel('player_rankings_changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'player_rankings'
    }, () => {
      loadStats();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  useEffect(() => {
    loadAvailableMonths();
    loadStats(); // Recarregar quando o ano mudar
  }, [selectedSeason]);
  const loadSeasons = async () => {
    try {
      // Get unique years from rounds table
      const {
        data,
        error
      } = await supabase.from("rounds").select("scheduled_date").not("scheduled_date", "is", null);
      if (error) throw error;
      // Sort years descending (most recent first)
      const years = [...new Set(data?.map(r => new Date(r.scheduled_date!).getFullYear()) || [])].sort((a, b) => b - a);
      if (years.length > 0) {
        setSeasons(years);
        // Default to current year if available, otherwise most recent
        const currentYear = new Date().getFullYear();
        if (years.includes(currentYear)) {
          setSelectedSeason(currentYear);
        } else {
          setSelectedSeason(years[0]);
        }
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

      // Only filter by year if a specific season is selected (not "Todos")
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
  // Função de ordenação com critérios de desempate
  const sortPlayers = (a: PlayerStats, b: PlayerStats) => {
    // 1. Mais pontos totais
    if (a.pontos_totais !== b.pontos_totais) return b.pontos_totais - a.pontos_totais;
    // 2. Mais presenças
    if (a.presencas !== b.presencas) return b.presencas - a.presencas;
    // 3. Mais vitórias
    if (a.vitorias !== b.vitorias) return b.vitorias - a.vitorias;
    // 4. Maior saldo de gols
    if (a.saldo_gols !== b.saldo_gols) return b.saldo_gols - a.saldo_gols;
    // 5. Menos cartões (Azul + Amarelo)
    const cardsA = (a.cartoes_amarelos || 0) + (a.cartoes_azuis || 0);
    const cardsB = (b.cartoes_amarelos || 0) + (b.cartoes_azuis || 0);
    if (cardsA !== cardsB) return cardsA - cardsB; // Menos é melhor
    // 6. Mais assistências
    if (a.assistencias !== b.assistencias) return b.assistencias - a.assistencias;
    // 7. Mais gols feitos
    if (a.gols !== b.gols) return b.gols - a.gols;
    // 8. Menos derrotas
    if (a.derrotas !== b.derrotas) return a.derrotas - b.derrotas; // Menos é melhor

    return a.nickname.localeCompare(b.nickname);
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      // Se "Todos" (null), buscar do player_rankings (total consolidado)
      if (selectedSeason === null) {
        const { data: rankings, error } = await supabase
          .from("player_rankings")
          .select(`*, profiles!inner(avatar_url, level)`)
          .order("pontos_totais", { ascending: false })
          .limit(1000);

        if (error) throw error;

        const mappedStats: PlayerStats[] = (rankings || []).map(rank => ({
          player_id: rank.player_id,
          nickname: rank.nickname,
          avatar_url: rank.profiles?.avatar_url || null,
          level: rank.profiles?.level || null,
          presencas: rank.presencas || 0,
          vitorias: rank.vitorias || 0,
          empates: rank.empates || 0,
          derrotas: rank.derrotas || 0,
          atrasos: rank.atrasos || 0,
          faltas: rank.faltas || 0,
          punicoes: rank.punicoes || 0,
          cartoes_amarelos: rank.cartoes_amarelos || 0,
          cartoes_azuis: rank.cartoes_azuis || 0,
          gols: rank.gols || 0,
          assistencias: rank.assistencias || 0,
          saldo_gols: rank.saldo_gols || 0,
          pontos_totais: rank.pontos_totais || 0
        }));

        // Ordenar client-side para garantir critérios de desempate
        setStats(mappedStats.sort(sortPlayers));
      } else {
        // Filtrar por ano específico - buscar de player_round_stats
        const { data: roundStats, error } = await supabase
          .from("player_round_stats")
          .select(`
            player_id,
            goals,
            assists,
            victories,
            draws,
            defeats,
            presence_points,
            yellow_cards,
            blue_cards,
            goal_difference,
            total_points,
            round:rounds!inner(scheduled_date),
            profile:profiles!inner(nickname, name, avatar_url, level, is_player, status)
          `)
          .gte("round.scheduled_date", `${selectedSeason}-01-01`)
          .lte("round.scheduled_date", `${selectedSeason}-12-31`);

        if (error) throw error;

        // Agrupar por jogador e somar estatísticas
        const playerMap = new Map<string, PlayerStats>();

        (roundStats || []).forEach((rs: any) => {
          if (!rs.profile?.is_player || rs.profile?.status !== 'aprovado' || rs.profile?.is_guest) return;

          const playerId = rs.player_id;
          const existing = playerMap.get(playerId);

          if (existing) {
            existing.presencas += (rs.presence_points || 0) > 0 ? 1 : 0; // Contar rodadas, não pontos
            existing.vitorias += rs.victories || 0;
            existing.empates += rs.draws || 0;
            existing.derrotas += rs.defeats || 0;
            existing.gols += rs.goals || 0;
            existing.assistencias += rs.assists || 0;
            existing.cartoes_amarelos += rs.yellow_cards || 0;
            existing.cartoes_azuis += rs.blue_cards || 0;
            existing.saldo_gols += rs.goal_difference || 0;
            existing.pontos_totais += rs.total_points || 0;
          } else {
            playerMap.set(playerId, {
              player_id: playerId,
              nickname: rs.profile?.nickname || rs.profile?.name || 'Sem nome',
              avatar_url: rs.profile?.avatar_url || null,
              level: rs.profile?.level || null,
              presencas: (rs.presence_points || 0) > 0 ? 1 : 0, // Contar rodada
              vitorias: rs.victories || 0,
              empates: rs.draws || 0,
              derrotas: rs.defeats || 0,
              atrasos: 0,
              faltas: 0,
              punicoes: 0,
              cartoes_amarelos: rs.yellow_cards || 0,
              cartoes_azuis: rs.blue_cards || 0,
              gols: rs.goals || 0,
              assistencias: rs.assists || 0,
              saldo_gols: rs.goal_difference || 0,
              pontos_totais: rs.total_points || 0
            });
          }
        });

        // Converter para array e ordenar com critérios de desempate
        const sortedStats = Array.from(playerMap.values())
          .sort(sortPlayers);

        setStats(sortedStats);
      }
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };
  const {
    isRefreshing,
    pullDistance
  } = usePullToRefresh({
    onRefresh: async () => {
      await loadStats();
      toast.success("Classificação atualizada!");
    },
    enabled: true
  });

  // Hide filters on scroll down (mobile only)
  const isFiltersVisible = useScrollDirection({ threshold: 15 });
  const filteredStats = useMemo(() => {
    let result = [...stats];

    // Filter by level if tab is "nivel" and a level is selected
    if (selectedTab === "nivel" && selectedLevel) {
      result = result.filter(s => s.level === selectedLevel);
    }
    return result;
  }, [stats, selectedTab, selectedLevel]);

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedCount(PAGE_SIZE);
  }, [selectedTab, selectedLevel, selectedMonth, selectedSeason]);

  // Paginated stats
  const paginatedStats = useMemo(() => {
    return filteredStats.slice(0, displayedCount);
  }, [filteredStats, displayedCount]);
  const hasMore = displayedCount < filteredStats.length;

  // Infinite scroll observer
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount(prev => Math.min(prev + PAGE_SIZE, filteredStats.length));
      setLoadingMore(false);
    }, 100);
  }, [loadingMore, hasMore, filteredStats.length]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMore();
      }
    }, {
      threshold: 0.1,
      rootMargin: "100px"
    });
    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);
  const levelColors: Record<string, string> = {
    A: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    D: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    E: "bg-red-500/20 text-red-400 border-red-500/30"
  };
  // Top player para card destacado
  const topPlayer = filteredStats[0];
  const otherPlayers = paginatedStats.slice(1);

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
        showLevel={true}
        showRounds={false}
      />

      <main className="flex-1 flex flex-col relative z-10">
        {/* Top Bar - Simplified */}
        <div className="sticky top-0 z-30 bg-[#0e0e10]/95 backdrop-blur border-b border-white/10">
          <div className="container mx-auto px-4 py-3">
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
                {(selectedMonth !== null || selectedLevel !== null) && (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-pink-500 text-white">
                    {[selectedMonth !== null, selectedLevel !== null].filter(Boolean).length}
                  </span>
                )}
              </Button>

              <h1 className="text-xl font-bold text-pink-300 flex-1 text-center">
                Classificação
              </h1>

              <AlertDialog open={showRules} onOpenChange={setShowRules}>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10 text-gray-400 hover:text-white">
                    <Info className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-border max-w-md bg-[#1c1c1e] text-white my-auto max-h-[90vh] overflow-y-auto">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-pink-300 text-xl">
                      📊 Regras de Pontuação
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="text-gray-300 space-y-4 mt-4">
                        <div className="space-y-2">
                          <h3 className="font-bold text-sm text-green-400">Pontos Ganhos:</h3>
                          <ul className="space-y-1 text-sm list-disc pl-4">
                            <li>✅ Presença: +3 pts</li>
                            <li>🏆 Vitória: +3 pts</li>
                            <li>🤝 Empate: +1 pt</li>
                            <li>📊 Saldo de gols positivo: +N pts (igual ao saldo)</li>
                            <li>🧤 Clean sheet (não tomar gol): +2 pts</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-bold text-sm text-red-400">Penalidades:</h3>
                          <ul className="space-y-1 text-sm list-disc pl-4">
                            <li>⏰ Atraso: -10 pts</li>
                            <li>❌ Falta: -20 pts</li>
                            <li>🟨 Cartão Amarelo: -1 pt</li>
                            <li>🟦 Cartão Azul: -2 pts</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-bold text-sm text-blue-400">Critérios de Desempate (Ordem):</h3>
                          <ol className="space-y-1 text-sm list-decimal pl-4">
                            <li>Mais pontos totais</li>
                            <li>Mais presenças</li>
                            <li>Mais vitórias</li>
                            <li>Maior saldo de gols</li>
                            <li>Menos cartões (Azul + Amarelo)</li>
                            <li>Mais assistências</li>
                            <li>Mais gols feitos</li>
                            <li>Menos derrotas</li>
                          </ol>
                        </div>
                        <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-white/10">
                          ⚠️ Pontuação mínima é 0 (não fica negativa)
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogAction className="bg-pink-500 hover:bg-pink-600 text-white border-none">
                      Entendido
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Active Filters Badge */}
            {(selectedMonth !== null || selectedLevel !== null) && (
              <div className="mt-2">
                <FilterBadge filters={currentFilters} seasons={seasons} showLevel={true} />
              </div>
            )}
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
          ) : filteredStats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum jogador encontrado
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
                      <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider">Líder</span>
                      <h2 className="text-xl font-bold text-white truncate group-hover:text-pink-300 transition-colors">
                        {topPlayer.nickname}
                      </h2>
                      <div className="flex flex-col gap-1 mt-2">
                        {topPlayer.level && (
                          <span className="self-start px-2.5 py-0.5 text-xs font-bold rounded bg-[#472639] text-[#F9A8D4]">
                            Nível {topPlayer.level}
                          </span>
                        )}
                        <span className="text-sm text-gray-400 font-medium">
                          {topPlayer.presencas}P • {topPlayer.vitorias}V • {topPlayer.empates}E • {topPlayer.derrotas}D • {topPlayer.saldo_gols}S
                        </span>
                      </div>
                    </div>

                    {/* Valor Grande */}
                    <div className="text-right">
                      <span className="text-4xl font-black text-white">
                        {topPlayer.pontos_totais}
                      </span>
                      <span className="text-xs text-gray-400 block font-medium mt-0.5">
                        pontos
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de outros jogadores */}
              <div className="space-y-2">
                {otherPlayers.map((stat, index) => (
                  <div
                    key={stat.player_id}
                    onClick={() => navigate(`/profile/${stat.player_id}`)}
                    className="group flex items-center p-3 rounded-xl bg-[#1c1c1e] border border-white/5 hover:bg-white/5 hover:border-pink-500/20 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                  >
                    {/* Posição */}
                    <span className="w-8 text-center font-bold text-lg text-pink-300/80">
                      {index + 2}
                    </span>

                    {/* Avatar */}
                    <Avatar className="h-10 w-10 ml-2 ring-2 ring-white/10 group-hover:ring-pink-500/30 transition-all">
                      {stat.avatar_url ? (
                        <AvatarImage src={stat.avatar_url} alt={stat.nickname} className="object-cover" />
                      ) : (
                        <AvatarFallback className="text-xs">
                          {stat.nickname.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0 ml-3">
                      <div className="font-bold text-sm text-white truncate group-hover:text-pink-300 transition-colors">
                        {stat.nickname}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {stat.level && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-[#472639] text-[#F9A8D4]">
                            Nível {stat.level}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {stat.presencas}P • {stat.vitorias}V • {stat.empates}E • {stat.derrotas}D • {stat.saldo_gols}S
                        </span>
                      </div>
                    </div>

                    {/* Valor */}
                    <div className="text-right ml-2">
                      <span className="font-black text-xl text-white block">
                        {stat.pontos_totais}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">PTS</span>
                    </div>
                  </div>
                ))}

                {/* Loader para infinite scroll */}
                {hasMore && (
                  <div ref={loaderRef} className="flex justify-center py-4">
                    {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-pink-500" />}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
