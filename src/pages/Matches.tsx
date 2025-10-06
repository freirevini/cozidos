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
    player: { name: string };
    minute: number;
    team_color: string;
    assist: { player: { name: string } | null };
  }>;
}

interface Round {
  id: string;
  round_number: number;
  status: string;
  matches: Match[];
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

  useEffect(() => {
    checkAdmin();
    loadRounds();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      setIsAdmin(data?.role === "admin");
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
            .select(`
              *,
              goals (
                minute,
                team_color,
                player:players(name),
                assist:assists(player:players(name))
              )
            `)
            .eq("round_id", round.id)
            .order("match_number");

          return {
            ...round,
            matches: matches || [],
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
              <CardTitle className="text-3xl font-bold text-primary glow-text">
                {currentRound ? `${currentRound.round_number}ª RODADA` : "PARTIDAS"}
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
              <div className="space-y-4">
                {currentRound.matches.map((match) => (
                  <Card key={match.id} className="bg-muted/20 border-border">
                    <CardContent className="p-6">
                      <div className="flex flex-col space-y-4">
                        {/* Horário */}
                        <div className="text-center text-sm text-muted-foreground">
                          {match.scheduled_time}
                        </div>

                        {/* Placar */}
                        <div className="flex items-center justify-center space-x-6">
                          <div className="flex items-center space-x-3">
                            <Badge className={teamColors[match.team_home]}>
                              {teamNames[match.team_home]}
                            </Badge>
                            <span className="text-4xl font-bold text-primary">
                              {match.score_home}
                            </span>
                          </div>
                          <span className="text-2xl text-muted-foreground">×</span>
                          <div className="flex items-center space-x-3">
                            <span className="text-4xl font-bold text-primary">
                              {match.score_away}
                            </span>
                            <Badge className={teamColors[match.team_away]}>
                              {teamNames[match.team_away]}
                            </Badge>
                          </div>
                        </div>

                        {/* Gols */}
                        {match.goals && match.goals.length > 0 && (
                          <div className="border-t border-border pt-4 space-y-2">
                            {match.goals
                              .sort((a, b) => a.minute - b.minute)
                              .map((goal, idx) => (
                                <div
                                  key={idx}
                                  className={`text-sm ${
                                    goal.team_color === match.team_home
                                      ? "text-left"
                                      : "text-right"
                                  }`}
                                >
                                  <span className="text-foreground">
                                    {goal.player?.name}
                                    {goal.assist?.player?.name &&
                                      ` (${goal.assist.player.name})`}
                                  </span>
                                  <span className="text-muted-foreground ml-2">
                                    {goal.minute}'
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}

                        {/* Status */}
                        {currentRound.status === "completed" && (
                          <Badge
                            variant="outline"
                            className="self-center border-primary text-primary"
                          >
                            Encerrado
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
