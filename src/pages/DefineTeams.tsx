import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ChevronDown, ChevronUp, Shuffle, Calendar, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/errorHandler";

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

interface IneligiblePlayer {
  id: string;
  name: string;
  nickname: string | null;
  reasons: string[];
}

const teamColors: Record<string, string> = {
  branco: "bg-white text-black border border-gray-300",
  vermelho: "bg-red-600 text-white",
  azul: "bg-blue-600 text-white",
  laranja: "bg-orange-500 text-white",
};

const teamColorsBg: Record<string, string> = {
  branco: "border-gray-300 bg-white/10",
  vermelho: "border-red-600 bg-red-600/10",
  azul: "border-blue-600 bg-blue-600/10",
  laranja: "border-orange-500 bg-orange-500/10",
};

const positionLabels: Record<string, string> = {
  goleiro: "GR",
  defensor: "DF",
  "meio-campista": "MC",
  meio_campo: "MC",
  atacante: "AT",
};

export default function DefineTeams() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [numTeams, setNumTeams] = useState<number>(4);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(['branco', 'vermelho', 'azul', 'laranja']);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Record<string, TeamPlayer[]>>({});
  const [ineligiblePlayers, setIneligiblePlayers] = useState<IneligiblePlayer[]>([]);
  const [showIneligible, setShowIneligible] = useState(false);
  const [step, setStep] = useState<'config' | 'define-players'>('config');
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    // Default to today
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      toast.error("Acesso não autorizado");
    } else {
      loadAvailablePlayers();
    }
  }, [isAdmin, navigate]);

  // Auto-select teams when numTeams changes
  useEffect(() => {
    if (numTeams === 4) {
      setSelectedTeams(['branco', 'vermelho', 'azul', 'laranja']);
    } else if (numTeams === 3 && selectedTeams.length > 3) {
      // Keep only first 3 selected if switching from 4 to 3
      setSelectedTeams(prev => prev.slice(0, 3));
    }
  }, [numTeams]);

  const loadAvailablePlayers = async () => {
    try {
      const { data: allPlayers, error } = await supabase
        .from("profiles")
        .select("id, name, nickname, level, position, status, claim_token")
        .eq("status", "aprovado");

      if (error) throw error;

      const eligible: Player[] = [];
      const ineligible: IneligiblePlayer[] = [];

      (allPlayers || []).forEach((player) => {
        const reasons: string[] = [];

        if (player.name === null && player.nickname === null) reasons.push("Sem identificação");
        if (!player.level) reasons.push("Sem nível");
        if (!player.nickname) reasons.push("Sem apelido");

        if (reasons.length === 0) {
          eligible.push({
            id: player.id,
            name: player.name,
            nickname: player.nickname,
            level: player.level!,
            position: player.position || 'meio-campista',
          });
        } else {
          ineligible.push({
            id: player.id,
            name: player.name,
            nickname: player.nickname,
            reasons,
          });
        }
      });

      setAvailablePlayers(eligible);
      setIneligiblePlayers(ineligible);
    } catch (error) {
      console.error("Erro ao carregar jogadores:", error);
      toast.error("Erro ao carregar jogadores disponíveis");
    }
  };

  const toggleTeamSelection = (team: string) => {
    if (numTeams === 4) return; // Can't toggle when 4 teams

    if (selectedTeams.includes(team)) {
      if (selectedTeams.length > 1) {
        setSelectedTeams(selectedTeams.filter(t => t !== team));
      }
    } else if (selectedTeams.length < numTeams) {
      setSelectedTeams([...selectedTeams, team]);
    }
  };

  const dateSchema = z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime()) && parsed >= new Date(new Date().setHours(0, 0, 0, 0) - 86400000 * 7);
  }, "Data inválida ou muito antiga (máximo 7 dias atrás)");

  const handleContinue = () => {
    if (selectedTeams.length !== numTeams) {
      toast.error(`Selecione exatamente ${numTeams} times`);
      return;
    }

    const validation = dateSchema.safeParse(scheduledDate);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    // Initialize teams
    const initialTeams: Record<string, TeamPlayer[]> = {};
    const initialExpanded: Record<string, boolean> = {};
    selectedTeams.forEach((team, index) => {
      initialTeams[team] = [];
      initialExpanded[team] = index === 0; // Expand first team by default
    });
    setTeams(initialTeams);
    setExpandedTeams(initialExpanded);
    setStep('define-players');
  };

  const balanceTeams = () => {
    const goalkeepers = availablePlayers.filter(p => p.position === 'goleiro');
    const linePlayers = availablePlayers.filter(p => p.position !== 'goleiro');

    const levels = ['A', 'B', 'C', 'D', 'E'];
    const teamKeys = [...selectedTeams];

    const shuffle = <T,>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // Initialize teams with 6 slots (A, B, C, D, E, GR)
    const newTeams: Record<string, (TeamPlayer | null)[]> = {};
    teamKeys.forEach(team => {
      newTeams[team] = [null, null, null, null, null, null];
    });

    // Assign players by level at correct indices (A=0, B=1, C=2, D=3, E=4)
    levels.forEach((level, levelIndex) => {
      const playersAtLevel = shuffle(linePlayers.filter(p => p.level?.toUpperCase() === level));

      teamKeys.forEach((team, teamIdx) => {
        if (playersAtLevel[teamIdx]) {
          newTeams[team][levelIndex] = { ...playersAtLevel[teamIdx], team_color: team };
        }
      });
    });

    // Assign goalkeepers at index 5
    const shuffledGKs = shuffle(goalkeepers);
    teamKeys.forEach((team, idx) => {
      if (shuffledGKs[idx]) {
        newTeams[team][5] = { ...shuffledGKs[idx], team_color: team };
      }
    });

    setTeams(newTeams as Record<string, TeamPlayer[]>);
    toast.success("Times gerados automaticamente!");
  };

  const updateTeamPlayer = (teamColor: string, slotIndex: number, playerId: string) => {
    const player = playerId === 'none' || playerId === '' ? null : availablePlayers.find(p => p.id === playerId);

    setTeams(prev => {
      const newTeams = { ...prev };
      // Ensure we have an array with 6 slots
      const teamArray: (TeamPlayer | null)[] = Array(6).fill(null).map((_, i) => {
        const existing = (newTeams[teamColor] || [])[i];
        return existing || null;
      });

      if (player) {
        teamArray[slotIndex] = { ...player, team_color: teamColor };
      } else {
        teamArray[slotIndex] = null;
      }

      newTeams[teamColor] = teamArray as TeamPlayer[];
      return newTeams;
    });
  };

  const validateTeams = (): boolean => {
    for (const team of selectedTeams) {
      const teamPlayers = (teams[team] || []).filter(p => p && p.id);
      const linePlayers = teamPlayers.filter(p => p.position !== 'goleiro');

      if (linePlayers.length < 5) {
        toast.error(`Time ${team} precisa ter 5 jogadores de linha (atualmente tem ${linePlayers.length})`);
        return false;
      }
    }
    return true;
  };

  const handleSaveTeams = async () => {
    if (!validateTeams()) return;

    setLoading(true);
    try {
      // Create round
      const { data: latestRound } = await supabase
        .from("rounds")
        .select("round_number")
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const newRoundNumber = (latestRound?.round_number || 0) + 1;

      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .insert({
          round_number: newRoundNumber,
          scheduled_date: scheduledDate,
          status: 'a_iniciar'
        })
        .select()
        .single();

      if (roundError) throw roundError;

      // Create teams
      for (const teamColor of selectedTeams) {
        const { error: teamError } = await supabase
          .from("round_teams")
          .insert({
            round_id: roundData.id,
            team_color: teamColor
          });

        if (teamError) throw teamError;

        // Add players to team
        const teamPlayers = (teams[teamColor] || []).filter(p => p && p.id);
        for (const player of teamPlayers) {
          const { error: playerError } = await supabase
            .from("round_team_players")
            .insert({
              round_id: roundData.id,
              team_color: teamColor,
              player_id: player.id,
              is_goalkeeper: player.position === 'goleiro'
            });

          if (playerError) throw playerError;
        }
      }

      toast.success("Times definidos com sucesso!");
      navigate("/admin/teams");
    } catch (error: any) {
      console.error("Erro ao salvar times:", error);
      toast.error(getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const toggleTeamExpanded = (team: string) => {
    setExpandedTeams(prev => ({
      ...prev,
      [team]: !prev[team]
    }));
  };

  const getUsedPlayerIds = () => {
    return Object.values(teams).flat().filter(p => p && p.id).map(p => p.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <Card className="card-glow bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl sm:text-3xl font-bold text-primary glow-text text-center">
              DEFINIR TIMES
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === 'config' ? (
              <div className="space-y-5">
                {/* Toggle 3/4 times */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-muted-foreground">
                    Quantos times?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setNumTeams(3)}
                      className={`py-4 rounded-xl font-bold text-lg transition-all ${numTeams === 3
                        ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      3 times
                    </button>
                    <button
                      onClick={() => setNumTeams(4)}
                      className={`py-4 rounded-xl font-bold text-lg transition-all ${numTeams === 4
                        ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      4 times
                    </button>
                  </div>
                </div>

                {/* Team selection */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-muted-foreground">
                    {numTeams === 4 ? 'Times selecionados:' : `Selecione ${numTeams} times:`}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {['branco', 'vermelho', 'azul', 'laranja'].map((team) => {
                      const isSelected = selectedTeams.includes(team);
                      const isDisabled = numTeams === 4;

                      return (
                        <button
                          key={team}
                          onClick={() => toggleTeamSelection(team)}
                          disabled={isDisabled}
                          className={`p-4 rounded-xl font-bold capitalize transition-all min-h-[60px] border-2 ${isSelected
                            ? teamColors[team] + ' shadow-md'
                            : 'bg-muted/30 text-muted-foreground border-transparent'
                            } ${isDisabled ? 'cursor-default' : 'cursor-pointer hover:scale-[1.02]'}`}
                        >
                          {team}
                          {isSelected && (
                            <span className="ml-2">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date picker */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
                    <Calendar size={16} />
                    Data da rodada
                  </label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full h-14 text-lg"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => navigate("/admin/teams")}
                    variant="outline"
                    className="flex-1 h-14 text-base"
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={handleContinue}
                    disabled={selectedTeams.length !== numTeams || !scheduledDate}
                    className="flex-1 h-14 text-base"
                  >
                    <Users className="mr-2 h-5 w-5" />
                    Definir Jogadores
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Info banner */}
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <p className="text-sm text-foreground leading-relaxed">
                    Cada time precisa ter <strong>5 jogadores de linha</strong> (um de cada nível A, B, C, D, E)
                    e pode ter <strong>1 goleiro</strong> (opcional).
                  </p>
                </div>

                {/* Auto-generate button */}
                <Button
                  onClick={balanceTeams}
                  disabled={loading}
                  variant="secondary"
                  className="w-full py-6 text-base flex items-center justify-center gap-2 min-h-[56px]"
                >
                  <Shuffle size={20} />
                  Gerar Times Automaticamente
                </Button>

                {/* Team cards - vertical layout for mobile */}
                <div className="space-y-3">
                  {selectedTeams.map((teamColor) => {
                    const isExpanded = expandedTeams[teamColor] ?? true;
                    const teamPlayers = teams[teamColor] || [];
                    const linePlayersCount = teamPlayers.filter(p => p && p.position !== 'goleiro').length;
                    const hasGoalkeeper = teamPlayers.some(p => p && p.position === 'goleiro');

                    return (
                      <Card
                        key={teamColor}
                        className={`border-2 ${teamColorsBg[teamColor]} overflow-hidden`}
                      >
                        {/* Team header - always visible */}
                        <button
                          onClick={() => toggleTeamExpanded(teamColor)}
                          className="w-full p-4 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <Badge className={teamColors[teamColor] + " text-base py-2 px-4"}>
                              {teamColor.toUpperCase()}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {linePlayersCount}/5 linha {hasGoalkeeper ? '• GR ✓' : ''}
                            </span>
                          </div>
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>

                        {/* Team players - collapsible */}
                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-2">
                            {['A', 'B', 'C', 'D', 'E', 'GR'].map((level, index) => {
                              const player = teamPlayers[index];
                              const usedPlayerIds = getUsedPlayerIds();
                              const isGoalkeeperSlot = level === 'GR';

                              return (
                                <div
                                  key={level}
                                  className="flex items-center gap-3 bg-background/50 rounded-lg p-2"
                                >
                                  <span className="w-8 text-center font-bold text-sm text-muted-foreground">
                                    {level}
                                  </span>
                                  <Select
                                    value={player?.id || ""}
                                    onValueChange={(playerId) => updateTeamPlayer(teamColor, index, playerId)}
                                  >
                                    <SelectTrigger className="flex-1 h-12">
                                      <SelectValue placeholder={isGoalkeeperSlot ? "Goleiro (opcional)" : `Jogador ${level}`}>
                                        {player && (
                                          <div className="flex items-center justify-between w-full">
                                            <span className="truncate">
                                              {player.nickname || player.name}
                                            </span>
                                            <span className="text-xs font-bold text-muted-foreground ml-2">
                                              {positionLabels[player.position] || player.position || "N/A"}
                                            </span>
                                          </div>
                                        )}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Nenhum</SelectItem>
                                      {availablePlayers
                                        .filter(p => {
                                          if (isGoalkeeperSlot) {
                                            return p.position === 'goleiro' && (!usedPlayerIds.includes(p.id) || p.id === player?.id);
                                          }
                                          return p.level?.toUpperCase() === level && p.position !== 'goleiro' && (!usedPlayerIds.includes(p.id) || p.id === player?.id);
                                        })
                                        .map((p) => (
                                          <SelectItem key={p.id} value={p.id}>
                                            <div className="flex items-center gap-2">
                                              <span>{p.nickname || p.name}</span>
                                              <span className="text-xs text-muted-foreground">
                                                ({positionLabels[p.position] || p.position || "N/A"})
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>

                {/* Ineligible players */}
                {ineligiblePlayers.length > 0 && (
                  <Collapsible open={showIneligible} onOpenChange={setShowIneligible}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
                        <span className="flex items-center gap-2">
                          <AlertCircle size={16} className="text-yellow-500" />
                          {ineligiblePlayers.length} jogador(es) não elegível(is)
                        </span>
                        {showIneligible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                        {ineligiblePlayers.map((player) => (
                          <div key={player.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-2 bg-background/50 rounded">
                            <span className="font-medium text-sm">
                              {player.nickname || player.name}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {player.reasons.map((reason, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={() => setStep('config')} variant="outline" className="w-full sm:flex-1 h-14">
                    Voltar
                  </Button>
                  <Button onClick={handleSaveTeams} disabled={loading} className="w-full sm:flex-1 h-14">
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