import { useState, useMemo, useRef, useCallback, useEffect } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { metrics } from "@/lib/metrics";

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
  const queryClient = useQueryClient();
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

  // Função de ordenação
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

  // React Query for Classification Stats
  const { data: stats = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['classification', selectedSeason, selectedLevel],
    queryFn: async () => {
      // Usar RPC unificada
      const { data, error } = await metrics.track('get_classification', async () => {
        return await supabase.rpc('get_classification', {
          p_season_year: selectedSeason, // null = todos os tempos
          p_level: selectedLevel // null = todos os níveis
        });
      });

      if (error) throw error;

      const mappedStats: PlayerStats[] = (data || []).map(row => ({
        player_id: row.player_id,
        nickname: row.nickname,
        avatar_url: row.avatar_url,
        level: row.level,
        presencas: row.presencas,
        vitorias: row.vitorias,
        empates: row.empates,
        derrotas: row.derrotas,
        atrasos: row.atrasos,
        faltas: row.faltas,
        punicoes: row.punicoes,
        cartoes_amarelos: row.cartoes_amarelos,
        cartoes_azuis: row.cartoes_azuis,
        gols: row.gols,
        assistencias: row.assistencias,
        saldo_gols: row.saldo_gols,
        pontos_totais: row.pontos_totais
      }));

      // Aplicar ordenação
      return mappedStats.sort(sortPlayers);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes stale time
    placeholderData: (previousData) => previousData, // Keep showing previous data while fetching new filters (prevents flash)
  });

  const handleApplyFilters = (filters: FilterState) => {
    setSelectedSeason(filters.season);
    setSelectedMonth(filters.month);
    setSelectedLevel(filters.level);
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

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase.channel('player_rankings_changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'player_rankings'
    }, () => {
      // Invalidate query to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['classification'] });
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Load Seasons Effect
  useEffect(() => {
    const loadSeasons = async () => {
      try {
        const { data, error } = await supabase.from("rounds").select("scheduled_date").not("scheduled_date", "is", null);
        if (error) throw error;

        const years = [...new Set(data?.map(r => new Date(r.scheduled_date!).getFullYear()) || [])].sort((a, b) => b - a);
        if (years.length > 0) {
          setSeasons(years);
          const currentYear = new Date().getFullYear();
          if (years.includes(currentYear) && !selectedSeason) {
            setSelectedSeason(currentYear);
          } else if (!selectedSeason) {
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
    loadSeasons();
  }, []); // Run once on mount

  // Load Months Effect
  useEffect(() => {
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
    loadAvailableMonths();
  }, [selectedSeason]);

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
      toast.success("Classificação atualizada!");
    },
    enabled: true
  });

  const isFiltersVisible = useScrollDirection({ threshold: 15 });

  const filteredStats = useMemo(() => {
    let result = [...stats];
    if (selectedTab === "nivel" && selectedLevel) {
      result = result.filter(s => s.level === selectedLevel);
    }
    return result;
  }, [stats, selectedTab, selectedLevel]);

  useEffect(() => {
    setDisplayedCount(PAGE_SIZE);
  }, [selectedTab, selectedLevel, selectedMonth, selectedSeason]);

  const paginatedStats = useMemo(() => {
    return filteredStats.slice(0, displayedCount);
  }, [filteredStats, displayedCount]);

  const hasMore = displayedCount < filteredStats.length;

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
      if (entries[0].isIntersecting) {
        loadMore();
      }
    }, { threshold: 0.5 });

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }
    return () => observer.disconnect();
  }, [loadMore]);

  const handleSeasonChange = (season: number | null) => {
    setSelectedSeason(season);
    // Reset month when season changes
    setSelectedMonth(null);
  };

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <Header />

      <motion.div
        className={cn(
          "sticky top-[60px] z-30 bg-[#0e0e10]/95 backdrop-blur-sm border-b border-white/5 py-2 transition-transform duration-300 ease-in-out",
          !isFiltersVisible && "-translate-y-full opacity-0 pointer-events-none"
        )}
      >
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SeasonSelector
                seasons={seasons}
                selectedSeason={selectedSeason}
                onSelect={handleSeasonChange}
              />

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400"
                  onClick={() => setShowRules(true)}
                >
                  <Info className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 gap-2 bg-[#1c1c1e] border-white/10 text-xs font-medium hover:bg-white/5",
                    (selectedLevel || selectedMonth) && "border-pink-500 text-pink-400 bg-pink-500/10"
                  )}
                  onClick={() => setIsFilterDrawerOpen(true)}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtros
                  {(selectedLevel || selectedMonth) && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[10px] text-white">
                      {(selectedLevel ? 1 : 0) + (selectedMonth ? 1 : 0)}
                    </span>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <LevelSelector
                selectedLevel={selectedLevel}
                onSelect={(level) => {
                  setSelectedLevel(level);
                  if (level) setSelectedTab("nivel");
                  else setSelectedTab("todos");
                }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      <main className="container mx-auto px-4 py-4 max-w-4xl min-h-[calc(100vh-200px)]">
        {loading && stats.length === 0 ? (
          <div className="space-y-4 mt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {paginatedStats.length > 0 ? (
              paginatedStats.map((stat, index) => (
                <PlayerRankItem
                  key={stat.player_id}
                  stat={stat}
                  index={index + 1}
                />
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>Nenhum jogador encontrado com os filtros atuais.</p>
              </div>
            )}

            {/* Loading more indicator */}
            <div ref={loaderRef} className="py-4 flex justify-center h-10">
              {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-pink-500" />}
            </div>
          </div>
        )}
      </main>

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        currentFilters={currentFilters}
        onApplyFilters={handleApplyFilters}
        availableSeasons={seasons}
        availableMonths={availableMonths}
      />

      <AlertDialog open={showRules} onOpenChange={setShowRules}>
        <AlertDialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Regras de Pontuação (2026)</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2 text-left">
              <div className="grid gap-2 text-sm">
                <p><span className="font-bold text-white">Presença:</span> +3 pontos</p>
                <p><span className="font-bold text-white">Vitória:</span> +3 pontos</p>
                <p><span className="font-bold text-white">Empate:</span> +1 ponto</p>
                <p><span className="font-bold text-white">Bônus de Gols:</span> +1 ponto por gol de saldo (apenas nas vitórias)</p>
                <p><span className="font-bold text-white">Clean Sheet:</span> +2 pontos (ganhar sem sofrer gols)</p>
                <div className="h-px bg-white/10 my-2" />
                <p className="text-red-400"><span className="font-bold">Cartão Amarelo:</span> -1 ponto</p>
                <p className="text-red-400"><span className="font-bold">Cartão Azul:</span> -2 pontos</p>
                <p className="text-red-400"><span className="font-bold">Atraso:</span> -5 pontos</p>
                <p className="text-red-400"><span className="font-bold">Falta:</span> -10 pontos (e zera pontos de presença/vitória)</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
}
