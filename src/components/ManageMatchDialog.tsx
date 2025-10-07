import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
  assists?: Array<{ player_id: string; player?: Player }>;
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

interface ManageMatchDialogProps {
  match: Match;
  roundId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export default function ManageMatchDialog({
  match,
  roundId,
  open,
  onOpenChange,
  onUpdate,
}: ManageMatchDialogProps) {
  const [players, setPlayers] = useState<Record<string, Player[]>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);
  const [goalData, setGoalData] = useState({
    team: "",
    player_id: "",
    minute: "",
    has_assist: false,
    assist_player_id: "",
  });

  useEffect(() => {
    if (open) {
      loadMatchData();
      loadPlayers();
    }
  }, [open, match.id]);

  const loadPlayers = async () => {
    try {
      const { data: homePlayers } = await supabase
        .from("round_team_players")
        .select("player_id, profiles(id, name, nickname)")
        .eq("round_id", roundId)
        .eq("team_color", match.team_home as "branco" | "vermelho" | "azul" | "laranja");

      const { data: awayPlayers } = await supabase
        .from("round_team_players")
        .select("player_id, profiles(id, name, nickname)")
        .eq("round_id", roundId)
        .eq("team_color", match.team_away as "branco" | "vermelho" | "azul" | "laranja");

      const homePlayersList = (homePlayers || []).map((p: any) => p.profiles);
      const awayPlayersList = (awayPlayers || []).map((p: any) => p.profiles);

      setPlayers({
        [match.team_home]: homePlayersList,
        [match.team_away]: awayPlayersList,
      });
    } catch (error) {
      console.error("Erro ao carregar jogadores:", error);
    }
  };

  const loadMatchData = async () => {
    try {
      const { data: goalsData } = await supabase
        .from("goals")
        .select("*, assists(player_id)")
        .eq("match_id", match.id);

      const goalsWithPlayers = await Promise.all(
        (goalsData || []).map(async (goal: any) => {
          const { data: player } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", goal.player_id)
            .maybeSingle();

          let assists = [];
          if (goal.assists && goal.assists.length > 0) {
            const { data: assistPlayer } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", goal.assists[0].player_id)
              .maybeSingle();
            
            assists = [{ player_id: goal.assists[0].player_id, player: assistPlayer }];
          }

          return { ...goal, player, assists };
        })
      );

      setGoals(goalsWithPlayers);

      const { data: cardsData } = await supabase
        .from("cards")
        .select("*")
        .eq("match_id", match.id);

      const cardsWithPlayers = await Promise.all(
        (cardsData || []).map(async (card: any) => {
          const { data: player } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", card.player_id)
            .maybeSingle();

          return { ...card, player };
        })
      );

      setCards(cardsWithPlayers);
    } catch (error) {
      console.error("Erro ao carregar dados da partida:", error);
    }
  };

  const startMatch = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("matches")
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq("id", match.id);

      if (error) throw error;
      
