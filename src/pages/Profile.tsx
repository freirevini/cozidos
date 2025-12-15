import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import PlayerPerformanceChart from "@/components/PlayerPerformanceChart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, Target, Users, AlertCircle } from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  nickname: string | null;
  birth_date: string | null;
  position: string | null;
  level: string | null;
  is_approved: boolean;
  status: string | null;
  email: string | null;
}

interface PlayerStats {
  matches: number;
  victories: number;
  draws: number;
  defeats: number;
  goals: number;
  assists: number;
  presencas: number;
  faltas: number;
  atrasos: number;
  cartoes_amarelos: number;
  cartoes_azuis: number;
  pontos_totais: number;
}

interface SeasonStats extends PlayerStats {
  season: number;
}

const positionMap: Record<string, string> = {
  goleiro: "Goleiro",
  defensor: "Defensor",
  "meio-campista": "Meio-Campista",
  atacante: "Atacante",
};

const levelMap: Record<string, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  E: "E",
};

const emptyStats: PlayerStats = {
  matches: 0,
  victories: 0,
  draws: 0,
  defeats: 0,
  goals: 0,
  assists: 0,
  presencas: 0,
  faltas: 0,
  atrasos: 0,
  cartoes_amarelos: 0,
  cartoes_azuis: 0,
  pontos_totais: 0,
};

