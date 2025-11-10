import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface Match {
  id: string;
  match_number: number;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  scheduled_time: string;
  status: string;
}

interface Player {
  id: string;
  name: string;
  nickname: string | null;
}

interface Goal {
  id: string;
  player_id: string;
  minute: number;
  is_own_goal: boolean;
  team_color: string;
  player?: Player;
  assists?: Array<{ id: string; player_id: string; player?: Player }>;
}

interface Card {
  id: string;
  player_id: string;
  card_type: string;
  minute: number;
  player?: Player;
}

const teamColors: Record<string, string> = {
  branco: "bg-white text-black border border-gray-300",
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

interface Attendance {
  id: string;
  player_id: string;
  team_color: string;
  status: 'presente' | 'atrasado' | 'falta';
}

interface RoundPlayer {
  id: string;
  name: string;
  nickname: string | null;
  team_color: string;
}

interface ManageMatchDialogProps {
  matchId: string;
  roundId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function ManageMatchDialog({ matchId, roundId, open, onOpenChange, onSaved }: ManageMatchDialogProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Record<string, Player[]>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [roundPlayers, setRoundPlayers] = useState<RoundPlayer[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [goalData, setGoalData] = useState({
    team: "",
    player_id: "",
    has_assist: false,
    assist_player_id: "",
    is_own_goal: false,
  });
  const [cardData, setCardData] = useState({
    team: "",
    player_id: "",
    card_type: "",
  });
  const [goalMinute, setGoalMinute] = useState<number>(0);
  const [cardMinute, setCardMinute] = useState<number>(0);

  useEffect(() => {
    if (open) {
      loadMatchData();
      loadRoundPlayers();
      loadAttendance();
    }
  }, [open, matchId, roundId]);

  useEffect(() => {
    if (match) {
      loadPlayers();
    }
  }, [match, roundId]);

  const loadMatchData = async () => {
    try {
      const { data: matchData, error } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (error) throw error;
      setMatch(matchData);

      await loadGoals();
      await loadCards();
    } catch (error: any) {
      console.error("Erro ao carregar partida:", error);
      toast.error("Erro ao carregar dados da partida");
    }
  };

  const loadPlayers = async () => {
    try {
      if (!match) return;

      const { data: attendance } = await supabase
        .from("player_attendance")
        .select(`
          player_id,
          team_color,
          profiles!inner(id, name, nickname)
        `)
        .eq("round_id", roundId)
        .eq("status", "presente");

      const playersByTeam: Record<string, Player[]> = {
        [match.team_home]: [],
        [match.team_away]: [],
      };

      attendance?.forEach((att: any) => {
        const player = {
          id: att.profiles.id,
          name: att.profiles.name,
          nickname: att.profiles.nickname,
        };
        if (playersByTeam[att.team_color]) {
          playersByTeam[att.team_color].push(player);
        }
      });

      setPlayers(playersByTeam);
    } catch (error) {
      console.error("Erro ao carregar jogadores:", error);
    }
  };

  const loadGoals = async () => {
    try {
      const { data: goalsData } = await supabase
        .from("goals")
        .select("*")
        .eq("match_id", matchId)
        .order("minute", { ascending: true });

      if (!goalsData) return;

      const goalsWithDetails = await Promise.all(
        goalsData.map(async (goal) => {
          const { data: player } = await supabase
            .from("profiles")
            .select("id, name, nickname")
            .eq("is_approved", true)
            .eq("id", goal.player_id)
            .maybeSingle();

          const { data: assistsData } = await supabase
            .from("assists")
            .select("id, player_id")
            .eq("goal_id", goal.id);

          const assists = await Promise.all(
            (assistsData || []).map(async (assist) => {
              const { data: assistPlayer } = await supabase
                .from("profiles")
                .select("id, name, nickname")
                .eq("is_approved", true)
                .eq("id", assist.player_id)
                .maybeSingle();
              return { ...assist, player: assistPlayer };
            })
          );

          return { ...goal, player, assists };
        })
      );

      setGoals(goalsWithDetails);
    } catch (error) {
      console.error("Erro ao carregar gols:", error);
    }
  };

  const loadCards = async () => {
    try {
      const { data: cardsData } = await supabase
        .from("cards")
        .select("*")
        .eq("match_id", matchId)
        .order("minute", { ascending: true });

      if (!cardsData) return;

      const cardsWithPlayers = await Promise.all(
        cardsData.map(async (card) => {
          const { data: player } = await supabase
            .from("profiles")
            .select("id, name, nickname")
            .eq("is_approved", true)
            .eq("id", card.player_id)
            .maybeSingle();
          return { ...card, player };
        })
      );

      setCards(cardsWithPlayers);
    } catch (error) {
      console.error("Erro ao carregar cartões:", error);
    }
  };

  const loadRoundPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('round_team_players')
        .select(`
          player_id,
          team_color,
          profiles:player_id (id, name, nickname)
        `)
        .eq('round_id', roundId);
        
      if (!error && data) {
        const playersData = data.map((d: any) => ({ 
          id: d.profiles.id,
          name: d.profiles.name,
          nickname: d.profiles.nickname,
          team_color: d.team_color 
        }));
        setRoundPlayers(playersData);
      }
    } catch (error) {
      console.error("Erro ao carregar jogadores da rodada:", error);
    }
  };

  const loadAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('player_attendance')
        .select('*')
        .eq('round_id', roundId);
        
      if (!error && data) {
        const statusMap: Record<string, string> = {};
        data.forEach((att: Attendance) => {
          statusMap[att.player_id] = att.status;
        });
        setAttendanceData(statusMap);
      }
    } catch (error) {
      console.error("Erro ao carregar presença:", error);
    }
  };

  const updateAttendance = async (playerId: string, status: string) => {
    const player = roundPlayers.find(p => p.id === playerId);
    if (!player) return;
    
    try {
      const { error } = await supabase
        .from('player_attendance')
        .upsert({
          round_id: roundId,
          player_id: playerId,
          team_color: player.team_color as "azul" | "branco" | "laranja" | "vermelho",
          status: status as 'presente' | 'atrasado' | 'falta'
        }, {
          onConflict: 'round_id,player_id'
        });
        
      if (!error) {
        setAttendanceData({ ...attendanceData, [playerId]: status });
        toast.success(`Status atualizado: ${player.nickname || player.name}`);
      } else {
        toast.error("Erro ao atualizar presença");
      }
    } catch (error) {
      console.error("Erro ao atualizar presença:", error);
      toast.error("Erro ao atualizar presença");
    }
  };

  const getAttendanceStatus = (playerId: string) => {
    return attendanceData[playerId] || 'presente';
  };

  const handleAddGoal = async () => {
    if (!match || !goalData.team || (!goalData.player_id && !goalData.is_own_goal)) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      // Validar minuto (0-120)
      if (goalMinute < 0 || goalMinute > 120) {
        toast.error("Minuto inválido. Deve estar entre 0 e 120.");
        return;
      }
      
      const { data: goalInserted, error: goalError } = await supabase
        .from("goals")
        .insert([{
          match_id: matchId,
          player_id: goalData.is_own_goal ? null : goalData.player_id,
          team_color: goalData.team as "azul" | "branco" | "laranja" | "vermelho",
          minute: goalMinute,
          is_own_goal: goalData.is_own_goal,
        }])
        .select()
        .single();

      if (goalError) throw goalError;

      if (goalData.has_assist && goalData.assist_player_id && !goalData.is_own_goal) {
        const { error: assistError } = await supabase
          .from("assists")
          .insert({
            goal_id: goalInserted.id,
            player_id: goalData.assist_player_id,
          });

        if (assistError) throw assistError;
      }

      const newScore = goalData.team === match.team_home 
        ? { score_home: match.score_home + 1 } 
        : { score_away: match.score_away + 1 };

      const { error: updateError } = await supabase
        .from("matches")
        .update(newScore)
        .eq("id", matchId);

      if (updateError) throw updateError;

      toast.success("Gol adicionado com sucesso!");
      setAddingGoal(false);
      setGoalData({ team: "", player_id: "", has_assist: false, assist_player_id: "", is_own_goal: false });
      setGoalMinute(0);
      await loadMatchData();
    } catch (error: any) {
      console.error("Erro ao adicionar gol:", error);
      toast.error("Erro ao adicionar gol");
    }
  };

  const handleDeleteLastGoal = async () => {
    if (goals.length === 0) {
      toast.error("Não há gols para excluir");
      return;
    }

    try {
      const lastGoal = goals[goals.length - 1];

      await supabase.from("assists").delete().eq("goal_id", lastGoal.id);

      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", lastGoal.id);

      if (error) throw error;

      const newScore = lastGoal.team_color === match?.team_home 
        ? { score_home: (match?.score_home || 1) - 1 } 
        : { score_away: (match?.score_away || 1) - 1 };

      await supabase.from("matches").update(newScore).eq("id", matchId);

      toast.success("Último gol excluído com sucesso!");
      await loadMatchData();
    } catch (error: any) {
      console.error("Erro ao excluir gol:", error);
      toast.error("Erro ao excluir gol");
    }
  };

  const handleAddCard = async () => {
    if (!cardData.team || !cardData.player_id || !cardData.card_type) {
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      // Validar minuto (0-120)
      if (cardMinute < 0 || cardMinute > 120) {
        toast.error("Minuto inválido. Deve estar entre 0 e 120.");
        return;
      }

      const { error } = await supabase.from("cards").insert([{
        match_id: matchId,
        player_id: cardData.player_id,
        card_type: cardData.card_type as "amarelo" | "azul",
        minute: cardMinute,
      }]);

      if (error) throw error;

      toast.success("Cartão adicionado com sucesso!");
      setAddingCard(false);
      setCardData({ team: "", player_id: "", card_type: "" });
      setCardMinute(0);
      await loadCards();
    } catch (error: any) {
      console.error("Erro ao adicionar cartão:", error);
      toast.error("Erro ao adicionar cartão");
    }
  };

  const handleDeleteLastCard = async () => {
    if (cards.length === 0) {
      toast.error("Não há cartões para excluir");
      return;
    }

    try {
      const lastCard = cards[cards.length - 1];
      const { error } = await supabase
        .from("cards")
        .delete()
        .eq("id", lastCard.id);

      if (error) throw error;

      toast.success("Último cartão excluído com sucesso!");
      await loadCards();
    } catch (error: any) {
      console.error("Erro ao excluir cartão:", error);
      toast.error("Erro ao excluir cartão");
    }
  };

  const handleSaveMatch = () => {
    toast.success("Partida salva com sucesso!");
    onSaved();
    onOpenChange(false);
  };

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            Editar Partida
          </DialogTitle>
        </DialogHeader>

        <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-8">
              <div className="flex flex-col items-center space-y-2">
                <Badge className={teamColors[match.team_home] + " py-2 px-6"}>
                  {teamNames[match.team_home]}
                </Badge>
                <span className="text-5xl font-bold text-primary">
                  {match.score_home}
                </span>
              </div>

              <div className="text-3xl text-muted-foreground font-bold">×</div>

              <div className="flex flex-col items-center space-y-2">
                <Badge className={teamColors[match.team_away] + " py-2 px-6"}>
                  {teamNames[match.team_away]}
                </Badge>
                <span className="text-5xl font-bold text-primary">
                  {match.score_away}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Gols ({goals.length})</h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => setAddingGoal(!addingGoal)}
                  size="sm"
                  className="bg-primary hover:bg-secondary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Gol
                </Button>
                <Button
                  onClick={handleDeleteLastGoal}
                  size="sm"
                  variant="destructive"
                  disabled={goals.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Último
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {addingGoal && (
              <Card className="bg-muted/20 p-4 space-y-3">
                <Select
                  value={goalData.team}
                  onValueChange={(value) => setGoalData({ ...goalData, team: value, player_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={match.team_home}>{teamNames[match.team_home]}</SelectItem>
                    <SelectItem value={match.team_away}>{teamNames[match.team_away]}</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_own_goal"
                    checked={goalData.is_own_goal}
                    onChange={(e) => setGoalData({ ...goalData, is_own_goal: e.target.checked, player_id: "" })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="is_own_goal" className="text-sm">Gol Contra</label>
                </div>

                {!goalData.is_own_goal && goalData.team && (
                  <>
                    <Select
                      value={goalData.player_id}
                      onValueChange={(value) => setGoalData({ ...goalData, player_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Jogador que marcou" />
                      </SelectTrigger>
                      <SelectContent>
                        {(players[goalData.team] || []).map((player) => (
                          <SelectItem key={player.id} value={player.id}>
                            {player.nickname || player.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="has_assist"
                        checked={goalData.has_assist}
                        onChange={(e) => setGoalData({ ...goalData, has_assist: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <label htmlFor="has_assist" className="text-sm">Adicionar assistência</label>
                    </div>

                    {goalData.has_assist && (
                      <Select
                        value={goalData.assist_player_id}
                        onValueChange={(value) => setGoalData({ ...goalData, assist_player_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Jogador da assistência" />
                        </SelectTrigger>
                        <SelectContent>
                          {(players[goalData.team] || [])
                            .filter(p => p.id !== goalData.player_id)
                            .map((player) => (
                              <SelectItem key={player.id} value={player.id}>
                                {player.nickname || player.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  </>
                )}

                {/* Campo de Minuto */}
                <div className="space-y-1">
                  <label htmlFor="goal-minute" className="text-sm font-medium">
                    Minuto do Gol
                  </label>
                  <input
                    id="goal-minute"
                    type="number"
                    min="0"
                    max="120"
                    value={goalMinute}
                    onChange={(e) => setGoalMinute(Math.max(0, Math.min(120, parseInt(e.target.value) || 0)))}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                    placeholder="0-120"
                  />
                  <p className="text-xs text-muted-foreground">Digite o minuto entre 0 e 120</p>
                </div>

                <Button onClick={handleAddGoal} className="w-full bg-primary hover:bg-secondary">
                  Confirmar Gol
                </Button>
              </Card>
            )}

            <div className="space-y-2">
              {goals.map((goal) => (
                <div key={goal.id} className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge className={teamColors[goal.team_color]}>
                      {teamNames[goal.team_color]}
                    </Badge>
                    <span>
                      ⚽ {goal.is_own_goal ? "GC" : (goal.player?.nickname || goal.player?.name)}
                    </span>
                    {goal.assists && goal.assists.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        (assistência: {goal.assists[0].player?.nickname || goal.assists[0].player?.name})
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{goal.minute}'</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Cartões ({cards.length})</h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => setAddingCard(!addingCard)}
                  size="sm"
                  className="bg-primary hover:bg-secondary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Cartão
                </Button>
                <Button
                  onClick={handleDeleteLastCard}
                  size="sm"
                  variant="destructive"
                  disabled={cards.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Último
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {addingCard && (
              <Card className="bg-muted/20 p-4 space-y-3">
                <Select
                  value={cardData.team}
                  onValueChange={(value) => setCardData({ ...cardData, team: value, player_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={match.team_home}>{teamNames[match.team_home]}</SelectItem>
                    <SelectItem value={match.team_away}>{teamNames[match.team_away]}</SelectItem>
                  </SelectContent>
                </Select>

                {cardData.team && (
                  <Select
                    value={cardData.player_id}
                    onValueChange={(value) => setCardData({ ...cardData, player_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o jogador" />
                    </SelectTrigger>
                    <SelectContent>
                      {(players[cardData.team] || []).map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.nickname || player.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select
                  value={cardData.card_type}
                  onValueChange={(value) => setCardData({ ...cardData, card_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de cartão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amarelo">🟨 Amarelo</SelectItem>
                    <SelectItem value="azul">🟦 Azul</SelectItem>
                  </SelectContent>
                </Select>

                {/* Campo de Minuto */}
                <div className="space-y-1">
                  <label htmlFor="card-minute" className="text-sm font-medium">
                    Minuto do Cartão
                  </label>
                  <input
                    id="card-minute"
                    type="number"
                    min="0"
                    max="120"
                    value={cardMinute}
                    onChange={(e) => setCardMinute(Math.max(0, Math.min(120, parseInt(e.target.value) || 0)))}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                    placeholder="0-120"
                  />
                  <p className="text-xs text-muted-foreground">Digite o minuto entre 0 e 120</p>
                </div>

                <Button onClick={handleAddCard} className="w-full bg-primary hover:bg-secondary">
                  Confirmar Cartão
                </Button>
              </Card>
            )}

            <div className="space-y-2">
              {cards.map((card) => (
                <div key={card.id} className="flex items-center justify-between p-3 bg-muted/10 rounded-lg">
                  <span>
                    {card.card_type === "amarelo" ? "🟨" : "🟦"} {card.player?.nickname || card.player?.name}
                  </span>
                  <span className="text-sm text-muted-foreground">{card.minute}'</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Presença e Atrasos</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {roundPlayers.map((player) => (
              <div key={player.id} className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Badge className={teamColors[player.team_color]}>
                    {teamNames[player.team_color]}
                  </Badge>
                  <span>{player.nickname || player.name}</span>
                </div>
                <Select
                  value={getAttendanceStatus(player.id)}
                  onValueChange={(status) => updateAttendance(player.id, status)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presente">✅ Presente</SelectItem>
                    <SelectItem value="atrasado">⏰ Atrasado</SelectItem>
                    <SelectItem value="falta">❌ Falta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={handleSaveMatch} className="w-full bg-primary hover:bg-secondary text-lg py-6">
          Salvar Partida
        </Button>
      </DialogContent>
    </Dialog>
  );
}
