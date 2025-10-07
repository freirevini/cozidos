import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function EditRound() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [round, setRound] = useState<any>(null);
  const [teams, setTeams] = useState<Record<string, TeamPlayer[]>>({});
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  useEffect(() => {
    checkAdmin();
    loadRoundData();
    loadAvailablePlayers();
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

  const loadAvailablePlayers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_player", true)
        .eq("status", "aprovado")
        .not("level", "is", null)
        .not("position", "is", null);

      if (error) throw error;
      setAvailablePlayers(data || []);
    } catch (error) {
      console.error("Erro ao carregar jogadores:", error);
      toast.error("Erro ao carregar jogadores disponíveis");
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

  const updateTeamPlayer = (teamColor: string, index: number, playerId: string) => {
    const selectedPlayer = availablePlayers.find(p => p.id === playerId);
    if (!selectedPlayer) {
      // Remove player
      const newTeams = { ...teams };
      newTeams[teamColor] = newTeams[teamColor].filter((_, i) => i !== index);
      setTeams(newTeams);
      return;
    }

    const newTeams = { ...teams };
    if (!newTeams[teamColor]) {
      newTeams[teamColor] = [];
    }
    
    if (newTeams[teamColor][index]) {
      newTeams[teamColor][index] = { ...selectedPlayer, team_color: teamColor };
    } else {
      newTeams[teamColor].push({ ...selectedPlayer, team_color: teamColor });
    }
    
    setTeams(newTeams);
  };

  const handleSaveChanges = async () => {
    // Validate teams
    for (const teamColor of selectedTeams) {
      const teamPlayers = teams[teamColor] || [];
      const fieldPlayers = teamPlayers.filter(p => p.position !== 'goleiro');
      
      if (fieldPlayers.length < 5) {
        toast.error(`Time ${teamColor} precisa ter pelo menos 5 jogadores de linha`);
        return;
      }
    }

    setSaving(true);

    try {
      // Delete existing team players
      const { error: deleteError } = await supabase
        .from("round_team_players")
        .delete()
        .eq("round_id", roundId);

      if (deleteError) throw deleteError;

      // Delete existing attendance
      const { error: deleteAttendanceError } = await supabase
        .from("player_attendance")
        .delete()
        .eq("round_id", roundId);

      if (deleteAttendanceError) throw deleteAttendanceError;

      // Insert updated team players
      for (const teamColor of Object.keys(teams)) {
        const teamPlayers = teams[teamColor].map(player => ({
          round_id: roundId,
          player_id: player.id,
          team_color: teamColor as "branco" | "vermelho" | "azul" | "laranja",
        }));

        const { error: playersError } = await supabase
          .from("round_team_players")
          .insert(teamPlayers);

        if (playersError) throw playersError;

        const attendanceRecords = teams[teamColor].map(player => ({
          round_id: roundId,
          player_id: player.id,
          team_color: teamColor as "branco" | "vermelho" | "azul" | "laranja",
          status: 'presente' as "presente" | "atrasado" | "falta",
        }));

        const { error: attendanceError } = await supabase
          .from("player_attendance")
          .insert(attendanceRecords);

        if (attendanceError) throw attendanceError;
      }

      toast.success("Times atualizados com sucesso!");
      navigate("/admin/teams/manage");
    } catch (error: any) {
      console.error("Erro ao salvar alterações:", error);
      toast.error("Erro ao salvar alterações: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAdmin={isAdmin} />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Carregando...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text text-center">
              EDITAR TIMES - RODADA {round?.round_number}
            </CardTitle>
            <p className="text-center text-muted-foreground">
              {round && new Date(round.scheduled_date).toLocaleDateString('pt-BR')}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {selectedTeams.map((team) => (
                        <th key={team} className="p-4 border border-border">
                          <Badge className={teamColors[team] + " text-lg"}>
                            {team.toUpperCase()}
                          </Badge>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                      <tr key={index}>
                        {selectedTeams.map((team) => {
                          const player = teams[team]?.[index];
                          return (
                            <td key={team} className="p-4 border border-border">
                              <Select
                                value={player?.id || ""}
                                onValueChange={(playerId) => updateTeamPlayer(team, index, playerId)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Selecione um jogador">
                                    {player && (
                                      <div className="flex items-center justify-between w-full">
                                        {player.position !== 'goleiro' && (
                                          <span className="text-xs font-bold text-primary mr-2">
                                            {player.level?.toUpperCase()}
                                          </span>
                                        )}
                                        <span className="flex-1 text-left">
                                          {player.nickname || player.name}
                                        </span>
                                        <span className="text-xs font-bold text-muted-foreground ml-2">
                                          {positionLabels[player.position] || player.position}
                                        </span>
                                      </div>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nenhum</SelectItem>
                                  {availablePlayers.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      <div className="flex items-center gap-2">
                                        {p.position !== 'goleiro' && (
                                          <span className="text-xs font-bold text-primary">
                                            {p.level?.toUpperCase()}
                                          </span>
                                        )}
                                        <span>{p.nickname || p.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          ({positionLabels[p.position] || p.position})
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => navigate("/admin/teams/manage")} 
                  variant="outline" 
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSaveChanges} 
                  disabled={saving} 
                  className="flex-1"
                >
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