export default function Profile() {
  const { isAdmin, isPlayer: isPlayerFromAuth } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [seasonStats, setSeasonStats] = useState<SeasonStats[]>([]);
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isPlayer, setIsPlayer] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  // Carregar estatísticas quando profile estiver disponível
  useEffect(() => {
    if (profile?.id) {
      loadStats(profile.id);
      loadSeasonStats(profile.id);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to profile changes
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      setUserId(user.id);

      // Buscar perfil vinculado ao user_id - esta é a fonte de verdade
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, name, nickname, birth_date, position, level, is_approved, status, is_player, email, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      if (profiles && profiles.length > 0) {
        // Priorizar perfil aprovado ou mais recente
        let selectedProfile = profiles.find(p => p.status === 'aprovado' || p.is_approved) 
          || profiles[0];
        
        setProfile(selectedProfile);
        setIsPlayer(selectedProfile.is_player || false);
        
        if (profiles.length > 1) {
          console.warn(`[Profile] Múltiplos perfis encontrados para user_id ${user.id}. Usando perfil: ${selectedProfile.id}`);
        }
      } else {
        toast({
          title: "Perfil não encontrado",
          description: "Seu perfil está sendo criado. Recarregue a página em alguns instantes.",
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error("Erro ao carregar perfil:", error);
      toast({
        title: "Erro ao carregar perfil",
        description: error.message || "Ocorreu um erro ao carregar seu perfil. Tente recarregar a página.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Buscar estatísticas usando profile.id (fonte única de verdade)
  const loadStats = async (profileId: string) => {
    try {
      setStatsLoading(true);

      // Buscar da tabela player_rankings usando player_id (profile.id)
      const { data: rankingData } = await supabase
        .from("player_rankings")
        .select("*")
        .eq("player_id", profileId)
        .maybeSingle();

      if (rankingData) {
        const totalMatches = rankingData.vitorias + rankingData.empates + rankingData.derrotas;
        
        setStats({
          matches: totalMatches,
          victories: rankingData.vitorias,
          draws: rankingData.empates,
          defeats: rankingData.derrotas,
          goals: rankingData.gols,
          assists: rankingData.assistencias,
          presencas: rankingData.presencas,
          faltas: rankingData.faltas,
          atrasos: rankingData.atrasos,
          cartoes_amarelos: rankingData.cartoes_amarelos,
          cartoes_azuis: rankingData.cartoes_azuis,
          pontos_totais: rankingData.pontos_totais,
        });
      } else {
        // Se não encontrar por player_id, tentar buscar contando diretamente das tabelas de eventos
        await loadStatsFromEvents(profileId);
      }
    } catch (error: any) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fallback: calcular estatísticas diretamente das tabelas de eventos
  const loadStatsFromEvents = async (profileId: string) => {
    try {
      // Buscar gols
      const { count: goalsCount } = await supabase
        .from("goals")
        .select("*", { count: "exact", head: true })
        .eq("player_id", profileId)
        .eq("is_own_goal", false);

      // Buscar assistências
      const { count: assistsCount } = await supabase
        .from("assists")
        .select("*", { count: "exact", head: true })
        .eq("player_id", profileId);

      // Buscar estatísticas agregadas de player_round_stats
      const { data: roundStats } = await supabase
        .from("player_round_stats")
        .select("victories, draws, defeats, lates, absences, yellow_cards, blue_cards, presence_points, total_points")
        .eq("player_id", profileId);

      if (roundStats && roundStats.length > 0) {
        const aggregated = roundStats.reduce((acc, rs) => ({
          victories: acc.victories + (rs.victories || 0),
          draws: acc.draws + (rs.draws || 0),
          defeats: acc.defeats + (rs.defeats || 0),
          lates: acc.lates + (rs.lates || 0),
          absences: acc.absences + (rs.absences || 0),
          yellow_cards: acc.yellow_cards + (rs.yellow_cards || 0),
          blue_cards: acc.blue_cards + (rs.blue_cards || 0),
          presencas: acc.presencas + (rs.presence_points > 0 ? 1 : 0),
          pontos_totais: acc.pontos_totais + (rs.total_points || 0),
        }), { victories: 0, draws: 0, defeats: 0, lates: 0, absences: 0, yellow_cards: 0, blue_cards: 0, presencas: 0, pontos_totais: 0 });

        const totalMatches = aggregated.victories + aggregated.draws + aggregated.defeats;
        
        setStats({
          matches: totalMatches,
          victories: aggregated.victories,
          draws: aggregated.draws,
          defeats: aggregated.defeats,
          goals: goalsCount || 0,
          assists: assistsCount || 0,
          presencas: aggregated.presencas,
          faltas: aggregated.absences,
          atrasos: aggregated.lates,
          cartoes_amarelos: aggregated.yellow_cards,
          cartoes_azuis: aggregated.blue_cards,
          pontos_totais: aggregated.pontos_totais,
        });
      } else if ((goalsCount && goalsCount > 0) || (assistsCount && assistsCount > 0)) {
        // Pelo menos tem gols ou assistências
        setStats({
          ...emptyStats,
          goals: goalsCount || 0,
          assists: assistsCount || 0,
        });
      }
    } catch (error) {
      console.error("Erro ao calcular estatísticas de eventos:", error);
    }
  };

  // Carregar estatísticas por temporada
  const loadSeasonStats = async (profileId: string) => {
    try {
      // Buscar rounds com datas para determinar temporadas
      const { data: roundStats } = await supabase
        .from("player_round_stats")
        .select(`
          *,
          round:rounds(scheduled_date, round_number)
        `)
        .eq("player_id", profileId);

      if (!roundStats || roundStats.length === 0) return;

      // Agrupar por ano
      const statsByYear: Record<number, PlayerStats> = {};
      const years = new Set<number>();

      for (const rs of roundStats) {
        const roundDate = rs.round?.scheduled_date;
        const year = roundDate ? new Date(roundDate).getFullYear() : new Date().getFullYear();
        years.add(year);

        if (!statsByYear[year]) {
          statsByYear[year] = { ...emptyStats };
        }

        statsByYear[year].victories += rs.victories || 0;
        statsByYear[year].draws += rs.draws || 0;
        statsByYear[year].defeats += rs.defeats || 0;
        statsByYear[year].atrasos += rs.lates || 0;
        statsByYear[year].faltas += rs.absences || 0;
        statsByYear[year].cartoes_amarelos += rs.yellow_cards || 0;
        statsByYear[year].cartoes_azuis += rs.blue_cards || 0;
        statsByYear[year].presencas += (rs.presence_points || 0) > 0 ? 1 : 0;
        statsByYear[year].pontos_totais += rs.total_points || 0;
      }

      // Buscar gols por temporada
      const { data: goals } = await supabase
        .from("goals")
        .select(`
          id,
          is_own_goal,
          match:matches(round:rounds(scheduled_date))
        `)
        .eq("player_id", profileId)
        .eq("is_own_goal", false);

      if (goals) {
        for (const goal of goals) {
          const roundDate = goal.match?.round?.scheduled_date;
          const year = roundDate ? new Date(roundDate).getFullYear() : new Date().getFullYear();
          if (statsByYear[year]) {
            statsByYear[year].goals += 1;
          }
        }
      }

      // Buscar assistências por temporada
      const { data: assists } = await supabase
        .from("assists")
        .select(`
          id,
          goal:goals(match:matches(round:rounds(scheduled_date)))
        `)
        .eq("player_id", profileId);

      if (assists) {
        for (const assist of assists) {
          const roundDate = assist.goal?.match?.round?.scheduled_date;
          const year = roundDate ? new Date(roundDate).getFullYear() : new Date().getFullYear();
          if (statsByYear[year]) {
            statsByYear[year].assists += 1;
          }
        }
      }

      // Calcular partidas por temporada
      for (const year of Object.keys(statsByYear)) {
        const yearStats = statsByYear[Number(year)];
        yearStats.matches = yearStats.victories + yearStats.draws + yearStats.defeats;
      }

      // Converter para array ordenado
      const sortedYears = Array.from(years).sort((a, b) => b - a);
      setAvailableSeasons(sortedYears);
      
      const seasonStatsArray: SeasonStats[] = sortedYears.map(year => ({
        season: year,
        ...statsByYear[year],
      }));
      
      setSeasonStats(seasonStatsArray);
    } catch (error) {
      console.error("Erro ao carregar estatísticas por temporada:", error);
    }
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return "-";
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const StatCard = ({ value, label, color = "primary" }: { value: number; label: string; color?: string }) => {
    const colorClasses: Record<string, string> = {
      primary: "text-primary",
      green: "text-green-500",
      yellow: "text-yellow-500",
      red: "text-red-500",
      blue: "text-blue-500",
    };
    
    return (
      <div className="text-center p-4 bg-muted/20 rounded-lg border border-border">
        <p className={`text-3xl font-bold ${colorClasses[color] || colorClasses.primary}`}>{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </div>
    );
  };

  const renderStats = (statsData: PlayerStats) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <StatCard value={statsData.matches} label="Partidas Disputadas" color="primary" />
      <StatCard value={statsData.victories} label="Vitórias" color="green" />
      <StatCard value={statsData.draws} label="Empates" color="yellow" />
      <StatCard value={statsData.defeats} label="Derrotas" color="red" />
      <StatCard value={statsData.goals} label="Gols" color="primary" />
      <StatCard value={statsData.assists} label="Assistências" color="primary" />
    </div>
  );

  const renderDetailedStats = (statsData: PlayerStats) => (
    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="text-center p-3 bg-muted/10 rounded-lg border border-border/50">
        <p className="text-xl font-bold text-green-500">{statsData.presencas}</p>
        <p className="text-xs text-muted-foreground">Presenças</p>
      </div>
      <div className="text-center p-3 bg-muted/10 rounded-lg border border-border/50">
        <p className="text-xl font-bold text-red-500">{statsData.faltas}</p>
        <p className="text-xs text-muted-foreground">Faltas</p>
      </div>
      <div className="text-center p-3 bg-muted/10 rounded-lg border border-border/50">
        <p className="text-xl font-bold text-yellow-500">{statsData.atrasos}</p>
        <p className="text-xs text-muted-foreground">Atrasos</p>
      </div>
      <div className="text-center p-3 bg-muted/10 rounded-lg border border-border/50">
        <p className="text-xl font-bold text-primary">{statsData.pontos_totais}</p>
        <p className="text-xs text-muted-foreground">Pontos Totais</p>
      </div>
      <div className="text-center p-3 bg-muted/10 rounded-lg border border-border/50">
        <p className="text-xl font-bold text-yellow-400">🟨 {statsData.cartoes_amarelos}</p>
        <p className="text-xs text-muted-foreground">Amarelos</p>
      </div>
      <div className="text-center p-3 bg-muted/10 rounded-lg border border-border/50">
        <p className="text-xl font-bold text-blue-400">🟦 {statsData.cartoes_azuis}</p>
        <p className="text-xs text-muted-foreground">Azuis</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text">
              Meu Perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !profile ? (
              <div className="text-center py-8 text-muted-foreground">
                Perfil não encontrado
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Nome</p>
                    <p className="text-lg font-medium">{profile.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Apelido</p>
                    <p className="text-lg font-medium">{profile.nickname || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Data de Nascimento</p>
                    <p className="text-lg font-medium">
                      {profile.birth_date ? new Date(profile.birth_date).toLocaleDateString('pt-BR') : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Idade</p>
                    <p className="text-lg font-medium">
                      {profile.birth_date ? `${calculateAge(profile.birth_date)} anos` : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Posição</p>
                    <p className="text-lg font-medium">
                      {profile.position ? positionMap[profile.position] : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Nível</p>
                    <p className="text-lg font-medium">
                      {profile.level ? levelMap[profile.level] : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    {profile.status === 'aprovado' || profile.is_approved ? (
                      <Badge className="bg-green-600">Aprovado</Badge>
                    ) : profile.status === 'rejeitado' ? (
                      <Badge variant="destructive">Rejeitado</Badge>
                    ) : (
                      <Badge variant="outline">Pendente de Aprovação</Badge>
                    )}
                  </div>
                </div>
                {profile.status !== 'aprovado' && !profile.is_approved && (
                  <div className="mt-6 p-4 bg-muted/20 rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground">
                      Seu perfil está pendente de aprovação pelo administrador. 
                      Após a aprovação, você poderá participar das rodadas.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estatísticas */}
        {profile && (
          <Card className="card-glow bg-card border-border max-w-2xl mx-auto mt-6">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary glow-text flex items-center gap-2">
                <Trophy className="w-6 h-6" />
                Minhas Estatísticas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : !stats && seasonStats.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    Nenhuma estatística disponível ainda.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Participe das rodadas para começar a acumular estatísticas!
                  </p>
                </div>
              ) : (
                <Tabs defaultValue="geral" className="w-full">
                  <TabsList className="w-full mb-4">
                    <TabsTrigger value="geral" className="flex-1">Geral</TabsTrigger>
                    {seasonStats.length > 0 && (
                      <TabsTrigger value="temporadas" className="flex-1">Por Temporada</TabsTrigger>
                    )}
                  </TabsList>
                  
                  <TabsContent value="geral">
                    {stats && (
                      <>
                        {renderStats(stats)}
                        {renderDetailedStats(stats)}
                      </>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="temporadas">
                    {seasonStats.length > 0 ? (
                      <div className="space-y-6">
                        {seasonStats.map((season) => (
                          <div key={season.season} className="border border-border rounded-lg p-4">
                            <h4 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                              <Target className="w-5 h-5" />
                              Temporada {season.season}
                            </h4>
                            {renderStats(season)}
                            {renderDetailedStats(season)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        Nenhuma estatística por temporada disponível.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        )}

        {/* Gráficos de Evolução */}
        {profile && (profile.status === 'aprovado' || profile.is_approved) && (
          <div className="max-w-2xl mx-auto mt-6">
            <PlayerPerformanceChart 
              playerId={profile.id} 
              playerEmail={profile.email || undefined}
            />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
