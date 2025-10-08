import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Round {
  id: string;
  round_number: number;
  scheduled_date: string | null;
  status: string;
}

interface TeamPlayer {
  id: string;
  player_id: string;
  team_color: string;
  profiles: {
    name: string;
    nickname: string | null;
    position: string | null;
    level: string | null;
  };
}

const teamColorMap: Record<string, string> = {
  vermelho: "Vermelho",
  azul: "Azul",
  branco: "Branco",
  preto: "Preto",
  verde: "Verde",
  amarelo: "Amarelo",
};

const positionMap: Record<string, string> = {
  goleiro: "Goleiro",
  defensor: "Defensor",
  "meio-campista": "Meio-Campista",
  atacante: "Atacante",
};

export default function ViewTeams() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkAdmin();
    loadRounds();
  }, []);

  useEffect(() => {
    if (selectedRound) {
      loadTeamPlayers();
    }
  }, [selectedRound]);

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
      const { data, error } = await supabase
        .from("rounds")
        .select("*")
        .order("round_number", { ascending: false });

      if (error) throw error;

      setRounds(data || []);
      if (data && data.length > 0) {
        setSelectedRound(data[0].id);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar rodadas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTeamPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from("round_team_players")
        .select(`
          id,
          player_id,
          team_color,
          profiles:player_id (
            name,
            nickname,
            position,
            level
          )
        `)
        .eq("round_id", selectedRound);

      if (error) throw error;
      setTeamPlayers(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar times",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  };

  const selectedRoundData = rounds.find((r) => r.id === selectedRound);

  const teamsByColor = teamPlayers.reduce((acc, player) => {
    if (!acc[player.team_color]) {
      acc[player.team_color] = [];
    }
    acc[player.team_color].push(player);
    return acc;
  }, {} as Record<string, TeamPlayer[]>);

  return (
    <div className="min-h-screen bg-background">
      <Header isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text text-center">
              TIMES
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : rounds.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma rodada disponível
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Selecione a Rodada</label>
                  <Select value={selectedRound} onValueChange={setSelectedRound}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma rodada" />
                    </SelectTrigger>
                    <SelectContent>
                      {rounds.map((round) => (
                        <SelectItem key={round.id} value={round.id}>
                          Rodada {round.round_number} - {formatDate(round.scheduled_date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRoundData && (
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-primary">
                      Rodada {selectedRoundData.round_number}
                    </h2>
                    <p className="text-muted-foreground">
                      {formatDate(selectedRoundData.scheduled_date)}
                    </p>
                  </div>
                )}

                {Object.keys(teamsByColor).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Times ainda não foram definidos para esta rodada
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(teamsByColor).map(([color, players]) => (
                      <Card key={color} className="border-2">
                        <CardHeader>
                          <CardTitle className="text-xl font-bold text-center">
                            <Badge
                              className={`
                                ${color === "vermelho" ? "bg-red-600" : ""}
                                ${color === "azul" ? "bg-blue-600" : ""}
                                ${color === "branco" ? "bg-white text-black border border-gray-300" : ""}
                                ${color === "preto" ? "bg-black" : ""}
                                ${color === "verde" ? "bg-green-600" : ""}
                                ${color === "amarelo" ? "bg-yellow-500 text-black" : ""}
                                text-lg px-4 py-2
                              `}
                            >
                              {teamColorMap[color] || color}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {players.map((player) => (
                              <div
                                key={player.id}
                                className="p-3 rounded-lg bg-muted/20 border border-border"
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <p className="font-semibold">
                                      {player.profiles.nickname || player.profiles.name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {player.profiles.position
                                        ? positionMap[player.profiles.position]
                                        : "-"}
                                    </p>
                                  </div>
                                  {player.profiles.level && (
                                    <Badge variant="outline" className="ml-2">
                                      Nível {player.profiles.level.toUpperCase()}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
