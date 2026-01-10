import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FilterDrawer, { FilterState, FilterBadge } from "@/components/FilterDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          pontos_totais: rank.pontos_totais || 0
        }));
        setStats(mappedStats);
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
          if (!rs.profile?.is_player || rs.profile?.status !== 'aprovado') return;

          const playerId = rs.player_id;
          const existing = playerMap.get(playerId);

          if (existing) {
            existing.presencas += rs.presence_points || 0;
            existing.vitorias += rs.victories || 0;
            existing.empates += rs.draws || 0;
            existing.derrotas += rs.defeats || 0;
            existing.gols += rs.goals || 0;
            existing.assistencias += rs.assists || 0;
            existing.cartoes_amarelos += rs.yellow_cards || 0;
            existing.cartoes_azuis += rs.blue_cards || 0;
            existing.pontos_totais += rs.total_points || 0;
          } else {
            playerMap.set(playerId, {
              player_id: playerId,
              nickname: rs.profile?.nickname || rs.profile?.name || 'Sem nome',
              avatar_url: rs.profile?.avatar_url || null,
              level: rs.profile?.level || null,
              presencas: rs.presence_points || 0,
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
              pontos_totais: rs.total_points || 0
            });
          }
        });

        // Converter para array e ordenar por pontos
        const sortedStats = Array.from(playerMap.values())
          .sort((a, b) => b.pontos_totais - a.pontos_totais);

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
  return <div className="min-h-screen bg-[#0e0e10] text-white flex flex-col">
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

    <main className="flex-1 flex flex-col">
      {/* Top Bar - Simplified */}
      <div className="sticky top-0 z-30 bg-[#0e0e10] border-b border-white/10">
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
              <AlertDialogContent className="border-border max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-primary text-xl">
                    📊 Regras de Pontuação
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="text-foreground space-y-4 mt-4">
                      <div className="space-y-2">
                        <h3 className="font-bold text-sm text-primary">Pontos Individuais:</h3>
                        <ul className="space-y-1 text-sm">
                          <li>✅ Presença: +10 pts</li>
                          <li>⏰ Atraso: -5 pts</li>
                          <li>❌ Falta: -10 pts</li>
                          <li>🟨 Amarelo: -1 pt</li>
                          <li>🟦 Azul: -2 pts</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-bold text-sm text-primary">Pontos Coletivos:</h3>
                        <ul className="space-y-1 text-sm">
                          <li>🏆 Vitória: +3 pts</li>
                          <li>🤝 Empate: +1 pt</li>
                          <li>⚽ Gol: +1 pt</li>
                          <li>🎯 Assistência: +2 pts</li>
                        </ul>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogAction className="bg-primary hover:bg-primary/90">
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
      <div className="flex-1 container mx-auto">
        {loading ? <div className="px-4 py-4 space-y-2">
          {Array.from({
            length: 10
          }).map((_, i) => <div key={i} className="flex items-center gap-3 p-3 border-b border-border/30">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-8 w-16" />
          </div>)}
        </div> : <>
          {/* Mobile: Lista com scroll nativo */}
          <div className="lg:hidden px-2 pb-24">
            {filteredStats.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum jogador encontrado
              </div>
            ) : (
              <div className="space-y-1">
                {paginatedStats.map((stat, index) => (
                  <PlayerRankItem
                    key={stat.player_id}
                    rank={index + 1}
                    nickname={stat.nickname}
                    avatarUrl={stat.avatar_url}
                    level={stat.level}
                    points={stat.pontos_totais}
                    presence={stat.presencas}
                    onClick={() => navigate(`/profile/${stat.player_id}`)}
                  />
                ))}
                {/* Loader para infinite scroll */}
                {hasMore && (
                  <div ref={loaderRef} className="flex justify-center py-4">
                    {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop: Tabela completa */}
          <div className="hidden lg:block overflow-x-auto px-4 py-4">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-primary font-bold w-12">#</TableHead>
                  <TableHead className="text-primary font-bold min-w-[180px]">Jogador</TableHead>
                  <TableHead className="text-primary font-bold text-center">PTS</TableHead>
                  <TableHead className="text-primary font-bold text-center">PR</TableHead>
                  <TableHead className="text-primary font-bold text-center">V</TableHead>
                  <TableHead className="text-primary font-bold text-center">E</TableHead>
                  <TableHead className="text-primary font-bold text-center">D</TableHead>
                  <TableHead className="text-primary font-bold text-center">⚽</TableHead>
                  <TableHead className="text-primary font-bold text-center">🎯</TableHead>
                  <TableHead className="text-primary font-bold text-center">🟨</TableHead>
                  <TableHead className="text-primary font-bold text-center">🟦</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStats.map((stat, index) => <TableRow key={stat.player_id} className="border-border/30 hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`/profile/${stat.player_id}`)}>
                  <TableCell className="font-bold text-primary text-lg">{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border-2 border-border/50 bg-muted">
                        <AvatarImage src={stat.avatar_url || undefined} alt={stat.nickname} />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                          {stat.nickname?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{stat.nickname}</span>
                      {stat.level && <span className={cn("px-2 py-0.5 text-xs font-bold rounded-full border", levelColors[stat.level] || "bg-muted/30")}>
                        {stat.level}
                      </span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-bold text-primary text-lg">
                    {stat.pontos_totais}
                  </TableCell>
                  <TableCell className="text-center text-foreground">{stat.presencas}</TableCell>
                  <TableCell className="text-center text-foreground">{stat.vitorias}</TableCell>
                  <TableCell className="text-center text-foreground">{stat.empates}</TableCell>
                  <TableCell className="text-center text-foreground">{stat.derrotas}</TableCell>
                  <TableCell className="text-center text-foreground">{stat.gols}</TableCell>
                  <TableCell className="text-center text-foreground">{stat.assistencias}</TableCell>
                  <TableCell className="text-center text-foreground">{stat.cartoes_amarelos}</TableCell>
                  <TableCell className="text-center text-foreground">{stat.cartoes_azuis}</TableCell>
                </TableRow>)}
              </TableBody>
            </Table>

            {/* Infinite scroll loader for desktop */}
            {hasMore && <div ref={loaderRef} className="flex justify-center py-4">
              {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            </div>}

            {/* Count indicator */}
            <div className="text-center py-3 text-sm text-muted-foreground">
              Exibindo {paginatedStats.length} de {filteredStats.length} jogadores
            </div>
          </div>
        </>}
      </div>
    </main>

    <Footer />
  </div>;
}