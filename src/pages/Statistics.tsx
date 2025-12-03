import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { RefreshCw, Trophy, Target, Award, Equal, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import PlayerComparisonChart from "@/components/PlayerComparisonChart";

interface PlayerRanking {
  id: string;
  player_id: string;
  nickname: string;
  avatar_url: string | null;
  gols: number;
  assistencias: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  pontos_totais: number;
}

interface Round {
  id: string;
  round_number: number;
}

type FilterType = "goals" | "assists" | "wins" | "draws" | "defeats";

export default function Statistics() {
  const { isAdmin } = useAuth();
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("all");
  const [filterType, setFilterType] = useState<FilterType>("goals");

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadStatistics();
      toast.success("Estatísticas atualizadas!");
    },
    enabled: true,
  });

  useEffect(() => {
    loadRounds();
    
    console.log('🔌 Iniciando subscription realtime para estatísticas...');
    
    // Criar subscription para updates em tempo real
    const channel = supabase
      .channel('player_rankings_stats_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'player_rankings'
        },
        (payload) => {
          console.log('📊 Estatísticas atualizadas em tempo real:', payload);
          console.log('🔄 Tipo de evento:', payload.eventType);
          console.log('📝 Dados novos:', payload.new);
          console.log('📝 Dados antigos:', payload.old);
          // Recarregar stats quando houver mudança
          if (selectedRound === "all") {
            loadStatistics();
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscription realtime ativa para Estatísticas!');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro na subscription realtime:', err);
        }
        if (status === 'TIMED_OUT') {
          console.warn('⏱️ Timeout na subscription realtime');
        }
        console.log('📡 Status da subscription:', status);
      });

    return () => {
      console.log('🔌 Removendo subscription realtime das Estatísticas...');
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    loadStatistics();
  }, [selectedRound]);

  const loadRounds = async () => {
    try {
      const { data: roundsData } = await supabase
        .from("rounds")
        .select("id, round_number")
        .order("round_number", { ascending: true });

      setRounds(roundsData || []);
    } catch (error) {
      console.error("Erro ao carregar rodadas:", error);
    }
  };

  const loadStatistics = async () => {
    try {
      setLoading(true);

      if (selectedRound === "all") {
        // Buscar do player_rankings para ranking geral com avatar
        const { data, error } = await supabase
          .from("player_rankings")
          .select(`
            *,
            profiles!inner(avatar_url)
          `)
          .order("pontos_totais", { ascending: false })
          .limit(1000); // Cache busting

        if (error) throw error;
        
        // Mapear adicionando avatar_url
        const mappedData = (data || []).map(rank => ({
          ...rank,
          avatar_url: rank.profiles?.avatar_url || null
        }));
        
        setRankings(mappedData);
      } else {
        // Buscar do player_round_stats para rodada específica
        const { data, error } = await supabase
          .from("player_round_stats")
          .select(`
            *,
            profiles!inner(id, nickname, name, avatar_url)
          `)
          .eq("round_id", selectedRound);

        if (error) throw error;

        // Buscar gols e assistências da rodada
        const { data: matches } = await supabase
          .from("matches")
          .select("id")
          .eq("round_id", selectedRound);

        const matchIds = matches?.map(m => m.id) || [];

        const statsPromises = (data || []).map(async (stat: any) => {
          const playerId = stat.player_id;

          // Buscar gols
          const { data: goals } = await supabase
            .from("goals")
            .select("id")
            .eq("player_id", playerId)
            .eq("is_own_goal", false)
            .in("match_id", matchIds);

          // Buscar assistências
          const { data: assists } = await supabase
            .from("assists")
            .select("id, goals!inner(match_id)")
            .eq("player_id", playerId)
            .in("goals.match_id", matchIds);

          return {
            id: stat.id,
            player_id: playerId,
            nickname: stat.profiles.nickname || stat.profiles.name,
            avatar_url: stat.profiles.avatar_url || null,
            gols: goals?.length || 0,
            assistencias: assists?.length || 0,
            vitorias: stat.victories || 0,
            empates: stat.draws || 0,
            derrotas: stat.defeats || 0,
            pontos_totais: stat.total_points || 0,
          };
        });

        const roundStats = await Promise.all(statsPromises);
        setRankings(roundStats);
      }
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  };

  const getSortedStats = (type: FilterType) => {
    const sorted = [...rankings];

    switch (type) {
      case "goals":
        return sorted.sort((a, b) => b.gols - a.gols);
      case "assists":
        return sorted.sort((a, b) => b.assistencias - a.assistencias);
      case "wins":
        return sorted.sort((a, b) => b.vitorias - a.vitorias);
      case "draws":
        return sorted.sort((a, b) => b.empates - a.empates);
      case "defeats":
        return sorted.sort((a, b) => b.derrotas - a.derrotas);
      default:
        return sorted;
    }
  };

  const getStatValue = (player: PlayerRanking, type: FilterType) => {
    switch (type) {
      case "goals":
        return player.gols;
      case "assists":
        return player.assistencias;
      case "wins":
        return player.vitorias;
      case "draws":
        return player.empates;
      case "defeats":
        return player.derrotas;
      default:
        return 0;
    }
  };

  const renderStatsList = (type: FilterType) => {
    const sortedStats = getSortedStats(type);

    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      );
    }

    if (sortedStats.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum resultado encontrado
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {sortedStats.map((player, index) => {
          const statValue = getStatValue(player, type);
          if (statValue === 0) return null;

          return (
            <div
              key={player.player_id}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                {/* Posição */}
                <span className="text-xl md:text-2xl font-bold text-primary w-6 md:w-8 flex-shrink-0">
                  {index + 1}
                </span>

                {/* Avatar */}
                <Avatar className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
                  {player.avatar_url ? (
                    <AvatarImage 
                      src={player.avatar_url} 
                      alt={player.nickname}
                      className="object-cover"
                    />
                  ) : (
                    <AvatarFallback className="text-xs md:text-sm">
                      {player.nickname.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>

                {/* Nome */}
                <div className="font-bold text-sm md:text-base text-foreground truncate">
                  {player.nickname}
                </div>
              </div>

              {/* Valor do stat */}
              <div className="text-2xl md:text-3xl font-bold text-primary flex-shrink-0 ml-2">
                {statValue}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 pt-4">
          <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">
              {isRefreshing ? 'Atualizando...' : 'Solte para atualizar'}
            </span>
          </div>
        </div>
      )}

      <Header />

      <main className="container mx-auto px-4 py-6 md:py-8">
        {/* Filtro de Rodada */}
        <div className="mb-6">
          <Select value={selectedRound} onValueChange={setSelectedRound}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Todas as rodadas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as rodadas</SelectItem>
              {rounds.map((round) => (
                <SelectItem key={round.id} value={round.id}>
                  Rodada {round.round_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Comparação de Jogadores */}
        {!loading && rankings.length >= 2 && (
          <PlayerComparisonChart players={rankings} />
        )}

        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold text-primary glow-text">
              ESTATÍSTICAS
            </CardTitle>
          </CardHeader>

          <CardContent>
            {/* Mobile: Botões de filtro horizontais */}
            <div className="lg:hidden mb-6">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-2">
                <Button
                  variant={filterType === "goals" ? "default" : "outline"}
                  onClick={() => setFilterType("goals")}
                  className="flex-shrink-0"
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Artilheiros
                </Button>
                <Button
                  variant={filterType === "assists" ? "default" : "outline"}
                  onClick={() => setFilterType("assists")}
                  className="flex-shrink-0"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Assistências
                </Button>
                <Button
                  variant={filterType === "wins" ? "default" : "outline"}
                  onClick={() => setFilterType("wins")}
                  className="flex-shrink-0"
                >
                  <Award className="h-4 w-4 mr-2" />
                  Vitórias
                </Button>
                <Button
                  variant={filterType === "draws" ? "default" : "outline"}
                  onClick={() => setFilterType("draws")}
                  className="flex-shrink-0"
                >
                  <Equal className="h-4 w-4 mr-2" />
                  Empates
                </Button>
                <Button
                  variant={filterType === "defeats" ? "default" : "outline"}
                  onClick={() => setFilterType("defeats")}
                  className="flex-shrink-0"
                >
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Derrotas
                </Button>
              </div>

              {/* Exibição mobile */}
              {renderStatsList(filterType)}
            </div>

            {/* Desktop: Tabs */}
            <div className="hidden lg:block">
              <Tabs defaultValue="goals" className="w-full">
                <TabsList className="grid w-full grid-cols-5 mb-6">
                  <TabsTrigger value="goals" className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    Artilheiros
                  </TabsTrigger>
                  <TabsTrigger value="assists" className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Assistências
                  </TabsTrigger>
                  <TabsTrigger value="wins" className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Vitórias
                  </TabsTrigger>
                  <TabsTrigger value="draws" className="flex items-center gap-2">
                    <Equal className="h-4 w-4" />
                    Empates
                  </TabsTrigger>
                  <TabsTrigger value="defeats" className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Derrotas
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="goals">{renderStatsList("goals")}</TabsContent>
                <TabsContent value="assists">{renderStatsList("assists")}</TabsContent>
                <TabsContent value="wins">{renderStatsList("wins")}</TabsContent>
                <TabsContent value="draws">{renderStatsList("draws")}</TabsContent>
                <TabsContent value="defeats">{renderStatsList("defeats")}</TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