      toast.success("Partida iniciada!");
      onUpdate();
    } catch (error: any) {
      toast.error("Erro ao iniciar partida: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addGoal = async () => {
    if (!goalData.team || !goalData.player_id || !goalData.minute) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { data: goalRecord, error: goalError } = await supabase
        .from("goals")
        .insert([{
          match_id: match.id,
          player_id: goalData.player_id,
          team_color: goalData.team as "branco" | "vermelho" | "azul" | "laranja",
          minute: parseInt(goalData.minute),
          is_own_goal: goalData.player_id === "own_goal",
        }])
        .select()
        .single();

      if (goalError) throw goalError;

      if (goalData.has_assist && goalData.assist_player_id) {
        const { error: assistError } = await supabase
          .from("assists")
          .insert({
            goal_id: goalRecord.id,
            player_id: goalData.assist_player_id,
          });

        if (assistError) throw assistError;
      }

      // Atualizar placar
      const newScoreHome = goalData.team === match.team_home ? match.score_home + 1 : match.score_home;
      const newScoreAway = goalData.team === match.team_away ? match.score_away + 1 : match.score_away;

      const { error: updateError } = await supabase
        .from("matches")
        .update({ score_home: newScoreHome, score_away: newScoreAway })
        .eq("id", match.id);

      if (updateError) throw updateError;

      toast.success("Gol registrado!");
      setAddingGoal(false);
      setGoalData({ team: "", player_id: "", minute: "", has_assist: false, assist_player_id: "" });
      loadMatchData();
      onUpdate();
    } catch (error: any) {
      toast.error("Erro ao registrar gol: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const finishMatch = async () => {
    if (!confirm("Tem certeza que deseja encerrar esta partida?")) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("matches")
        .update({ status: 'finished', finished_at: new Date().toISOString() })
        .eq("id", match.id);

      if (error) throw error;
      
      toast.success("Partida encerrada!");
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao encerrar partida: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Badge className={teamColors[match.team_home]}>
                {teamNames[match.team_home]}
              </Badge>
              <span className="text-3xl font-bold">{match.score_home}</span>
              <span className="text-xl">×</span>
              <span className="text-3xl font-bold">{match.score_away}</span>
              <Badge className={teamColors[match.team_away]}>
                {teamNames[match.team_away]}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Rodada - {match.scheduled_time}
            </div>
            <Badge variant="outline" className="mt-2">
              {match.status === 'not_started' ? 'Não Iniciado' :
               match.status === 'in_progress' ? 'Em Andamento' : 'Encerrado'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {match.status === 'not_started' && (
            <Button onClick={startMatch} className="w-full" disabled={loading}>
              Iniciar Partida
            </Button>
          )}

          {match.status === 'in_progress' && (
            <>
              <div className="space-y-3">
                <Button
                  onClick={() => setAddingGoal(!addingGoal)}
                  className="w-full"
                  variant={addingGoal ? "secondary" : "default"}
                >
                  {addingGoal ? "Cancelar" : "Registrar Gol"}
                </Button>

                {addingGoal && (
                  <div className="border border-border rounded-lg p-4 space-y-3">
                    <Select value={goalData.team} onValueChange={(v) => setGoalData({ ...goalData, team: v, player_id: "" })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={match.team_home}>{teamNames[match.team_home]}</SelectItem>
                        <SelectItem value={match.team_away}>{teamNames[match.team_away]}</SelectItem>
                      </SelectContent>
                    </Select>

                    {goalData.team && (
                      <Select value={goalData.player_id} onValueChange={(v) => setGoalData({ ...goalData, player_id: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o jogador" />
                        </SelectTrigger>
                        <SelectContent>
                          {players[goalData.team]?.map((player) => (
                            <SelectItem key={player.id} value={player.id}>
                              {player.nickname || player.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="own_goal">Gol Contra</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    <Input
                      type="number"
                      placeholder="Minuto do gol"
                      value={goalData.minute}
                      onChange={(e) => setGoalData({ ...goalData, minute: e.target.value })}
                    />

                    {goalData.player_id && goalData.player_id !== "own_goal" && (
                      <>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={goalData.has_assist}
                            onChange={(e) => setGoalData({ ...goalData, has_assist: e.target.checked })}
                            className="h-4 w-4"
                          />
                          <label className="text-sm">Houve assistência?</label>
                        </div>

                        {goalData.has_assist && (
                          <Select value={goalData.assist_player_id} onValueChange={(v) => setGoalData({ ...goalData, assist_player_id: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Quem deu a assistência?" />
                            </SelectTrigger>
                            <SelectContent>
                              {players[goalData.team]
                                ?.filter(p => p.id !== goalData.player_id)
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

                    <Button onClick={addGoal} className="w-full" disabled={loading}>
                      Confirmar Gol
                    </Button>
                  </div>
                )}
              </div>

              {goals.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h3 className="font-bold mb-2">Gols da Partida:</h3>
                  <div className="space-y-2">
                    {goals.map((goal) => (
                      <div key={goal.id} className="text-sm">
                        ⚽ {goal.player?.nickname || goal.player?.name || "Desconhecido"}
                        {goal.assists && goal.assists.length > 0 && (
                          <span className="text-muted-foreground">
                            {" "}({goal.assists[0].player?.nickname || goal.assists[0].player?.name})
                          </span>
                        )}
                        <span className="text-muted-foreground ml-2">{goal.minute}'</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={finishMatch} variant="secondary" className="w-full" disabled={loading}>
                Encerrar Partida
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
