import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, AlertCircle, Save } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Match {
  id: string;
  match_number: number;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  scheduled_time: string;
  status: string;
  match_timer_started_at: string | null;
  match_timer_paused_at: string | null;
  match_timer_total_paused_seconds: number | null;
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
  const { toast } = useToast();
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Record<string, Player[]>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [roundPlayers, setRoundPlayers] = useState<RoundPlayer[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
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
      toast({
        title: "Erro ao carregar dados",
        description: "Erro ao carregar dados da partida",
        variant: "destructive",
      });
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
        setHasUnsavedChanges(true);
        toast({
          title: "✅ Status alterado",
          description: "Clique em 'Salvar Partida' para confirmar",
        });
      } else {
        toast({
          title: "Erro ao atualizar presença",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar presença:", error);
      toast({
        title: "Erro ao atualizar presença",
        variant: "destructive",
      });
    }
  };

  const getAttendanceStatus = (playerId: string) => {
    return attendanceData[playerId] || 'presente';
  };

  const handleAddGoal = async () => {
    if (!match || !goalData.team || (!goalData.player_id && !goalData.is_own_goal)) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      // Padrão: minuto 12' (final da partida de 12 minutos)
      let currentMinute = 12;
      
      // Só calcula tempo real se a partida está em andamento
      if (match.status === 'in_progress' && match.match_timer_started_at) {
        const startTime = new Date(match.match_timer_started_at).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const totalPausedSeconds = match.match_timer_total_paused_seconds || 0;
        const effectiveSeconds = elapsedSeconds - totalPausedSeconds;
        const calculatedMinute = Math.ceil(effectiveSeconds / 60);
        
        // Usa o valor calculado (permite acréscimos além de 12')
        if (calculatedMinute >= 1) {
          currentMinute = calculatedMinute;
        }
      }
      
      const { data: goalInserted, error: goalError } = await supabase
        .from("goals")
        .insert([{
          match_id: matchId,
          player_id: goalData.is_own_goal ? null : goalData.player_id,
          team_color: goalData.team as "azul" | "branco" | "laranja" | "vermelho",
          minute: currentMinute,
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

      setHasUnsavedChanges(true);
      toast({
        title: "✅ Gol adicionado!",
        description: "Clique em 'Salvar Partida' para confirmar",
      });
      setGoalData({ team: "", player_id: "", has_assist: false, assist_player_id: "", is_own_goal: false });
      await loadMatchData();
    } catch (error: any) {
      console.error("Erro ao adicionar gol:", error);
      toast({
        title: "Erro ao adicionar gol",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLastGoal = async () => {
    if (goals.length === 0) {
      toast({
        title: "Sem gols",
        description: "Não há gols para excluir",
        variant: "destructive",
      });
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

      setHasUnsavedChanges(true);
      toast({
        title: "✅ Gol excluído!",
        description: "Clique em 'Salvar Partida' para confirmar",
      });
      await loadMatchData();
    } catch (error: any) {
      console.error("Erro ao excluir gol:", error);
      toast({
        title: "Erro ao excluir gol",
        variant: "destructive",
      });
    }
  };

  const handleAddCard = async () => {
    if (!cardData.team || !cardData.player_id || !cardData.card_type) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    try {
      // Padrão: minuto 12' (final da partida de 12 minutos)
      let currentMinute = 12;
      
      // Só calcula tempo real se a partida está em andamento
      if (match?.status === 'in_progress' && match.match_timer_started_at) {
        const startTime = new Date(match.match_timer_started_at).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const totalPausedSeconds = match.match_timer_total_paused_seconds || 0;
        const effectiveSeconds = elapsedSeconds - totalPausedSeconds;
        const calculatedMinute = Math.ceil(effectiveSeconds / 60);
        
        // Usa o valor calculado (permite acréscimos além de 12')
        if (calculatedMinute >= 1) {
          currentMinute = calculatedMinute;
        }
      }

      const { error } = await supabase.from("cards").insert([{
        match_id: matchId,
        player_id: cardData.player_id,
        card_type: cardData.card_type as "amarelo" | "azul",
        minute: currentMinute,
      }]);

      if (error) throw error;

      setHasUnsavedChanges(true);
      toast({
        title: "✅ Cartão adicionado!",
        description: "Clique em 'Salvar Partida' para confirmar",
      });
      setCardData({ team: "", player_id: "", card_type: "" });
      await loadCards();
    } catch (error: any) {
      console.error("Erro ao adicionar cartão:", error);
      toast({
        title: "Erro ao adicionar cartão",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLastCard = async () => {
    if (cards.length === 0) {
      toast({
        title: "Sem cartões",
        description: "Não há cartões para excluir",
        variant: "destructive",
      });
      return;
    }

    try {
      const lastCard = cards[cards.length - 1];
      const { error } = await supabase
        .from("cards")
        .delete()
        .eq("id", lastCard.id);

      if (error) throw error;

      setHasUnsavedChanges(true);
      toast({
        title: "✅ Cartão excluído!",
        description: "Clique em 'Salvar Partida' para confirmar",
      });
      await loadCards();
    } catch (error: any) {
      console.error("Erro ao excluir cartão:", error);
      toast({
        title: "Erro ao excluir cartão",
        variant: "destructive",
      });
    }
  };

  const handleSaveMatch = async () => {
    try {
      // Recalcular stats da rodada
      const { error: recalcError } = await supabase.rpc('recalc_round_aggregates', {
        p_round_id: roundId
      });

      if (recalcError) {
        console.error("Erro ao recalcular stats da rodada:", recalcError);
      }

      // Recalcular rankings globais
      const { error: rankError } = await supabase.rpc('recalc_all_player_rankings');

      if (rankError) {
        console.error("Erro ao recalcular rankings:", rankError);
      }

      if (recalcError || rankError) {
        toast({
          title: "⚠️ Partida salva com aviso",
          description: "Dados salvos, mas houve erro ao recalcular pontos.",
        });
      } else {
        toast({
          title: "✅ Partida salva com sucesso!",
          description: "Todos os dados foram atualizados e pontos recalculados.",
        });
      }

      setHasUnsavedChanges(false);
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar partida:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCloseDialog = () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleDiscardChanges = () => {
    setHasUnsavedChanges(false);
    setShowCloseConfirm(false);
    onOpenChange(false);
  };

  const handleSaveAndClose = async () => {
    setShowCloseConfirm(false);
    await handleSaveMatch();
  };

  if (!match) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              Editar Partida
            </DialogTitle>
          </DialogHeader>

          {hasUnsavedChanges && (
            <Alert className="bg-yellow-500/10 border-yellow-500/50 sticky top-0 z-10">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <AlertDescription className="text-yellow-600 font-medium">
                ⚠️ Você tem alterações não salvas. Clique em "Salvar Partida" para confirmar.
              </AlertDescription>
            </Alert>
          )}

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

                <Button onClick={handleAddGoal} className="w-full bg-primary hover:bg-secondary">
                  Confirmar Gol
                </Button>
              </Card>
            )}

            <div className="space-y-2">
              {goals.map((goal) => (
                <div key={goal.id} className="flex items-center justify-between p-3 bg-muted/10 rounded-lg hover:bg-muted/20 transition-colors">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <Badge className={teamColors[goal.team_color]}>
                        {teamNames[goal.team_color]}
                      </Badge>
                      <span className="font-medium">
                        ⚽ {goal.minute}' {goal.is_own_goal ? "GC" : (goal.player?.nickname || goal.player?.name)}
                      </span>
                    </div>
                    {goal.assists && goal.assists.length > 0 && goal.assists[0].player && (
                      <div className="flex items-center gap-2 ml-2 text-sm">
                        <span className="text-accent font-semibold">🎯</span>
                        <span className="text-muted-foreground">
                          Assistência: <span className="font-medium text-foreground">{goal.assists[0].player.nickname || goal.assists[0].player.name}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteLastGoal()}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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

          <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t border-border mt-4 space-y-3">
            <Button 
              onClick={handleSaveMatch} 
              className={`w-full text-lg py-6 transition-all ${
                hasUnsavedChanges 
                  ? 'bg-primary hover:bg-primary/90 animate-pulse shadow-lg shadow-primary/50' 
                  : 'bg-primary hover:bg-secondary'
              }`}
            >
              <Save className="h-5 w-5 mr-2" />
              {hasUnsavedChanges ? 'Salvar Alterações' : 'Salvar Partida'}
            </Button>
            {hasUnsavedChanges && (
              <p className="text-xs text-center text-muted-foreground">
                {goals.length + cards.length} evento(s) pendente(s)
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Alterações não salvas
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Você tem alterações pendentes que não foram salvas. O que deseja fazer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowCloseConfirm(false)} className="w-full sm:w-auto">
              Continuar Editando
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDiscardChanges}
              className="w-full sm:w-auto bg-destructive hover:bg-destructive/90"
            >
              Descartar Alterações
            </AlertDialogAction>
            <AlertDialogAction 
              onClick={handleSaveAndClose}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar e Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
