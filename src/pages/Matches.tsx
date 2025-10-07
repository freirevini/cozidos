import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
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

  useEffect(() => {
    loadUserAndData();
  }, []);

  useEffect(() => {
    if (userId && rounds[currentRoundIndex]) {
      loadUserPerformance(rounds[currentRoundIndex].id);
    }
  }, [currentRoundIndex, rounds, userId]);

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
                  {currentRound.matches.map((match) => (
                    <Card key={match.id} className="bg-muted/20 border-border">
                      <CardContent className="p-6">
                         <div className="flex flex-col space-y-4">
                          <div className="text-center text-sm text-muted-foreground font-medium">
                            {match.scheduled_time.substring(0, 5)}
                          </div>

                          <div className="flex items-center justify-center gap-8">
                            <div className="flex flex-col items-center space-y-2 flex-1">
                              <Badge className={teamColors[match.team_home] + " w-full justify-center py-2"}>
                                {teamNames[match.team_home]}
                              </Badge>
                              <span className="text-4xl font-bold text-primary">
                                {match.score_home}
                              </span>
                              {/* Gols do time da casa */}
                              {match.goals
                                .filter(g => g.team_color === match.team_home)
                                .sort((a, b) => a.minute - b.minute)
                                .map((goal, idx) => (
                                  <div key={`home-goal-${idx}`} className="text-xs text-center">
                                    <div className="font-medium">
                                      ⚽ {goal.player?.nickname || goal.player?.name}
                                      {goal.assist?.player && (
                                        <span className="text-muted-foreground ml-1">
                                          ({goal.assist.player.nickname || goal.assist.player.name})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>

                            <div className="text-2xl text-muted-foreground font-bold">×</div>

                            <div className="flex flex-col items-center space-y-2 flex-1">
                              <Badge className={teamColors[match.team_away] + " w-full justify-center py-2"}>
                                {teamNames[match.team_away]}
                              </Badge>
                              <span className="text-4xl font-bold text-primary">
                                {match.score_away}
                              </span>
                              {/* Gols do time visitante */}
                              {match.goals
                                .filter(g => g.team_color === match.team_away)
                                .sort((a, b) => a.minute - b.minute)
                                .map((goal, idx) => (
                                  <div key={`away-goal-${idx}`} className="text-xs text-center">
                                    <div className="font-medium">
                                      ⚽ {goal.player?.nickname || goal.player?.name}
                                      {goal.assist?.player && (
                                        <span className="text-muted-foreground ml-1">
                                          ({goal.assist.player.nickname || goal.assist.player.name})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>

                          {match.cards.length > 0 && (
                            <div className="border-t border-border pt-4">
                              <div className="text-xs font-semibold mb-2 text-center">Cartões</div>
                              <div className="space-y-1">
                                {match.cards
                                  .sort((a, b) => a.minute - b.minute)
                                  .map((card, idx) => (
                                    <div key={`card-${idx}`} className="text-sm text-center">
                                      <span className="text-foreground font-medium">
                                        {card.card_type === "amarelo" ? "🟨" : "🟥"} {card.player?.nickname || card.player?.name}
                                      </span>
                                      <span className="text-muted-foreground ml-2">
                                        {card.minute}'
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
    </div>
  );
}