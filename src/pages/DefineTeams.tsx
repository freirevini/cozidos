import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shuffle } from "lucide-react";

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
  meio_campo: "MC",
  atacante: "AT",
};

export default function DefineTeams() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [numTeams, setNumTeams] = useState<number>(0);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Record<string, TeamPlayer[]>>({});
  const [step, setStep] = useState<'select-teams' | 'define-players'>('select-teams');

  useEffect(() => {
    checkAdmin();
    loadAvailablePlayers();
  }, []);

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

  const handleTeamSelection = () => {
    if (selectedTeams.length !== numTeams) {
      toast.error(`Selecione exatamente ${numTeams} times`);
      return;
    }
    
    // Inicializar os times vazios
    const initialTeams: Record<string, TeamPlayer[]> = {};
    selectedTeams.forEach(team => {
      initialTeams[team] = [];
    });
    setTeams(initialTeams);
    setStep('define-players');
  };

  const balanceTeams = () => {
    setLoading(true);
    
    try {
      const levels = ['A', 'B', 'C', 'D', 'E'];
      const playersByLevel: Record<string, Player[]> = {};
      
      levels.forEach(level => {
        playersByLevel[level] = availablePlayers.filter(
          p => p.level?.toUpperCase() === level && p.position !== 'goleiro'
        );
      });

      const totalFieldPlayers = Object.values(playersByLevel).flat().length;
      const requiredPlayers = selectedTeams.length * 5; // 5 jogadores de linha por time
      
      if (totalFieldPlayers < requiredPlayers) {
        toast.error(`Não há jogadores de linha suficientes. Necessário: ${requiredPlayers}, Disponível: ${totalFieldPlayers}`);
        setLoading(false);
        return;
      }

      const shuffle = <T,>(array: T[]): T[] => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };

      const newTeams: Record<string, TeamPlayer[]> = {};
      selectedTeams.forEach(team => {
        newTeams[team] = [];
      });

      // Distribuir jogadores de linha por nível
      levels.forEach(level => {
        const shuffled = shuffle(playersByLevel[level]);
        let playerIndex = 0;
        selectedTeams.forEach((team) => {
          if (shuffled[playerIndex]) {
            newTeams[team].push({ ...shuffled[playerIndex], team_color: team });
            playerIndex++;
          }
        });
      });

      // Adicionar goleiros disponíveis (se houver)
      const goalkeepers = availablePlayers.filter(p => p.position === 'goleiro');
      const shuffledGoalkeepers = shuffle(goalkeepers);
      selectedTeams.forEach((team, index) => {
        if (shuffledGoalkeepers[index]) {
          newTeams[team].push({ ...shuffledGoalkeepers[index], team_color: team });
        }
      });

      setTeams(newTeams);
      toast.success("Times balanceados com sucesso!");
    } catch (error) {
      console.error("Erro ao balancear times:", error);
      toast.error("Erro ao balancear times");
    } finally {
      setLoading(false);
    }
  };

  const updateTeamPlayer = (teamColor: string, index: number, playerId: string) => {
    const newTeams = { ...teams };
    if (!newTeams[teamColor]) newTeams[teamColor] = [];

    // Remover seleção
    if (!playerId || playerId === "none") {
      if (newTeams[teamColor][index] !== undefined) {
        newTeams[teamColor].splice(index, 1);
      }
      setTeams(newTeams);
      return;
    }

    const selectedPlayer = availablePlayers.find(p => p.id === playerId);
    if (!selectedPlayer) return;

    newTeams[teamColor][index] = { ...selectedPlayer, team_color: teamColor };
    setTeams(newTeams);
  };

  const validateTeams = (): boolean => {
    for (const teamColor of selectedTeams) {
      const teamPlayers = teams[teamColor] || [];
      const fieldPlayers = teamPlayers.filter(p => p.position !== 'goleiro');
      
      if (fieldPlayers.length < 5) {
        toast.error(`Time ${teamColor} precisa ter pelo menos 5 jogadores de linha`);
        return false;
      }
      
      // Validar que tem pelo menos um jogador de cada nível A, B, C, D, E
      const levels = ['A', 'B', 'C', 'D', 'E'];
      for (const level of levels) {
        const hasLevel = fieldPlayers.some(p => p.level?.toUpperCase() === level);
        if (!hasLevel) {
          toast.error(`Time ${teamColor} precisa ter pelo menos um jogador de nível ${level}`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSaveTeams = async () => {
    if (Object.keys(teams).length === 0) {
      toast.error("Defina os times primeiro");
      return;
    }

    if (!validateTeams()) {
      return;
    }

    setLoading(true);

    try {
      const { data: latestRound } = await supabase
        .from("rounds")
        .select("round_number")
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const newRoundNumber = (latestRound?.round_number || 0) + 1;

      const today = new Date();
      const daysUntilThursday = (4 - today.getDay() + 7) % 7 || 7;
      const nextThursday = new Date(today);
      nextThursday.setDate(today.getDate() + daysUntilThursday);

      const { data: newRound, error: roundError } = await supabase
        .from("rounds")
        .insert({
          round_number: newRoundNumber,
          scheduled_date: nextThursday.toISOString().split('T')[0],
          status: 'pending',
        })
        .select()
        .single();

      if (roundError) throw roundError;

      for (const teamColor of Object.keys(teams)) {
        const { error: teamError } = await supabase
          .from("round_teams")
          .insert({
            round_id: newRound.id,
            team_color: teamColor as "branco" | "vermelho" | "azul" | "laranja",
          });

        if (teamError) throw teamError;

        const teamPlayers = teams[teamColor].map(player => ({
          round_id: newRound.id,
          player_id: player.id,
          team_color: teamColor as "branco" | "vermelho" | "azul" | "laranja",
        }));

        const { error: playersError } = await supabase
          .from("round_team_players")
          .insert(teamPlayers);

        if (playersError) throw playersError;

        const attendanceRecords = teams[teamColor].map(player => ({
          round_id: newRound.id,
          player_id: player.id,
          team_color: teamColor as "branco" | "vermelho" | "azul" | "laranja",
          status: 'presente' as "presente" | "atrasado" | "falta",
        }));

        const { error: attendanceError } = await supabase
          .from("player_attendance")
          .insert(attendanceRecords);

        if (attendanceError) throw attendanceError;
      }

      toast.success("Times salvos com sucesso!");
      navigate("/admin/teams/manage");
    } catch (error: any) {
      console.error("Erro ao salvar times:", error);
      toast.error("Erro ao salvar times: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text text-center">
              DEFINIR TIMES
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === 'select-teams' ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Quantos times jogarão nessa rodada?
                  </label>
                  <Select value={numTeams ? numTeams.toString() : undefined} onValueChange={(v) => setNumTeams(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 times</SelectItem>
                      <SelectItem value="4">4 times</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {numTeams > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Selecione os {numTeams} times:
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {['branco', 'vermelho', 'azul', 'laranja'].map((team) => (
                        <button
                          key={team}
                          onClick={() => {
                            if (selectedTeams.includes(team)) {
                              setSelectedTeams(selectedTeams.filter(t => t !== team));
                            } else if (selectedTeams.length < numTeams) {
                              setSelectedTeams([...selectedTeams, team]);
                            }
                          }}
                          className={`p-4 rounded-lg font-bold capitalize transition-all ${
                            selectedTeams.includes(team)
                              ? teamColors[team]
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {team}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={() => navigate("/admin/teams")} variant="outline" className="flex-1">
                    Voltar
                  </Button>
                  <Button 
                    onClick={handleTeamSelection} 
                    disabled={selectedTeams.length !== numTeams}
                    className="flex-1"
                  >
                    Definir Jogadores
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-sm text-muted-foreground mb-4">
                  Selecione manualmente os jogadores para cada time. Cada time precisa ter 5 jogadores de linha (um de cada nível A, B, C, D, E) e pode ter 1 goleiro (opcional).
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="p-3 border border-border text-left font-semibold">Níveis</th>
                        {selectedTeams.map((team) => (
                          <th key={team} className="p-3 border border-border">
                            <Badge className={teamColors[team] + " text-base py-2 px-4"}>
                              {team.toUpperCase()}
                            </Badge>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {['A', 'B', 'C', 'D', 'E', 'GR'].map((level, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-muted/20' : ''}>
                          <td className="p-3 border border-border font-bold text-center">
                            {level}
                          </td>
                          {selectedTeams.map((team) => {
                            const player = teams[team]?.[index];
                            const usedPlayerIds = Object.values(teams).flat().map(p => p.id);
                            
                            return (
                              <td key={team} className="p-3 border border-border">
                                <Select
                                  value={player?.id || ""}
                                  onValueChange={(playerId) => updateTeamPlayer(team, index, playerId)}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder={level === 'GR' ? "Goleiro (opcional)" : `Jogador ${level}`}>
                                      {player && (
                                        <div className="flex items-center justify-between w-full">
                                          <span className="flex-1 text-left truncate">
                                            {player.nickname || player.name}
                                          </span>
                                          <span className="text-xs font-bold text-muted-foreground ml-2">
                                            {positionLabels[player.position]}
                                          </span>
                                        </div>
                                      )}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Nenhum</SelectItem>
                                    {availablePlayers
                                      .filter(p => {
                                        if (level === 'GR') {
                                          return p.position === 'goleiro' && (!usedPlayerIds.includes(p.id) || p.id === player?.id);
                                        }
                                        return p.level?.toUpperCase() === level && p.position !== 'goleiro' && (!usedPlayerIds.includes(p.id) || p.id === player?.id);
                                      })
                                      .map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                          <div className="flex items-center gap-2">
                                            <span>{p.nickname || p.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                              ({positionLabels[p.position]})
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

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={() => setStep('select-teams')} variant="outline" className="w-full sm:flex-1">
                    Voltar
                  </Button>
                  <Button onClick={handleSaveTeams} disabled={loading} className="w-full sm:flex-1">
                    {loading ? "Salvando..." : "Finalizar Times"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}