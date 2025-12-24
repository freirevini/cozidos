import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Info, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SeasonSelector, MonthChips, LevelSelector, PlayerRankItem, PlayerStatsDrawer } from "@/components/classification";
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

const PAGE_SIZE = 20;

export default function Classification() {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);

  // Player details drawer
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Pagination state
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Season/Month/Level filters
  const [seasons, setSeasons] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(new Date().getFullYear());
  const [availableMonths, setAvailableMonths] = useState<number[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabType>("todos");
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

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
  }, [selectedSeason]);

  const loadSeasons = async () => {
    try {
      // Get unique years from rounds table
      const { data, error } = await supabase
        .from("rounds")
        .select("scheduled_date")
        .not("scheduled_date", "is", null);

      if (error) throw error;

      const years = [...new Set(
        data?.map(r => new Date(r.scheduled_date!).getFullYear()) || []
      )].sort((a, b) => b - a);

      if (years.length > 0) {
        setSeasons(years);
        setSelectedSeason(years[0]);
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
      const { data, error } = await supabase
        .from("rounds")
        .select("scheduled_date")
        .not("scheduled_date", "is", null)
        .gte("scheduled_date", `${selectedSeason}-01-01`)
        .lte("scheduled_date", `${selectedSeason}-12-31`);

      if (error) throw error;

      const months = [...new Set(
        data?.map(r => new Date(r.scheduled_date!).getMonth() + 1) || []
      )].sort((a, b) => a - b);

      setAvailableMonths(months);
    } catch (error) {
      console.error("Erro ao carregar meses:", error);
      setAvailableMonths([]);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data: rankings, error } = await supabase.from("player_rankings").select(`
          *,
          profiles!inner(avatar_url, level)
        `).order("pontos_totais", { ascending: false }).limit(1000);

      if (error) {
        console.error("Erro ao carregar rankings:", error);
        return;
      }

      if (!rankings) {
        setStats([]);
        return;
      }

      const mappedStats: PlayerStats[] = rankings.map(rank => ({
        player_id: rank.player_id,
        nickname: rank.nickname,
        avatar_url: rank.profiles?.avatar_url || null,
        level: rank.profiles?.level || null,
        presencas: rank.presencas,
        vitorias: rank.vitorias,
        empates: rank.empates,
        derrotas: rank.derrotas,
        atrasos: rank.atrasos,
        faltas: rank.faltas,
        punicoes: rank.punicoes,
        cartoes_amarelos: rank.cartoes_amarelos,
        cartoes_azuis: rank.cartoes_azuis,
        gols: rank.gols,
        assistencias: rank.assistencias,
        pontos_totais: rank.pontos_totais
      }));
      setStats(mappedStats);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadStats();
      toast.success("Classificação atualizada!");
    },
    enabled: true
  });

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
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

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
    E: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Pull to Refresh Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 transition-all"
          style={{
            transform: `translateY(${Math.min(pullDistance, 60)}px)`,
            opacity: Math.min(pullDistance / 60, 1)
          }}
        >
          <div className="bg-primary/90 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">
              {isRefreshing ? 'Atualizando...' : 'Solte para atualizar'}
            </span>
          </div>
        </div>
      )}

      <Header />

      <main className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/50">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <SeasonSelector
                seasons={seasons}
                selectedSeason={selectedSeason}
                onSeasonChange={setSelectedSeason}
              />

              <h1 className="text-xl font-bold text-primary flex-1 text-center">
                Classificação
              </h1>

              <AlertDialog open={showRules} onOpenChange={setShowRules}>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
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
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-background border-b border-border/30">
          <div className="container mx-auto px-4 py-3">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedTab("todos");
                  setSelectedLevel(null);
                }}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-medium transition-all",
                  selectedTab === "todos"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                Todos
              </button>
              <button
                onClick={() => setSelectedTab("nivel")}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-medium transition-all",
                  selectedTab === "nivel"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                Nível
              </button>
            </div>
          </div>
        </div>

        {/* Sub-filters */}
        <div className="bg-background/50 border-b border-border/20">
          <div className="container mx-auto px-4 py-3 space-y-3">
            {selectedTab === "todos" ? (
              <MonthChips
                availableMonths={availableMonths}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
              />
            ) : (
              <>
                <LevelSelector
                  selectedLevel={selectedLevel}
                  onLevelChange={setSelectedLevel}
                />
                {/* Month filter for Level tab */}
                <MonthChips
                  availableMonths={availableMonths}
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                />
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 container mx-auto">
          {loading ? (
            <div className="px-4 py-4 space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border-b border-border/30">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Mobile: Lista vertical MLS-style */}
              <div className="lg:hidden">
                {filteredStats.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Nenhum jogador encontrado
                  </div>
                ) : (
                  <>
                    {filteredStats.map((stat, index) => (
                      <PlayerRankItem
                        key={stat.player_id}
                        rank={index + 1}
                        nickname={stat.nickname}
                        avatarUrl={stat.avatar_url}
                        level={stat.level}
                        points={stat.pontos_totais}
                        presence={stat.presencas}
                        onClick={() => {
                          setSelectedPlayer(stat);
                          setDrawerOpen(true);
                        }}
                      />
                    ))}

                    {/* Count indicator */}
                    <div className="text-center py-3 text-sm text-muted-foreground">
                      Total: {filteredStats.length} jogadores
                    </div>
                  </>
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
                    {paginatedStats.map((stat, index) => (
                      <TableRow
                        key={stat.player_id}
                        className="border-border/30 hover:bg-muted/10 cursor-pointer"
                        onClick={() => {
                          setSelectedPlayer(stat);
                          setDrawerOpen(true);
                        }}
                      >
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
                            {stat.level && (
                              <span
                                className={cn(
                                  "px-2 py-0.5 text-xs font-bold rounded-full border",
                                  levelColors[stat.level] || "bg-muted/30"
                                )}
                              >
                                {stat.level}
                              </span>
                            )}
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Infinite scroll loader for desktop */}
                {hasMore && (
                  <div ref={loaderRef} className="flex justify-center py-4">
                    {loadingMore && (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    )}
                  </div>
                )}

                {/* Count indicator */}
                <div className="text-center py-3 text-sm text-muted-foreground">
                  Exibindo {paginatedStats.length} de {filteredStats.length} jogadores
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Player Stats Drawer */}
      <PlayerStatsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        player={selectedPlayer}
        selectedYear={selectedSeason}
        selectedMonth={selectedMonth}
      />

      <Footer />
    </div>
  );
}
