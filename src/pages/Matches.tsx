import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";

interface Match {
  id: string;
  match_number: number;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  scheduled_time: string;
  status: string;
  started_at: string | null;
  match_timer_started_at: string | null;
  match_timer_paused_at: string | null;
  match_timer_total_paused_seconds: number;
  goals: Array<{
    player: { nickname: string; name: string };
    minute: number;
    team_color: string;
    assist: { player: { nickname: string; name: string } | null };
  }>;
}

interface Round {
  id: string;
  round_number: number;
  status: string;
  scheduled_date: string;
  matches: Match[];
}

const teamNames: Record<string, string> = {
  branco: "Branco",
  vermelho: "Vermelho",
  azul: "Azul",
  laranja: "Laranja",
};

export default function Matches() {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadUserAndData();
  }, []);

  const loadUserAndData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      setIsAdmin(data?.role === "admin");
    }
    await loadRounds();
  };

  const loadRounds = async () => {
    try {
      // Não mostrar loading em atualizações de realtime
      if (rounds.length === 0) {
        setLoading(true);
      }
      
      const { data: roundsData } = await supabase
        .from("rounds")
        .select("*")
        .order("round_number", { ascending: false });

      if (!roundsData) {
        setLoading(false);
        return;
      }

      const roundsWithMatches = await Promise.all(
        roundsData.map(async (round) => {
          const { data: matches } = await supabase
            .from("matches")
            .select("*")
            .eq("round_id", round.id)
            .order("match_number");

          const matchesWithDetails = await Promise.all(
            (matches || []).map(async (match: any) => {
              // Buscar gols
              const { data: goalsData } = await supabase
                .from("goals")
                .select("*")
                .eq("match_id", match.id);

              const goalsWithPlayers = await Promise.all(
                (goalsData || []).map(async (goal: any) => {
                  const { data: player } = await supabase
                    .from("profiles")
                    .select("nickname, name")
                    .eq("id", goal.player_id)
                    .maybeSingle();

                  const { data: assistData } = await supabase
                    .from("assists")
                    .select("player_id")
                    .eq("goal_id", goal.id)
                    .maybeSingle();

                  let assist = null;
                  if (assistData) {
                    const { data: assistPlayer } = await supabase
                      .from("profiles")
                      .select("nickname, name")
                      .eq("id", assistData.player_id)
                      .maybeSingle();
                    assist = { player: assistPlayer };
                  }

                  return {
                    minute: goal.minute,
                    team_color: goal.team_color,
                    player: player || { nickname: "Desconhecido", name: "Desconhecido" },
                    assist,
                  };
                })
              );

              return {
                ...match,
                goals: goalsWithPlayers,
              };
            })
          );

          return {
            ...round,
            matches: matchesWithDetails || [],
          };
        })
      );

      setRounds(roundsWithMatches);
      setLoading(false);
    } catch (error) {
      console.error("Erro ao carregar rodadas:", error);
      setLoading(false);
    }
  };

  const currentRound = rounds[currentRoundIndex];
  
  // Realtime: Sincronizar atualizações de partidas, gols e assistências
  useEffect(() => {
    if (!currentRound) return;

    const matchesChannel = supabase
      .channel('matches-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `round_id=eq.${currentRound.id}`
        },
        () => {
          loadRounds();
        }
      )
      .subscribe();

    const goalsChannel = supabase
      .channel('goals-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals'
        },
        () => {
          loadRounds();
        }
      )
      .subscribe();

    const assistsChannel = supabase
      .channel('assists-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assists'
        },
        () => {
          loadRounds();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(goalsChannel);
      supabase.removeChannel(assistsChannel);
    };
  }, [currentRound]);
  
  // Filtrar apenas rodadas não "a_iniciar" para navegação
  const visibleRounds = rounds.filter(r => r.status !== 'a_iniciar');
  
  // Calcular minutos em tempo real para partidas em andamento
  const getCurrentMatchMinute = (match: Match): number | null => {
    if (match.status !== 'in_progress' || !match.match_timer_started_at) {
      return null;
    }
    
    const startTime = new Date(match.match_timer_started_at).getTime();
    const now = Date.now();
    let pausedSeconds = match.match_timer_total_paused_seconds || 0;
    
    if (match.match_timer_paused_at) {
      const pausedAt = new Date(match.match_timer_paused_at).getTime();
      pausedSeconds += Math.floor((now - pausedAt) / 1000);
    }
    
    const elapsedSeconds = Math.floor((now - startTime) / 1000) - pausedSeconds;
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    
    return elapsedMinutes;
  };
  
  // Obter texto e classe de status
  const getStatusText = (status: string) => {
    if (status === 'not_started') return 'A iniciar';
    if (status === 'in_progress') return 'Em andamento';
    if (status === 'finished') return 'Encerrado';
    return '';
  };
  
  const getStatusClass = (status: string) => {
    if (status === 'not_started') return 'text-muted-foreground';
    if (status === 'in_progress') return 'text-primary font-medium';
    if (status === 'finished') return 'text-green-500';
    return '';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Navegação de Rodadas - Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-foreground">Rodadas</h1>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <div className="container mx-auto flex gap-2 px-4 pb-3">
            {visibleRounds.map((round, idx) => {
              const actualIndex = rounds.findIndex(r => r.id === round.id);
              return (
                <button
                  key={round.id}
                  onClick={() => setCurrentRoundIndex(actualIndex)}
                  className={`
                    px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
                    ${currentRoundIndex === actualIndex 
                      ? 'bg-primary text-primary-foreground shadow-lg' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'}
                  `}
                  aria-label={`Rodada ${round.round_number}`}
                >
                  {round.round_number}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Lista de Partidas */}
      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : !currentRound ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma rodada disponível
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl mx-auto">
            {currentRound.matches.map((match) => {
              const currentMinute = getCurrentMatchMinute(match);
              
              return (
                <Card 
                  key={match.id} 
                  className="overflow-hidden hover:shadow-lg hover:shadow-primary/20 transition-all border-border cursor-pointer active:scale-[0.98]"
                  onClick={() => navigate(`/match/${match.id}`)}
                >
                  <CardContent className="p-4">
                    {/* Horário */}
                    <div className="text-center text-sm text-muted-foreground mb-3">
                      {match.started_at 
                        ? new Date(match.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : match.scheduled_time?.substring(0, 5)}
                    </div>
                    
                    {/* Placar */}
                    <div className="flex items-center justify-center gap-4 mb-3">
                      <span className="font-medium text-foreground flex-1 text-right">
                        {teamNames[match.team_home]}
                      </span>
                      <div className="text-3xl font-bold text-foreground px-4">
                        {match.score_home} - {match.score_away}
                      </div>
                      <span className="font-medium text-foreground flex-1 text-left">
                        {teamNames[match.team_away]}
                      </span>
                    </div>
                    
                    {/* Status e Cronômetro */}
                    <div className="flex items-center justify-between text-sm mb-4 px-2">
                      <span className="font-medium text-primary">
                        {match.status === 'in_progress' && currentMinute !== null && `${currentMinute}'`}
                      </span>
                      <span className={getStatusClass(match.status)}>
                        {getStatusText(match.status)}
                      </span>
                    </div>
                    
                    {/* Gols separados por time */}
                    {match.goals.length > 0 && (
                      <div className="border-t border-border pt-3">
                        <div className="grid grid-cols-2 gap-3">
                          {/* Gols Time Casa */}
                          <div className="space-y-1.5">
                            {match.goals
                              .filter(goal => goal.team_color === match.team_home)
                              .sort((a, b) => a.minute - b.minute)
                              .map((goal, idx) => (
                                <div key={`home-${idx}`} className="flex items-start gap-1.5 text-xs">
                                  <span className="text-base">⚽</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">
                                      {goal.minute}' {goal.player?.nickname || goal.player?.name}
                                    </div>
                                    {goal.assist?.player && (
                                      <div className="text-[10px] text-muted-foreground truncate">
                                        Assist: {goal.assist.player.nickname || goal.assist.player.name}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            {match.goals.filter(g => g.team_color === match.team_home).length === 0 && (
                              <div className="text-xs text-muted-foreground italic text-center">-</div>
                            )}
                          </div>

                          {/* Gols Time Visitante */}
                          <div className="space-y-1.5">
                            {match.goals
                              .filter(goal => goal.team_color === match.team_away)
                              .sort((a, b) => a.minute - b.minute)
                              .map((goal, idx) => (
                                <div key={`away-${idx}`} className="flex items-start gap-1.5 text-xs">
                                  <span className="text-base">⚽</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">
                                      {goal.minute}' {goal.player?.nickname || goal.player?.name}
                                    </div>
                                    {goal.assist?.player && (
                                      <div className="text-[10px] text-muted-foreground truncate">
                                        Assist: {goal.assist.player.nickname || goal.assist.player.name}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            {match.goals.filter(g => g.team_color === match.team_away).length === 0 && (
                              <div className="text-xs text-muted-foreground italic text-center">-</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}
