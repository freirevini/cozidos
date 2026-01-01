import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Player {
  id: string;
  name: string;
  nickname: string | null;
  level: string;
  position: string;
}

interface TeamPlayer extends Player {
  team_color: string;
}

const teamColors: Record<string, string> = {
  branco: "bg-white text-black border border-gray-300",
  vermelho: "bg-red-600 text-white",
  azul: "bg-blue-600 text-white",
  laranja: "bg-orange-500 text-white",
};

const positionLabels: Record<string, string> = {
  goleiro: "GR",
  defensor: "DF",
  "meio-campista": "MC",
  atacante: "AT",
};

export default function ViewRound() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState<any>(null);
  const [teams, setTeams] = useState<Record<string, TeamPlayer[]>>({});
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  useEffect(() => {
    checkAdmin();
    loadRoundData();
  }, [roundId]);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (data?.role !== "admin") {
        toast.error("Acesso não autorizado");
        navigate("/");
        return;
      }
      setIsAdmin(data?.role === "admin");
    }
  };

  const loadRoundData = async () => {
    try {
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;
      setRound(roundData);

      const { data: teamPlayers, error: playersError } = await supabase
        .from("round_team_players")
        .select(`
          player_id,
          team_color,
          profiles:player_id (
            id,
            name,
            nickname,
            level,
            position
          )
        `)
        .eq("round_id", roundId);

      if (playersError) throw playersError;

      const teamsData: Record<string, TeamPlayer[]> = {};
      const colors = new Set<string>();

      teamPlayers.forEach((tp: any) => {
        const player = tp.profiles;
        const teamColor = tp.team_color;
        colors.add(teamColor);

        if (!teamsData[teamColor]) {
          teamsData[teamColor] = [];
        }

        teamsData[teamColor].push({
          id: player.id,
          name: player.name,
          nickname: player.nickname,
          level: player.level,
          position: player.position,
          team_color: teamColor,
        });
      });

      setTeams(teamsData);
      setSelectedTeams(Array.from(colors));
    } catch (error: any) {
      console.error("Erro ao carregar rodada:", error);
      toast.error("Erro ao carregar dados da rodada");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Carregando...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text text-center">
              TIMES - RODADA {round?.round_number}
            </CardTitle>
            <p className="text-center text-muted-foreground">
              {round && new Date(round.scheduled_date + "T00:00:00").toLocaleDateString('pt-BR')}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {selectedTeams.map((teamColor) => (
                  <Card key={teamColor} className="bg-muted/20 border-border">
                    <CardHeader className="pb-3">
                      <Badge className={teamColors[teamColor] + " text-lg py-2 justify-center"}>
                        {teamColor.toUpperCase()}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {teams[teamColor]?.map((player, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-background rounded border border-border"
                          >
                            <div className="flex items-center gap-2">
                              {player.position !== 'goleiro' && (
                                <Badge variant="outline" className="text-xs">
                                  {player.level?.toUpperCase()}
                                </Badge>
                              )}
                              <span className="text-sm font-medium">
                                {player.nickname || player.name}
                              </span>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {positionLabels[player.position] || player.position}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button
                onClick={() => navigate("/admin/teams/manage")}
                variant="outline"
                className="w-full"
              >
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
