import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Info, RefreshCw, Trophy, Target } from "lucide-react";
import { toast } from "sonner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
interface PlayerStats {
  player_id: string;
  nickname: string;
  avatar_url: string | null;
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
export default function Classification() {
  const {
    isAdmin,
    isPlayer
  } = useAuth();
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "top" | "goals">("all");
  useEffect(() => {
    loadStats();
    console.log('🔌 Iniciando subscription realtime para player_rankings...');

    // Criar subscription para updates em tempo real
    const channel = supabase.channel('player_rankings_changes').on('postgres_changes', {
      event: '*',
      // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'player_rankings'
    }, payload => {
      console.log('📊 Ranking atualizado em tempo real:', payload);
      console.log('🔄 Tipo de evento:', payload.eventType);
      console.log('📝 Dados novos:', payload.new);
      console.log('📝 Dados antigos:', payload.old);
      // Recarregar stats quando houver mudança
      loadStats();
    }).subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Subscription realtime ativa para Classificação!');
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
      console.log('🔌 Removendo subscription realtime da Classificação...');
      supabase.removeChannel(channel);
    };
  }, []);
  const loadStats = async () => {
    setLoading(true);
    try {
      // Fetch directly from player_rankings table with avatar
      const {
        data: rankings,
        error
      } = await supabase.from("player_rankings").select(`
          *,
          profiles!inner(avatar_url)
        `).order("pontos_totais", {
        ascending: false
      }).limit(1000); // Cache busting

      if (error) {
        console.error("Erro ao carregar rankings:", error);
        return;
      }
      if (!rankings) {
        setStats([]);
        return;
      }

      // Map to PlayerStats interface
      const mappedStats: PlayerStats[] = rankings.map(rank => ({
        player_id: rank.player_id,
        nickname: rank.nickname,
        avatar_url: rank.profiles?.avatar_url || null,
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
  const getFilteredStats = () => {
    switch (filterType) {
      case "top":
        return stats.slice(0, 10);
      case "goals":
        return [...stats].sort((a, b) => b.gols - a.gols).slice(0, 10);
      default:
        return stats;
    }
  };
  const filteredStats = getFilteredStats();
  return <div className="min-h-screen bg-background flex flex-col">
      {/* Pull to Refresh Indicator */}
      {(pullDistance > 0 || isRefreshing) && <div className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 transition-all" style={{
      transform: `translateY(${Math.min(pullDistance, 60)}px)`,
      opacity: Math.min(pullDistance / 60, 1)
    }}>
          <div className="bg-primary/90 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">
              {isRefreshing ? 'Atualizando...' : 'Solte para atualizar'}
            </span>
          </div>
        </div>}

      <Header />
      <main className="container mx-auto px-4 py-8 flex-1">
        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-3xl font-bold text-primary glow-text text-center flex-1">
                CLASSIFICAÇÃO GERAL
              </CardTitle>
              <AlertDialog open={showRules} onOpenChange={setShowRules}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Info className="h-4 w-4" />
                    Pontuação
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-border max-w-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-primary text-2xl">
                      📊 Regras de Pontuação
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="text-foreground space-y-4 mt-4">
                        <div className="space-y-2">
                          <h3 className="font-bold text-lg text-primary">Pontos Individuais:</h3>
                          <ul className="space-y-1 ml-4">
                            <li>✅ <strong>Presença:</strong> +10 pontos</li>
                            <li>⏰ <strong>Atraso:</strong> -5 pontos</li>
                            <li>❌ <strong>Confirmou Presença e Faltou:</strong> -10 pontos</li>
                            <li>🟨 <strong>Cartão Amarelo:</strong> -1 ponto</li>
                            <li>🟦 <strong>Cartão Azul:</strong> -2 pontos</li>
                          </ul>
                        </div>
                        
                        <div className="space-y-2">
                          <h3 className="font-bold text-lg text-primary">Pontos Coletivos (por time):</h3>
                          <ul className="space-y-1 ml-4">
                            <li>🏆 <strong>Vitória:</strong> +3 pontos</li>
                            <li>🤝 <strong>Empate:</strong> +1 ponto</li>
                            <li>⚽ <strong>Gol:</strong> +1 ponto</li>
                            <li>🎯 <strong>Assistência:</strong> +2 pontos</li>
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
          </CardHeader>
          <CardContent>
            {/* Quick Filters - Mobile Only */}
            <div className="lg:hidden mb-4">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-2">
                <Button variant={filterType === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterType("all")} className="whitespace-nowrap flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  Todos
                </Button>
                <Button variant={filterType === "top" ? "default" : "outline"} size="sm" onClick={() => setFilterType("top")} className="whitespace-nowrap flex items-center gap-1">
                  🏆 Top 10
                </Button>
                <Button variant={filterType === "goals" ? "default" : "outline"} size="sm" onClick={() => setFilterType("goals")} className="whitespace-nowrap flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  Artilheiros
                </Button>
              </div>
            </div>

            {loading ? <div className="space-y-3">
                {Array.from({
              length: 5
            }).map((_, i) => <div key={i} className="flex items-center gap-3 p-3 bg-muted/10 rounded-lg">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-5 flex-1" />
                    <Skeleton className="h-6 w-16" />
                  </div>)}
              </div> : <>
                {/* Desktop: Tabela completa */}
                <div className="hidden lg:block overflow-x-auto w-full scroll-smooth">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-muted/50">
                        <TableHead className="text-primary font-bold">Posição</TableHead>
                        <TableHead className="text-primary font-bold min-w-[120px]">Jogador</TableHead>
                        <TableHead className="text-primary font-bold text-center">Presença</TableHead>
                        <TableHead className="text-primary font-bold text-center">Vitória</TableHead>
                        <TableHead className="text-primary font-bold text-center">Empate</TableHead>
                        <TableHead className="text-primary font-bold text-center">Derrota</TableHead>
                        <TableHead className="text-primary font-bold text-center">Gols</TableHead>
                        <TableHead className="text-primary font-bold text-center">Assistências</TableHead>
                        <TableHead className="text-primary font-bold text-center">Atraso</TableHead>
                        <TableHead className="text-primary font-bold text-center">Falta</TableHead>
                        <TableHead className="text-primary font-bold text-center">Punição</TableHead>
                        <TableHead className="text-primary font-bold text-center">🟨</TableHead>
                        <TableHead className="text-primary font-bold text-center">🟦</TableHead>
                        <TableHead className="text-primary font-bold text-center">Total de Pontos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStats.map((stat, index) => <TableRow key={stat.player_id} className="border-border hover:bg-muted/30">
                          <TableCell className="font-bold text-primary">{index + 1}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={stat.avatar_url || undefined} alt={stat.nickname} />
                                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                                  {stat.nickname?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {stat.nickname}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{stat.presencas}</TableCell>
                          <TableCell className="text-center">{stat.vitorias}</TableCell>
                          <TableCell className="text-center">{stat.empates}</TableCell>
                          <TableCell className="text-center">{stat.derrotas}</TableCell>
                          <TableCell className="text-center">{stat.gols}</TableCell>
                          <TableCell className="text-center">{stat.assistencias}</TableCell>
                          <TableCell className="text-center">{stat.atrasos}</TableCell>
                          <TableCell className="text-center">{stat.faltas}</TableCell>
                          <TableCell className="text-center">{stat.punicoes}</TableCell>
                          <TableCell className="text-center">{stat.cartoes_amarelos}</TableCell>
                          <TableCell className="text-center">{stat.cartoes_azuis}</TableCell>
                          <TableCell className="text-center font-bold text-primary">
                            {stat.pontos_totais}
                          </TableCell>
                        </TableRow>)}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile: Tabela compacta com scroll horizontal */}
                <div className="lg:hidden">
                  <Tabs defaultValue="pontos" className="w-full">
                    <TabsList className="w-full grid grid-cols-2">
                      <TabsTrigger value="pontos">Pontos</TabsTrigger>
                      <TabsTrigger value="stats">Estatísticas</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="pontos" className="mt-4">
                      <div className="overflow-x-auto scroll-smooth">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border">
                              <TableHead className="text-primary font-bold">Ranking</TableHead>
                              <TableHead className="text-primary font-bold min-w-[120px]">Jogador</TableHead>
                              <TableHead className="text-primary font-bold text-center">Presença
                          </TableHead>
                              <TableHead className="text-primary font-bold text-center">Pontos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStats.map((stat, index) => <TableRow key={stat.player_id} className="border-border">
                                <TableCell className="font-bold text-primary">{index + 1}</TableCell>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={stat.avatar_url || undefined} alt={stat.nickname} />
                                      <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                                        {stat.nickname?.substring(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    {stat.nickname}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">{stat.presencas}</TableCell>
                                <TableCell className="text-center font-bold text-primary">
                                  {stat.pontos_totais}
                                </TableCell>
                              </TableRow>)}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="stats" className="mt-4">
                      <div className="overflow-x-auto scroll-smooth">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border">
                              <TableHead className="text-primary font-bold">Jogador</TableHead>
                              <TableHead className="text-primary font-bold text-center">⚽</TableHead>
                              <TableHead className="text-primary font-bold text-center">🎯</TableHead>
                              <TableHead className="text-primary font-bold text-center">🟨</TableHead>
                              <TableHead className="text-primary font-bold text-center">🟦</TableHead>
                              <TableHead className="text-primary font-bold text-center">🏆</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStats.map(stat => <TableRow key={stat.player_id} className="border-border">
                                <TableCell className="font-medium min-w-[120px]">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={stat.avatar_url || undefined} alt={stat.nickname} />
                                      <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                                        {stat.nickname?.substring(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    {stat.nickname}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">{stat.gols}</TableCell>
                                <TableCell className="text-center">{stat.assistencias}</TableCell>
                                <TableCell className="text-center">{stat.cartoes_amarelos}</TableCell>
                                <TableCell className="text-center">{stat.cartoes_azuis}</TableCell>
                                <TableCell className="text-center">{stat.vitorias}</TableCell>
                              </TableRow>)}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </>}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>;
}