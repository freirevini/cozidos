import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
interface PlayerStat {
  player_id: string;
  player_name: string;
  position: string;
  goals: number;
  assists: number;
}
interface Round {
  id: string;
  round_number: number;
}
interface Player {
  id: string;
  name: string;
}
export default function Statistics() {
  const [topScorers, setTopScorers] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("all");
  const [selectedPlayer, setSelectedPlayer] = useState<string>("all");
  useEffect(() => {
    checkAdmin();
    loadRoundsAndPlayers();
  }, []);
  useEffect(() => {
    loadStatistics();
  }, [selectedRound, selectedPlayer]);
  const checkAdmin = async () => {
    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (user) {
      const {
        data
      } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      setIsAdmin(data?.role === "admin");
    }
  };
  const loadRoundsAndPlayers = async () => {
    try {
      const {
        data: roundsData
      } = await supabase.from("rounds").select("id, round_number").order("round_number", {
        ascending: true
      });
      const {
        data: playersData
      } = await supabase.from("profiles").select("id, name, nickname").eq("is_player", true).eq("is_approved", true).order("name", {
        ascending: true
      });
      setRounds(roundsData || []);
      setPlayers((playersData || []).map(p => ({
        id: p.id,
        name: p.nickname || p.name
      })));
    } catch (error) {
      console.error("Erro ao carregar rodadas e jogadores:", error);
    }
  };
  const loadStatistics = async () => {
    try {
      setLoading(true);

      // Buscar jogadores de profiles ao invés de players
      let playersQuery = supabase.from("profiles").select("*").eq("is_player", true).eq("is_approved", true);
      if (selectedPlayer !== "all") {
        playersQuery = playersQuery.eq("id", selectedPlayer);
      }
      const {
        data: playersData
      } = await playersQuery;
      if (!playersData) return;
      const statsPromises = playersData.map(async player => {
        let goalsQuery = supabase.from("goals").select("*, match_id").eq("player_id", player.id).eq("is_own_goal", false);
        let assistsQuery = supabase.from("assists").select("*, goal_id, goals!inner(match_id)").eq("player_id", player.id);
        if (selectedRound !== "all") {
          const {
            data: matches
          } = await supabase.from("matches").select("id").eq("round_id", selectedRound);
          const matchIds = matches?.map(m => m.id) || [];
          if (matchIds.length > 0) {
            goalsQuery = goalsQuery.in("match_id", matchIds);
            assistsQuery = assistsQuery.in("goals.match_id", matchIds);
          } else {
            return {
              player_id: player.id,
              player_name: player.name,
              position: player.position,
              goals: 0,
              assists: 0
            };
          }
        }
        const {
          data: goals
        } = await goalsQuery;
        const {
          data: assists
        } = await assistsQuery;
        return {
          player_id: player.id,
          player_name: player.nickname || player.name,
          position: player.position || "atacante",
          goals: goals?.length || 0,
          assists: assists?.length || 0
        };
      });
      const stats = await Promise.all(statsPromises);
      stats.sort((a, b) => b.goals - a.goals);
      setTopScorers(stats);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };
  const getPositionLabel = (position: string) => {
    const labels: Record<string, string> = {
      goleiro: "Goleiro",
      defensor: "Defensor",
      "meio-campista": "Meio-Campo",
      atacante: "Atacante"
    };
    return labels[position] || position;
  };
  return <div className="min-h-screen bg-background">
      <Header isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Select value={selectedRound} onValueChange={setSelectedRound}>
              <SelectTrigger className="w-full bg-card border-border">
                <SelectValue placeholder="Filtrar por rodada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as rodadas</SelectItem>
                {rounds.map(round => <SelectItem key={round.id} value={round.id}>
                    Rodada {round.round_number}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
              <SelectTrigger className="w-full bg-card border-border">
                <SelectValue placeholder="Filtrar por jogador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os jogadores</SelectItem>
                {players.map(player => <SelectItem key={player.id} value={player.id}>
                    {player.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <Card className="card-glow bg-card border-border">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-primary glow-text">
                ARTILHARIA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-8">Carregando...</div> : topScorers.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  Nenhum resultado encontrado
                </div> : <div className="space-y-4">
                  {topScorers.map((player, index) => <div key={player.player_id} className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border hover:bg-muted/30 transition-colors">
                      <div className="flex items-center space-x-4">
                        <span className="text-2xl font-bold text-primary w-8">
                          {index + 1}
                        </span>
                        
                        <div>
                          <div className="font-bold text-foreground">
                            {player.player_name}
                          </div>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-primary">{player.goals}</div>
                    </div>)}
                </div>}
            </CardContent>
          </Card>

          <Card className="card-glow bg-card border-border">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-primary glow-text">
                ASSISTÊNCIAS
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-8">Carregando...</div> : topScorers.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  Nenhum resultado encontrado
                </div> : <div className="space-y-4">
                  {[...topScorers].sort((a, b) => b.assists - a.assists).map((player, index) => <div key={player.player_id} className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center space-x-4">
                          <span className="text-2xl font-bold text-primary w-8">
                            {index + 1}
                          </span>
                          
                          <div>
                            <div className="font-bold text-foreground">
                              {player.player_name}
                            </div>
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-primary">{player.assists}</div>
                      </div>)}
                </div>}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>;
}