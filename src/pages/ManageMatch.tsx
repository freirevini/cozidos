import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Play, Pause, Target, User } from "lucide-react";
import { EVENT_ICONS, formatMinute } from "@/components/ui/event-item";

interface Match {
  id: string;
  match_number: number;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  scheduled_time: string;
  status: string;
  round_id: string;
  match_timer_started_at: string | null;
  match_timer_paused_at: string | null;
  match_timer_total_paused_seconds: number;
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

export default function ManageMatch() {
  const { matchId, roundId } = useParams();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Record<string, Player[]>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [timer, setTimer] = useState(720); // 12 minutos em segundos
  const [timerRunning, setTimerRunning] = useState(false);
  const [goalData, setGoalData] = useState({
    team: "",
    player_id: "",
    has_assist: false,
    assist_player_id: "",
  });
  const [cardData, setCardData] = useState({
    team: "",
    player_id: "",
    card_type: "",
  });

  useEffect(() => {
    checkAdmin();
    loadMatchData();
  }, [matchId]);

  useEffect(() => {
    if (match) {
      loadPlayers();
    }
  }, [match, roundId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timer]);

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

  const loadMatchData = async () => {
    if (!matchId) return;

    try {
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (matchError) throw matchError;
      setMatch(matchData);

      // Calcular tempo do cronômetro se a partida estiver em andamento
      if (matchData.status === 'in_progress' && matchData.match_timer_started_at) {
        const startTime = new Date(matchData.match_timer_started_at).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000) - (matchData.match_timer_total_paused_seconds || 0);
        const remainingTime = Math.max(0, 720 - elapsedSeconds);
        setTimer(remainingTime);
        setTimerRunning(!matchData.match_timer_paused_at);
      }

      // Carregar gols e cartões
      const { data: goalsData } = await supabase
        .from("goals")
        .select("*, assists(player_id)")
        .eq("match_id", matchId);

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
        .eq("match_id", matchId);

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
      console.error("Erro ao carregar partida:", error);
      toast.error("Erro ao carregar dados da partida");
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async () => {
    if (!roundId) return;

    try {
      if (!match) return;
      
      const { data: homePlayers } = await supabase
        .from("round_team_players")
        .select("player_id, profiles!inner(id, name, nickname)")
        .eq("round_id", roundId)
        .eq("team_color", match.team_home as "branco" | "vermelho" | "azul" | "laranja");

      const { data: awayPlayers } = await supabase
        .from("round_team_players")
        .select("player_id, profiles!inner(id, name, nickname)")
        .eq("round_id", roundId)
        .eq("team_color", match.team_away as "branco" | "vermelho" | "azul" | "laranja");

      const homePlayersList = (homePlayers || []).map((p: any) => p.profiles).filter(Boolean);
      const awayPlayersList = (awayPlayers || []).map((p: any) => p.profiles).filter(Boolean);

      setPlayers({
        [match.team_home]: homePlayersList,
        [match.team_away]: awayPlayersList,
      });
    } catch (error) {
      console.error("Erro ao carregar jogadores:", error);
    }
  };

  const startMatch = async () => {
    if (!match) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("matches")
        .update({ 
          status: 'in_progress', 
          started_at: new Date().toISOString(),
          match_timer_started_at: new Date().toISOString(),
          match_timer_paused_at: null,
          match_timer_total_paused_seconds: 0
        })
        .eq("id", match.id);

      if (error) throw error;
      
      setTimer(720);
      setTimerRunning(true);
      toast.success("Partida iniciada! Cronômetro começou.");
      loadMatchData();
    } catch (error: any) {
      toast.error("Erro ao iniciar partida: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTimer = async () => {
    if (!match) return;

    try {
      if (timerRunning) {
        // Pausar
        const { error } = await supabase
          .from("matches")
          .update({ match_timer_paused_at: new Date().toISOString() })
          .eq("id", match.id);

        if (error) throw error;
        setTimerRunning(false);
        toast.info("Cronômetro pausado");
      } else {
        // Retomar
        if (match.match_timer_paused_at && match.match_timer_started_at) {
          const pausedAt = new Date(match.match_timer_paused_at).getTime();
          const now = Date.now();
          const pausedDuration = Math.floor((now - pausedAt) / 1000);
          const newTotalPaused = (match.match_timer_total_paused_seconds || 0) + pausedDuration;

          const { error } = await supabase
            .from("matches")
            .update({ 
              match_timer_paused_at: null,
              match_timer_total_paused_seconds: newTotalPaused
            })
            .eq("id", match.id);

          if (error) throw error;
        }
        
        setTimerRunning(true);
        toast.info("Cronômetro retomado");
      }
      loadMatchData();
    } catch (error: any) {
      toast.error("Erro ao pausar/retomar cronômetro: " + error.message);
    }
  };

  const addGoal = async () => {
    if (!goalData.team || !goalData.player_id || !match) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Calcular minuto atual baseado no cronômetro
    const currentMinute = Math.ceil((720 - timer) / 60);

    // Validar minuto (0-120)
    if (currentMinute < 0 || currentMinute > 120) {
      toast.error("Minuto inválido. Deve estar entre 0 e 120.");
      return;
    }

    setLoading(true);
    try {
      // Se for gol contra, usar player_id null
      const isOwnGoal = goalData.player_id === "own_goal";
      
      const { data: goalRecord, error: goalError } = await supabase
        .from("goals")
        .insert([{
          match_id: match.id,
          player_id: isOwnGoal ? null : goalData.player_id,
          team_color: goalData.team as "branco" | "vermelho" | "azul" | "laranja",
          minute: currentMinute,
          is_own_goal: isOwnGoal,
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

      toast.success(`Gol registrado no minuto ${currentMinute}!`);
      setAddingGoal(false);
      setGoalData({ team: "", player_id: "", has_assist: false, assist_player_id: "" });
      loadMatchData();
    } catch (error: any) {
      toast.error("Erro ao registrar gol: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addCard = async () => {
    if (!cardData.team || !cardData.player_id || !cardData.card_type || !match) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Calcular minuto atual baseado no cronômetro
    const currentMinute = Math.ceil((720 - timer) / 60);

    // Validar minuto (0-120)
    if (currentMinute < 0 || currentMinute > 120) {
      toast.error("Minuto inválido. Deve estar entre 0 e 120.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("cards")
        .insert([{
          match_id: match.id,
          player_id: cardData.player_id,
          card_type: cardData.card_type as "amarelo" | "azul",
          minute: currentMinute,
        }]);

      if (error) throw error;

      toast.success(`Cartão ${cardData.card_type} registrado no minuto ${currentMinute}!`);
      setAddingCard(false);
      setCardData({ team: "", player_id: "", card_type: "" });
      loadMatchData();
    } catch (error: any) {
      toast.error("Erro ao registrar cartão: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteLastGoal = async () => {
    if (goals.length === 0) {
      toast.error("Não há gols para deletar");
      return;
    }

    const confirmed = window.confirm("Tem certeza que deseja deletar o último gol registrado?");
    if (!confirmed) return;

    setLoading(true);
    try {
      const lastGoal = [...goals].sort((a, b) => b.minute - a.minute)[0];

      // Deletar gol (assistências são deletadas automaticamente via CASCADE)
      const { error: deleteError } = await supabase
        .from("goals")
        .delete()
        .eq("id", lastGoal.id);

      if (deleteError) throw deleteError;

      // Atualizar placar
      const teamToUpdate = lastGoal.team_color === match?.team_home ? 'score_home' : 'score_away';
      const currentScore = lastGoal.team_color === match?.team_home ? match?.score_home : match?.score_away;
      
      const { error: updateError } = await supabase
        .from("matches")
        .update({
          [teamToUpdate]: Math.max(0, (currentScore || 0) - 1)
        })
        .eq("id", match?.id);

      if (updateError) throw updateError;

      // Recalcular stats da rodada
      const { error: recalcError } = await supabase.rpc('recalc_round_aggregates', {
        p_round_id: match.round_id
      });

      if (recalcError) {
        console.error("Erro ao recalcular stats da rodada:", recalcError);
      }

      // Recalcular rankings globais
      const { error: rankError } = await supabase.rpc('recalc_all_player_rankings');
      
      if (rankError) {
        console.error("Erro ao recalcular rankings:", rankError);
      }

      toast.success("Último gol deletado e pontos recalculados!");
      await loadMatchData();
    } catch (error) {
      console.error("Erro ao deletar gol:", error);
      toast.error("Erro ao deletar gol");
    } finally {
      setLoading(false);
    }
  };

  const finishMatch = async () => {
    if (!match) return;

    if (!confirm("Tem certeza que deseja encerrar esta partida?")) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('close_match', {
        p_match_id: match.id
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        error?: string;
        message?: string;
        already_closed?: boolean;
      };

      if (!result.success) {
        throw new Error(result.error || 'Erro ao encerrar partida');
      }
      
      setTimerRunning(false);
      toast.success(result.message || "Partida encerrada!");
      navigate(`/admin/round/manage?round=${roundId}`);
    } catch (error: any) {
      toast.error("Erro ao encerrar partida: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading || !match) {
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
      
      {/* Cronômetro fixo no topo - apenas quando em andamento */}
      {match.status === 'in_progress' && (
        <div className="sticky top-0 z-50 bg-primary/90 backdrop-blur-sm py-4 shadow-lg">
          <div className="container mx-auto px-4 flex items-center justify-center gap-4">
            <div className="text-4xl font-bold text-white font-mono">
              {formatTime(timer)}
            </div>
            <Button
              variant="secondary"
              size="icon"
              onClick={toggleTimer}
              className="rounded-full bg-black hover:bg-black/90 border-2 border-white"
            >
              {timerRunning ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white" />}
            </Button>
          </div>
        </div>
      )}

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-4xl">
        {/* Placar Padronizado */}
        <div className="bg-gradient-to-r from-primary/90 to-secondary/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg mb-6">
          <div className="text-center mb-4">
            <Badge className="bg-accent text-accent-foreground font-bold text-sm px-4 py-1">
              {match.status === 'not_started' && 'AGUARDANDO INÍCIO'}
              {match.status === 'in_progress' && 'EM ANDAMENTO'}
              {match.status === 'finished' && 'ENCERRADO'}
            </Badge>
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center flex-1">
              <Badge className={`${teamColors[match.team_home]} mb-2`}>
                {teamNames[match.team_home]}
              </Badge>
              <div className="text-6xl font-bold text-white">
                {match.score_home}
              </div>
            </div>
            <div className="text-5xl font-bold text-white">-</div>
            <div className="text-center flex-1">
              <Badge className={`${teamColors[match.team_away]} mb-2`}>
                {teamNames[match.team_away]}
              </Badge>
              <div className="text-6xl font-bold text-white">
                {match.score_away}
              </div>
            </div>
          </div>
        </div>

        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/admin/round/manage?round=${roundId}`)}
              >
                <ArrowLeft size={20} />
              </Button>
              <div className="text-xs text-muted-foreground">
                Horário: {match.scheduled_time.substring(0, 5)}
              </div>
            </div>
            
        {/* Gols - Dividido por Time */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Coluna Time Casa */}
          <div>
            <h3 className="font-bold text-center mb-3 text-sm">{teamNames[match.team_home]}</h3>
            {goals.filter(g => g.team_color === match.team_home).length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">-</p>
            ) : (
              goals
                .filter(g => g.team_color === match.team_home)
                .sort((a, b) => a.minute - b.minute)
                .map((goal, idx) => {
                  const scorer = goal.player;
                  const assist = goal.assists && goal.assists.length > 0 ? goal.assists[0] : null;
                  
                  return (
                    <div key={idx} className="mb-3 p-2 bg-muted/10 rounded">
                      <div className="text-sm font-medium flex items-center gap-1">
                        <span>{EVENT_ICONS.goal}</span>
                        <span>{formatMinute(goal.minute)}</span>
                        <span className="ml-1">{goal.is_own_goal ? 'Gol Contra' : (scorer?.nickname || scorer?.name || 'Desconhecido')}</span>
                      </div>
                      {assist?.player && (
                        <div className="text-xs sm:text-sm text-foreground mt-1 ml-6">
                          Assist: <span className="font-semibold">
                            {assist.player.nickname || assist.player.name}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>

          {/* Coluna Time Visitante */}
          <div>
            <h3 className="font-bold text-center mb-3 text-sm">{teamNames[match.team_away]}</h3>
            {goals.filter(g => g.team_color === match.team_away).length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">-</p>
            ) : (
              goals
                .filter(g => g.team_color === match.team_away)
                .sort((a, b) => a.minute - b.minute)
                .map((goal, idx) => {
                  const scorer = goal.player;
                  const assist = goal.assists && goal.assists.length > 0 ? goal.assists[0] : null;
                  
                  return (
                    <div key={idx} className="mb-3 p-2 bg-muted/10 rounded">
                      <div className="text-sm font-medium flex items-center gap-1">
                        <span>{EVENT_ICONS.goal}</span>
                        <span>{formatMinute(goal.minute)}</span>
                        <span className="ml-1">{goal.is_own_goal ? 'Gol Contra' : (scorer?.nickname || scorer?.name || 'Desconhecido')}</span>
                      </div>
                      {assist?.player && (
                        <div className="text-xs sm:text-sm text-foreground mt-1 ml-6">
                          Assist: <span className="font-semibold">
                            {assist.player.nickname || assist.player.name}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {match.status === 'not_started' && (
              <Button onClick={startMatch} className="w-full" disabled={loading}>
                Iniciar Partida
              </Button>
            )}

            {match.status === 'in_progress' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button
                    onClick={() => setAddingGoal(!addingGoal)}
                    variant={addingGoal ? "secondary" : "default"}
                    className={`min-h-[44px] ${addingGoal ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                  >
                    {addingGoal ? "Cancelar Gol" : "Registrar Gol"}
                  </Button>

                  <Button
                    onClick={() => setAddingCard(!addingCard)}
                    variant={addingCard ? "secondary" : "default"}
                    className={`min-h-[44px] ${addingCard ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                  >
                    {addingCard ? "Cancelar Cartão" : "Registrar Cartão"}
                  </Button>

                  <Button
                    onClick={deleteLastGoal}
                    variant="destructive"
                    disabled={goals.length === 0}
                    className="min-h-[44px] text-xs sm:text-sm"
                  >
                    Desfazer Último Gol
                  </Button>
                </div>

                {addingGoal && (
                  <Card className="bg-muted/20 border-border">
                    <CardContent className="pt-6 space-y-4">
                      <Select value={goalData.team} onValueChange={(v) => setGoalData({ ...goalData, team: v, player_id: "", has_assist: false, assist_player_id: "" })}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Selecione o time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={match.team_home}>{teamNames[match.team_home]}</SelectItem>
                          <SelectItem value={match.team_away}>{teamNames[match.team_away]}</SelectItem>
                        </SelectContent>
                      </Select>

                      {goalData.team && (
                        <>
                          <div>
                            <p className="text-sm font-medium mb-2">Quem marcou o gol?</p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {players[goalData.team]?.map((player) => (
                                <Button
                                  key={player.id}
                                  variant={goalData.player_id === player.id ? "default" : "outline"}
                                  className="h-auto py-3 px-2 text-xs min-h-[44px]"
                                  onClick={() => setGoalData({ ...goalData, player_id: player.id })}
                                >
                                  {player.nickname || player.name}
                                </Button>
                              ))}
                              <Button
                                variant={goalData.player_id === "own_goal" ? "default" : "outline"}
                                className="h-auto py-3 px-2 text-xs min-h-[44px]"
                                onClick={() => setGoalData({ ...goalData, player_id: "own_goal", has_assist: false, assist_player_id: "" })}
                              >
                                Gol Contra
                              </Button>
                            </div>
                          </div>

                          {goalData.player_id && goalData.player_id !== "own_goal" && (
                            <>
                              <Card className="bg-accent/10 border-accent/30 shadow-sm">
                                <CardContent className="p-4 space-y-3">
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                      <Target className="h-5 w-5 text-accent" />
                                      <label htmlFor="has-assist" className="text-base font-semibold text-foreground">
                                        Houve assistência?
                                      </label>
                                    </div>
                                    <Switch
                                      id="has-assist"
                                      checked={goalData.has_assist}
                                      onCheckedChange={(checked) => 
                                        setGoalData({ ...goalData, has_assist: checked, assist_player_id: "" })
                                      }
                                      className="data-[state=checked]:bg-primary"
                                    />
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Marque se outro jogador deu passe para o gol
                                  </p>
                                </CardContent>
                              </Card>

                              {goalData.has_assist && (
                                <div className="space-y-3">
                                  <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Quem deu a assistência?
                                  </p>
                                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {players[goalData.team]
                                      ?.filter(p => p.id !== goalData.player_id)
                                      .map((player) => (
                                        <Button
                                          key={player.id}
                                          variant={goalData.assist_player_id === player.id ? "default" : "outline"}
                                          className="h-auto py-3 px-2 text-xs min-h-[44px]"
                                          onClick={() => setGoalData({ ...goalData, assist_player_id: player.id })}
                                        >
                                          {player.nickname || player.name}
                                        </Button>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}

                      <Button 
                        onClick={addGoal} 
                        className="w-full min-h-[44px]" 
                        disabled={loading || !goalData.team || !goalData.player_id || (goalData.has_assist && !goalData.assist_player_id)}
                      >
                        Confirmar Gol (Minuto: {Math.ceil((720 - timer) / 60)})
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {addingCard && (
                  <Card className="bg-muted/20 border-border">
                    <CardContent className="pt-6 space-y-3">
                      <Select value={cardData.team} onValueChange={(v) => setCardData({ ...cardData, team: v, player_id: "" })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={match.team_home}>{teamNames[match.team_home]}</SelectItem>
                          <SelectItem value={match.team_away}>{teamNames[match.team_away]}</SelectItem>
                        </SelectContent>
                      </Select>

                      {cardData.team && (
                        <Select value={cardData.player_id} onValueChange={(v) => setCardData({ ...cardData, player_id: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o jogador" />
                          </SelectTrigger>
                          <SelectContent>
                            {players[cardData.team]?.map((player) => (
                              <SelectItem key={player.id} value={player.id}>
                                {player.nickname || player.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {cardData.player_id && (
                        <Select value={cardData.card_type} onValueChange={(v) => setCardData({ ...cardData, card_type: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo de cartão" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="amarelo">{EVENT_ICONS.amarelo} Amarelo</SelectItem>
                            <SelectItem value="azul">{EVENT_ICONS.azul} Azul</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      <Button onClick={addCard} className="w-full" disabled={loading}>
                        Confirmar Cartão (Minuto: {Math.ceil((720 - timer) / 60)})
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {cards.length > 0 && (
                  <Card className="bg-muted/20 border-border">
                    <CardContent className="pt-6">
                      <h3 className="font-bold mb-3">Cartões da Partida:</h3>
                      <div className="space-y-2">
                        {cards.map((card) => (
                          <div key={card.id} className="text-sm flex items-center gap-2">
                            {EVENT_ICONS[card.card_type as 'amarelo' | 'azul']} {card.player?.nickname || card.player?.name || "Desconhecido"}
                            <span className="text-muted-foreground ml-auto">{formatMinute(card.minute)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button onClick={finishMatch} variant="secondary" className="w-full">
                  Encerrar Partida
                </Button>
              </>
            )}

            {match.status === 'finished' && (
              <div className="space-y-4">
                {cards.length > 0 && (
                  <Card className="bg-muted/20 border-border">
                    <CardContent className="pt-6">
                      <h3 className="font-bold mb-3">Cartões da Partida:</h3>
                      <div className="space-y-2">
                        {cards.map((card) => (
                          <div key={card.id} className="text-sm flex items-center gap-2">
                            {EVENT_ICONS[card.card_type as 'amarelo' | 'azul']} {card.player?.nickname || card.player?.name || "Desconhecido"}
                            <span className="text-muted-foreground ml-auto">{formatMinute(card.minute)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button onClick={() => navigate(`/admin/round/manage?round=${roundId}`)} className="w-full">
                  Voltar para Gerenciar Rodada
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}