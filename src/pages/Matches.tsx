import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Match {
  id: string;
  match_number: number;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  scheduled_time: string;
  status: string;
  match_timer_started_at: string | null;
  match_timer_paused_at: string | null;
  match_timer_total_paused_seconds: number;
  goals: Array<{
    player: { nickname: string; name: string };
    minute: number;
    team_color: string;
    assist: { player: { nickname: string; name: string } | null };
  }>;
  cards: Array<{
    player: { nickname: string; name: string };
    card_type: string;
    minute: number;
  }>;
}

interface Round {
  id: string;
  round_number: number;
  status: string;
  scheduled_date: string;
  matches: Match[];
}

interface UserPerformance {
  gols: number;
  assistencias: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  aproveitamento: number;
}

const teamColors: Record<string, string> = {
  branco: "bg-white text-black",
  vermelho: "bg-red-600 text-white",
  azul: "bg-blue-600 text-white",
  laranja: "bg-orange-500 text-white",
};

const teamNames: Record<string, string> = {
  branco: "Branco",
  vermelho: "Vermelho",
  azul: "Azul",
  laranja: "Laranja",
};

export default function Matches() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPerformance, setUserPerformance] = useState<UserPerformance | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [matchTimers, setMatchTimers] = useState<Record<string, number>>({});

  useEffect(() => {
    loadUserAndData();
  }, []);

  useEffect(() => {
    if (userId && rounds[currentRoundIndex]) {
      loadUserPerformance(rounds[currentRoundIndex].id);
    }
  }, [currentRoundIndex, rounds, userId]);

  // Atualizar cronômetros das partidas em andamento
  useEffect(() => {
    const interval = setInterval(() => {
      if (rounds[currentRoundIndex]?.matches) {
        const newTimers: Record<string, number> = {};
        rounds[currentRoundIndex].matches.forEach(match => {
          if (match.status === 'in_progress' && match.match_timer_started_at) {
            const startTime = new Date(match.match_timer_started_at).getTime();
            const now = Date.now();
            let pausedSeconds = match.match_timer_total_paused_seconds || 0;
            
            if (match.match_timer_paused_at) {
              const pausedAt = new Date(match.match_timer_paused_at).getTime();
              pausedSeconds += Math.floor((now - pausedAt) / 1000);
            }
            
            const elapsedSeconds = Math.floor((now - startTime) / 1000) - pausedSeconds;
            const remainingTime = Math.max(0, 720 - elapsedSeconds);
            newTimers[match.id] = remainingTime;
          }
        });
        setMatchTimers(newTimers);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [rounds, currentRoundIndex]);

  const loadUserAndData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      setIsAdmin(data?.role === "admin");
    }
    await loadRounds();
  };

  const loadUserPerformance = async (roundId: string) => {
    if (!userId) return;

    try {
      // Buscar estatísticas do jogador nesta rodada
      const { data: stats } = await supabase
        .from("player_round_stats")
        .select("*")
        .eq("player_id", userId)
        .eq("round_id", roundId)
        .single();

      if (stats) {
        const totalJogos = stats.victories + stats.draws + stats.defeats;
        const pontosPossiveis = totalJogos * 3;
        const pontosConquistados = (stats.victories * 3) + (stats.draws * 1);
        const aproveitamento = pontosPossiveis > 0 
          ? Math.round((pontosConquistados / pontosPossiveis) * 100) 
          : 0;

        // Contar gols e assistências
        const { data: goals } = await supabase
          .from("goals")
          .select("*")
          .eq("player_id", userId)
          .in("match_id", rounds[currentRoundIndex].matches.map(m => m.id));

        const { data: assists } = await supabase
          .from("assists")
          .select("goal_id")
          .eq("player_id", userId);

        setUserPerformance({
          gols: goals?.length || 0,
          assistencias: assists?.length || 0,
          vitorias: stats.victories || 0,
          empates: stats.draws || 0,
          derrotas: stats.defeats || 0,
          aproveitamento,
        });
      } else {
        setUserPerformance({
          gols: 0,
          assistencias: 0,
          vitorias: 0,
          empates: 0,
          derrotas: 0,
          aproveitamento: 0,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar aproveitamento:", error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const loadRounds = async () => {
    try {
      const { data: roundsData } = await supabase
        .from("rounds")
        .select("*")
        .order("round_number", { ascending: false });

      if (!roundsData) return;

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

              // Buscar cartões
              const { data: cardsData } = await supabase
                .from("cards")
                .select("*")
                .eq("match_id", match.id);

              const cardsWithPlayers = await Promise.all(
                (cardsData || []).map(async (card: any) => {
                  const { data: player } = await supabase
                    .from("profiles")
                    .select("nickname, name")
                    .eq("id", card.player_id)
                    .maybeSingle();

                  return {
                    minute: card.minute,
                    card_type: card.card_type,
                    player: player || { nickname: "Desconhecido", name: "Desconhecido" },
                  };
                })
              );

              return {
                ...match,
                goals: goalsWithPlayers,
                cards: cardsWithPlayers,
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

  return (
    <div className="min-h-screen bg-background">
      <Header isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentRoundIndex(Math.max(0, currentRoundIndex - 1))}
                disabled={currentRoundIndex === 0}
                className="text-primary hover:bg-muted"
              >
                <ChevronLeft size={24} />
              </Button>
              <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-primary glow-text">
                {currentRound ? `Rodada - ${new Date(currentRound.scheduled_date).toLocaleDateString('pt-BR')}` : "RODADA"}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setCurrentRoundIndex(Math.min(rounds.length - 1, currentRoundIndex + 1))
                }
                disabled={currentRoundIndex === rounds.length - 1}
                className="text-primary hover:bg-muted"
              >
                <ChevronRight size={24} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : !currentRound ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma rodada disponível
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  {currentRound.matches.map((match) => {
                    const getStatusBadge = (status: string) => {
                      if (status === 'not_started') {
                        return <Badge className="bg-red-600 text-white">Não Iniciado</Badge>;
                      } else if (status === 'in_progress') {
                        return <Badge className="bg-yellow-600 text-white">Em Andamento</Badge>;
                      } else if (status === 'finished') {
                        return <Badge className="bg-green-600 text-white">Encerrado</Badge>;
                      }
                      return null;
                    };

                    return (
                 <Card 
                  key={match.id} 
                  className="card-glow overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => {
                    if (match.status === 'in_progress') {
                      window.location.href = `/admin/round/manage?round=${currentRound.id}&match=${match.id}`;
                    }
                  }}
                >
                  {/* Placar Padronizado */}
                  <div className="bg-gradient-to-r from-primary/90 to-secondary/90 p-6 rounded-t-2xl">
                    <div className="text-center mb-3 flex flex-col items-center gap-2">
                      <Badge className="bg-accent text-accent-foreground font-bold text-xs px-3 py-1">
                        {match.status === 'not_started' && 'AGUARDANDO INÍCIO'}
                        {match.status === 'in_progress' && 'EM ANDAMENTO'}
                        {match.status === 'finished' && 'ENCERRADO'}
                      </Badge>
                      {match.status === 'in_progress' && matchTimers[match.id] !== undefined && (
                        <div className="text-2xl font-bold text-white font-mono bg-black/30 px-4 py-1 rounded-full">
                          {formatTime(matchTimers[match.id])}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-6">
                      <div className="text-center flex-1">
                        <Badge className={`${teamColors[match.team_home]} mb-2 text-xs`}>
                          {teamNames[match.team_home]}
                        </Badge>
                        <div className="text-5xl font-bold text-white">
                          {match.score_home}
                        </div>
                      </div>
                      <div className="text-4xl font-bold text-white">-</div>
                      <div className="text-center flex-1">
                        <Badge className={`${teamColors[match.team_away]} mb-2 text-xs`}>
                          {teamNames[match.team_away]}
                        </Badge>
                        <div className="text-5xl font-bold text-white">
                          {match.score_away}
                        </div>
                      </div>
                    </div>
                  </div>

                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground text-center mb-4">
                      {match.scheduled_time?.substring(0, 5)}
                    </div>

                    {/* Gols Alinhados por Time */}
                    <div className="grid grid-cols-2 gap-6 mb-4">
                      {/* Time Casa */}
                      <div className="text-left space-y-1.5">
                        {match.goals
                          ?.filter(g => g.team_color === match.team_home)
                          .sort((a, b) => a.minute - b.minute)
                          .map((goal, idx) => (
                            <div key={idx} className="text-xs flex items-start gap-1.5">
                              <span className="text-base">⚽</span>
                              <div className="flex flex-col">
                                <span className="text-foreground font-medium">
                                  {goal.player?.nickname || goal.player?.name || 'Desconhecido'}
                                </span>
                                {goal.assist?.player && (
                                  <span className="text-[10px] text-muted-foreground">
                                    Assist: {goal.assist.player.nickname || goal.assist.player.name}
                                  </span>
                                )}
                              </div>
                              <span className="text-muted-foreground ml-auto">{goal.minute}'</span>
                            </div>
                          ))}
                      </div>
                      
                      {/* Time Visitante */}
                      <div className="text-right space-y-1.5">
                        {match.goals
                          ?.filter(g => g.team_color === match.team_away)
                          .sort((a, b) => a.minute - b.minute)
                          .map((goal, idx) => (
                            <div key={idx} className="text-xs flex items-start justify-end gap-1.5">
                              <span className="text-muted-foreground">{goal.minute}'</span>
                              <div className="flex flex-col items-end">
                                <span className="text-foreground font-medium">
                                  {goal.player?.nickname || goal.player?.name || 'Desconhecido'}
                                </span>
                                {goal.assist?.player && (
                                  <span className="text-[10px] text-muted-foreground">
                                    Assist: {goal.assist.player.nickname || goal.assist.player.name}
                                  </span>
                                )}
                              </div>
                              <span className="text-base">⚽</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {match.cards.length > 0 && (
                      <div className="border-t border-border pt-3">
                        <div className="text-xs font-semibold mb-2 text-center">Cartões</div>
                        <div className="space-y-1">
                          {match.cards
                            .sort((a, b) => a.minute - b.minute)
                            .map((card, idx) => (
                              <div key={`card-${idx}`} className="text-xs sm:text-sm text-center">
                                <span className="text-foreground font-medium">
                                  {card.card_type === "amarelo" ? "🟨" : "🟦"} {card.player?.nickname || card.player?.name}
                                </span>
                                <span className="text-muted-foreground ml-2">
                                  {card.minute}'
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                    );
                  })}
                </div>

                {userPerformance && (
                  <Card className="bg-muted/20 border-border">
                    <CardHeader>
                      <CardTitle className="text-xl font-bold text-primary">
                        Seu aproveitamento na rodada
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">{userPerformance.gols}</div>
                          <div className="text-sm text-muted-foreground">Gols Marcados</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">{userPerformance.assistencias}</div>
                          <div className="text-sm text-muted-foreground">Assistências</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">{userPerformance.vitorias}</div>
                          <div className="text-sm text-muted-foreground">Vitórias</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">{userPerformance.empates}</div>
                          <div className="text-sm text-muted-foreground">Empates</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">{userPerformance.derrotas}</div>
                          <div className="text-sm text-muted-foreground">Derrotas</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">{userPerformance.aproveitamento}%</div>
                          <div className="text-sm text-muted-foreground">Aproveitamento</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}