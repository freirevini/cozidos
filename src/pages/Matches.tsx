import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { TeamLogo } from "@/components/match/TeamLogo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Match {
  id: string;
  match_number: number;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  scheduled_time: string;
  started_at: string | null;
  finished_at: string | null;
  status: string;
  goals: Array<{
    player: { nickname: string; name: string };
    minute: number;
    team_color: string;
    assist: { player: { nickname: string; name: string } | null } | null;
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
        .maybeSingle();
      setIsAdmin(data?.role === "admin");
    }
    await loadRounds();
  };

  const loadRounds = async () => {
    try {
      if (rounds.length === 0) {
        setLoading(true);
      }

      const { data: roundsData } = await supabase
        .from("rounds")
        .select("*")
        .order("round_number", { ascending: false }); // Mais recente primeiro

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
            .order("scheduled_time", { ascending: true }); // Ordenar por horário

          const matchesWithDetails = await Promise.all(
            (matches || []).map(async (match: any) => {
              // Buscar gols com assistências
              const { data: goalsData } = await supabase
                .from("goals")
                .select(`
                  *,
                  player:profiles!goals_player_id_fkey(nickname, name),
                  assists(
                    player:profiles!assists_player_id_fkey(nickname, name)
                  )
                `)
                .eq("match_id", match.id);

              const goalsWithPlayers = (goalsData || []).map((goal: any) => {
                let assist = null;
                if (goal.assists) {
                  const assistData = Array.isArray(goal.assists) ? goal.assists[0] : goal.assists;
                  if (assistData?.player) {
                    assist = { player: assistData.player };
                  }
                }

                return {
                  minute: goal.minute,
                  team_color: goal.team_color,
                  player: goal.player || { nickname: "Desconhecido", name: "Desconhecido" },
                  assist,
                };
              });

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
      if (roundsWithMatches.length > 0) {
        setCurrentRoundIndex(0); // Sempre começar na rodada mais recente
      }
      setLoading(false);
    } catch (error) {
      console.error("Erro ao carregar rodadas:", error);
      setLoading(false);
    }
  };

  const currentRound = rounds[currentRoundIndex];

  // Realtime: Sincronizar atualizações
  useEffect(() => {
    if (!currentRound) return;

    const matchesChannel = supabase
      .channel("matches-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `round_id=eq.${currentRound.id}`,
        },
        () => {
          loadRounds();
        }
      )
      .subscribe();

    const goalsChannel = supabase
      .channel("goals-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goals",
        },
        () => {
          loadRounds();
        }
      )
      .subscribe();

    const assistsChannel = supabase
      .channel("assists-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assists",
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
  const visibleRounds = rounds.filter((r) => r.status !== "a_iniciar");

  const getStatusText = (status: string) => {
    if (status === "not_started") return "A iniciar";
    if (status === "in_progress") return "Em andamento";
    if (status === "finished") return "Encerrado";
    return "";
  };

  const getStatusBadge = (status: string) => {
    if (status === "in_progress") {
      return <Badge className="bg-primary text-primary-foreground">Em andamento</Badge>;
    }
    if (status === "finished") {
      return <Badge className="bg-green-600 text-white">Encerrado</Badge>;
    }
    return <Badge variant="outline">A iniciar</Badge>;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch {
      return "";
    }
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Título */}
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-6">Rodadas</h1>

        {/* Navegação de Rodadas - Estilo B1 */}
        <div className="mb-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 min-w-max pb-2">
            {visibleRounds.map((round, idx) => {
              const actualIndex = rounds.findIndex((r) => r.id === round.id);
              const isActive = currentRoundIndex === actualIndex;

              return (
                <button
                  key={round.id}
                  onClick={() => setCurrentRoundIndex(actualIndex)}
                  className={cn(
                    "flex flex-col items-center justify-center px-4 py-3 rounded-lg min-w-[80px] transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="text-xl font-bold">{round.round_number}</span>
                  <span className="text-xs mt-1">{formatDate(round.scheduled_date)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de Partidas - Estilo B1 */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : !currentRound ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma rodada disponível
          </div>
        ) : (
          <div className="space-y-4">
            {currentRound.matches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma partida nesta rodada
              </div>
            ) : (
              currentRound.matches.map((match) => {
                const matchDate =
                  match.status === "finished" && match.finished_at
                    ? formatDate(match.finished_at)
                    : match.started_at
                    ? formatDate(match.started_at)
                    : currentRound.scheduled_date
                    ? formatDate(currentRound.scheduled_date)
                    : "";

                return (
                  <Card
                    key={match.id}
                    className="overflow-hidden hover:shadow-lg hover:shadow-primary/20 transition-all border-border cursor-pointer active:scale-[0.98]"
                    onClick={() => navigate(`/match/${match.id}`)}
                  >
                    <CardContent className="p-4 sm:p-6">
                      {/* Cabeçalho com horário e status */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-sm text-muted-foreground">
                          {match.started_at
                            ? formatTime(match.started_at)
                            : formatTime(match.scheduled_time)}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(match.status)}
                          {match.status === "finished" && (
                            <span className="text-xs text-muted-foreground">{matchDate}</span>
                          )}
                        </div>
                      </div>

                      {/* Placar com logos */}
                      <div className="flex items-center justify-center gap-4 sm:gap-6 mb-4">
                        {/* Time Casa */}
                        <div className="flex flex-col items-center gap-2 flex-1">
                          <TeamLogo teamColor={match.team_home as any} size="sm" />
                          <span className="text-sm font-medium text-center">
                            {teamNames[match.team_home]}
                          </span>
                        </div>

                        {/* Placar */}
                        <div className="text-3xl sm:text-4xl font-bold tabular-nums text-primary">
                          {match.score_home} - {match.score_away}
                        </div>

                        {/* Time Visitante */}
                        <div className="flex flex-col items-center gap-2 flex-1">
                          <TeamLogo teamColor={match.team_away as any} size="sm" />
                          <span className="text-sm font-medium text-center">
                            {teamNames[match.team_away]}
                          </span>
                        </div>
                      </div>

                      {/* Gols com assistências (se houver) */}
                      {match.goals.length > 0 && (
                        <div className="border-t border-border pt-3 mt-3">
                          <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                            {/* Gols Time Casa */}
                            <div className="space-y-1">
                              {match.goals
                                .filter((goal) => goal.team_color === match.team_home)
                                .sort((a, b) => a.minute - b.minute)
                                .map((goal, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5">
                                    <span>⚽</span>
                                    <span className="font-medium">
                                      {goal.minute}' {goal.player?.nickname || goal.player?.name}
                                    </span>
                                    {goal.assist?.player && (
                                      <span className="text-muted-foreground text-xs">
                                        (Ass: {goal.assist.player.nickname || goal.assist.player.name})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              {match.goals.filter((g) => g.team_color === match.team_home).length ===
                                0 && (
                                <div className="text-muted-foreground italic text-center">-</div>
                              )}
                            </div>

                            {/* Gols Time Visitante */}
                            <div className="space-y-1">
                              {match.goals
                                .filter((goal) => goal.team_color === match.team_away)
                                .sort((a, b) => a.minute - b.minute)
                                .map((goal, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5">
                                    <span>⚽</span>
                                    <span className="font-medium">
                                      {goal.minute}' {goal.player?.nickname || goal.player?.name}
                                    </span>
                                    {goal.assist?.player && (
                                      <span className="text-muted-foreground text-xs">
                                        (Ass: {goal.assist.player.nickname || goal.assist.player.name})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              {match.goals.filter((g) => g.team_color === match.team_away).length ===
                                0 && (
                                <div className="text-muted-foreground italic text-center">-</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
