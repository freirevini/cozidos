import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Play, Pause, Target, User, Goal, Square, Undo2, Flag, ArrowLeftRight } from "lucide-react";
import { MatchHeader } from "@/components/match/MatchHeader";
import { MatchTimeline, TimelineEvent } from "@/components/match/MatchTimeline";
import { EVENT_ICONS } from "@/components/ui/event-item";

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
  round_number?: number;
  match_timer_started_at: string | null;
  match_timer_paused_at: string | null;
  match_timer_total_paused_seconds: number;
  started_at: string | null;
  finished_at: string | null;
}

interface Player {
  id: string;
  name: string;
  nickname: string | null;
  avatar_url?: string | null;
}

interface GoalData {
  id: string;
  player_id: string;
  minute: number;
  is_own_goal: boolean;
  team_color: string;
  player?: Player;
  assists?: Array<{ player_id: string; player?: Player }>;
}

interface CardEvent {
  id: string;
  player_id: string;
  card_type: string;
  minute: number;
  player?: Player;
  team_color?: string;
}

interface Substitution {
  id: string;
  match_id: string;
  team_color: string;
  player_out_id: string;
  player_in_id: string;
  minute: number;
  player_out?: Player;
  player_in?: Player;
}

const teamNames: Record<string, string> = {
  branco: "Branco",
  vermelho: "Vermelho",
  azul: "Azul",
  laranja: "Laranja",
};

function getCurrentMatchMinute(match: Match | null): number {
  if (!match || !match.match_timer_started_at) return 0;
  const startTime = new Date(match.match_timer_started_at).getTime();
  const now = Date.now();
  let pausedSeconds = match.match_timer_total_paused_seconds || 0;
  if (match.match_timer_paused_at) {
    const pausedAt = new Date(match.match_timer_paused_at).getTime();
    pausedSeconds += Math.floor((now - pausedAt) / 1000);
  }
  const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000) - pausedSeconds);
  return Math.floor(elapsedSeconds / 60);
}

export default function ManageMatch() {
  const { matchId, roundId } = useParams();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Record<string, Player[]>>({});
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [cards, setCards] = useState<CardEvent[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [timer, setTimer] = useState(720);
  const [timerRunning, setTimerRunning] = useState(false);
  const [currentMinute, setCurrentMinute] = useState<number | null>(null);
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
  const [subData, setSubData] = useState({
    team: "",
    player_out_id: "",
    player_in_id: "",
  });
  const [availablePlayersIn, setAvailablePlayersIn] = useState<Player[]>([]);

  useEffect(() => {
    checkAdminAndLoad();
  }, [matchId, roundId]);

  useEffect(() => {
    if (match) {
      loadPlayers();
    }
  }, [match?.id, match?.team_home, match?.team_away]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timer]);

  useEffect(() => {
    if (match?.match_timer_started_at && match.status === 'in_progress') {
      const startTime = new Date(match.match_timer_started_at).getTime();
      const now = Date.now();
      let pausedSeconds = match.match_timer_total_paused_seconds || 0;
      
      if (match.match_timer_paused_at) {
        const pausedAt = new Date(match.match_timer_paused_at).getTime();
        pausedSeconds += Math.floor((now - pausedAt) / 1000);
        setTimerRunning(false);
      } else {
        setTimerRunning(true);
      }
      
      const elapsedSeconds = Math.floor((now - startTime) / 1000) - pausedSeconds;
      const remainingSeconds = Math.max(0, 720 - elapsedSeconds);
      setTimer(remainingSeconds);
    }
  }, [match?.match_timer_started_at, match?.match_timer_paused_at, match?.match_timer_total_paused_seconds, match?.status]);

  // Update current minute for display
  useEffect(() => {
    if (match?.status === "in_progress") {
      const interval = setInterval(() => setCurrentMinute(getCurrentMatchMinute(match)), 1000);
      return () => clearInterval(interval);
    } else {
      setCurrentMinute(match ? getCurrentMatchMinute(match) : null);
    }
  }, [match]);

  // Build timeline events from goals, cards, and substitutions
  useEffect(() => {
    if (!match) return;
    
    const events: TimelineEvent[] = [];
    
    // Add match start event
    if (match.started_at) {
      events.push({ id: `start-${match.id}`, type: "match_start", minute: 0 });
    }
    
    // Add goals
    goals.forEach((goal) => {
      const assistData = goal.assists && goal.assists.length > 0 ? goal.assists[0] : null;
      events.push({
        id: goal.id,
        type: "goal",
        minute: goal.minute,
        team_color: goal.team_color,
        player: goal.player ? { 
          name: goal.player.name, 
          nickname: goal.player.nickname,
          avatar_url: goal.player.avatar_url 
        } : undefined,
        assist: assistData?.player ? { 
          name: assistData.player.name, 
          nickname: assistData.player.nickname,
          avatar_url: assistData.player.avatar_url 
        } : undefined,
      });
    });
    
    // Add cards
    cards.forEach((card) => {
      events.push({
        id: card.id,
        type: card.card_type === "amarelo" ? "amarelo" : "azul",
        minute: card.minute,
        team_color: card.team_color,
        player: card.player ? { 
          name: card.player.name, 
          nickname: card.player.nickname,
          avatar_url: card.player.avatar_url 
        } : undefined,
      });
    });

    // Add substitutions
    substitutions.forEach((sub) => {
      events.push({
        id: sub.id,
        type: "substitution",
        minute: sub.minute,
        team_color: sub.team_color,
        playerOut: sub.player_out ? {
          name: sub.player_out.name,
          nickname: sub.player_out.nickname,
          avatar_url: sub.player_out.avatar_url
        } : undefined,
        playerIn: sub.player_in ? {
          name: sub.player_in.name,
          nickname: sub.player_in.nickname,
          avatar_url: sub.player_in.avatar_url
        } : undefined,
      });
    });
    
    // Add match end event
    if (match.status === "finished" && match.finished_at) {
      const endMinute = getCurrentMatchMinute(match);
      events.push({ id: `end-${match.id}`, type: "match_end", minute: Math.max(endMinute, 12) });
    }
    
    events.sort((a, b) => a.minute - b.minute);
    setTimelineEvents(events);
  }, [match, goals, cards, substitutions]);

  // Real-time subscriptions
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel("admin-match-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, () => loadMatchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, () => loadMatchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, () => loadMatchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "assists" }, () => loadMatchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "substitutions", filter: `match_id=eq.${matchId}` }, () => loadMatchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  const checkAdminAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado");
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleData?.role !== "admin") {
      toast.error("Acesso negado. Apenas administradores podem gerenciar partidas.");
      navigate("/");
      return;
    }

    setIsAdmin(true);
    loadMatchData();
  };

  const loadMatchData = async () => {
    if (!matchId) return;

    try {
      setLoading(true);

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*, round:rounds(round_number)")
        .eq("id", matchId)
        .single();

      if (matchError) throw matchError;
      setMatch({
        ...matchData,
        round_number: matchData.round?.round_number,
      });

      // Load goals with assists
      const { data: goalsData } = await supabase
        .from("goals")
        .select(`
          id,
          player_id,
          minute,
          is_own_goal,
          team_color,
          player:profiles!goals_player_id_fkey(id, name, nickname, avatar_url),
          assists(
            player_id,
            player:profiles!assists_player_id_fkey(id, name, nickname, avatar_url)
          )
        `)
        .eq("match_id", matchId)
        .order("minute", { ascending: true });

      const goalsWithPlayers = (goalsData || []).map((goal: any) => ({
        id: goal.id,
        player_id: goal.player_id,
        minute: goal.minute,
        is_own_goal: goal.is_own_goal,
        team_color: goal.team_color,
        player: goal.player,
        assists: goal.assists,
      }));

      setGoals(goalsWithPlayers);

      // Load cards with team_color
      const { data: cardsData } = await supabase
        .from("cards")
        .select(`
          id,
          player_id,
          card_type,
          minute,
          player:profiles!cards_player_id_fkey(id, name, nickname, avatar_url)
        `)
        .eq("match_id", matchId)
        .order("minute", { ascending: true });

      // Get team_color for each card
      const cardsWithTeam: CardEvent[] = [];
      for (const card of cardsData || []) {
        const { data: teamData } = await supabase
          .from("round_team_players")
          .select("team_color")
          .eq("player_id", card.player_id)
          .eq("round_id", matchData.round_id)
          .maybeSingle();

        cardsWithTeam.push({
          id: card.id,
          player_id: card.player_id,
          card_type: card.card_type,
          minute: card.minute,
          player: card.player,
          team_color: teamData?.team_color,
        });
      }

      setCards(cardsWithTeam);

      // Load substitutions
      const { data: subsData } = await supabase
        .from("substitutions")
        .select(`
          id,
          match_id,
          team_color,
          player_out_id,
          player_in_id,
          minute,
          player_out:profiles!substitutions_player_out_id_fkey(id, name, nickname, avatar_url),
          player_in:profiles!substitutions_player_in_id_fkey(id, name, nickname, avatar_url)
        `)
        .eq("match_id", matchId)
        .order("minute", { ascending: true });

      const subsWithPlayers = (subsData || []).map((sub: any) => ({
        id: sub.id,
        match_id: sub.match_id,
        team_color: sub.team_color,
        player_out_id: sub.player_out_id,
        player_in_id: sub.player_in_id,
        minute: sub.minute,
        player_out: sub.player_out,
        player_in: sub.player_in,
      }));

      setSubstitutions(subsWithPlayers);
    } catch (error) {
      console.error("Erro ao carregar partida:", error);
      toast.error("Erro ao carregar dados da partida");
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async () => {
    if (!roundId || !match) return;

    try {
      const { data: homePlayers } = await supabase
        .from("round_team_players")
        .select("player_id, profiles!inner(id, name, nickname, avatar_url)")
        .eq("round_id", roundId)
        .eq("team_color", match.team_home as "branco" | "vermelho" | "azul" | "laranja");

      const { data: awayPlayers } = await supabase
        .from("round_team_players")
        .select("player_id, profiles!inner(id, name, nickname, avatar_url)")
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

  // Load available players for substitution (from other teams not playing this match)
  const loadAvailablePlayersIn = async () => {
    if (!roundId || !match) return;

    try {
      // Get all players from other teams in this round (not team_home or team_away)
      const { data: otherTeamPlayers } = await supabase
        .from("round_team_players")
        .select("player_id, profiles!inner(id, name, nickname, avatar_url)")
        .eq("round_id", roundId)
        .not("team_color", "in", `(${match.team_home},${match.team_away})`);

      // Get players who already entered via substitution in this match
      const playersAlreadyIn = substitutions.map(s => s.player_in_id);

      // Filter out players who already entered
      const availablePlayers = (otherTeamPlayers || [])
        .map((p: any) => p.profiles)
        .filter(Boolean)
        .filter((p: Player) => !playersAlreadyIn.includes(p.id));

      setAvailablePlayersIn(availablePlayers);
    } catch (error) {
      console.error("Erro ao carregar jogadores disponíveis:", error);
    }
  };

  // Get players currently on field for a team (starters + players who came in - players who went out)
  const getPlayersOnField = (teamColor: string): Player[] => {
    const starters = players[teamColor] || [];
    
    // Add players who entered via substitution to this team
    const playersIn = substitutions
      .filter(s => s.team_color === teamColor)
      .map(s => s.player_in)
      .filter(Boolean) as Player[];
    
    // Get IDs of players who left via substitution
    const playersOutIds = substitutions
      .filter(s => s.team_color === teamColor)
      .map(s => s.player_out_id);
    
    // Combine and filter
    const allPlayers = [...starters, ...playersIn];
    return allPlayers.filter(p => !playersOutIds.includes(p.id));
  };

  const addSubstitution = async () => {
    if (!subData.team || !subData.player_out_id || !subData.player_in_id || !match) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const currentMin = Math.ceil((720 - timer) / 60);

    setLoading(true);
    try {
      const { error } = await supabase
        .from("substitutions")
        .insert([{
          match_id: match.id,
          team_color: subData.team as "branco" | "vermelho" | "azul" | "laranja",
          player_out_id: subData.player_out_id,
          player_in_id: subData.player_in_id,
          minute: currentMin,
        }]);

      if (error) throw error;

      toast.success("Substituição registrada!");
      setAddingSub(false);
      setSubData({ team: "", player_out_id: "", player_in_id: "" });
      loadMatchData();
    } catch (error: any) {
      toast.error("Erro ao registrar substituição: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Effect to load available players when opening substitution form
  useEffect(() => {
    if (addingSub && match) {
      loadAvailablePlayersIn();
    }
  }, [addingSub, substitutions, match]);

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
      toast.success("Partida iniciada!");
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
        const { error } = await supabase
          .from("matches")
          .update({ match_timer_paused_at: new Date().toISOString() })
          .eq("id", match.id);

        if (error) throw error;
        setTimerRunning(false);
        toast.info("Cronômetro pausado");
      } else {
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

    const currentMin = Math.ceil((720 - timer) / 60);

    setLoading(true);
    try {
      const isOwnGoal = goalData.player_id === "own_goal";
      
      const { data: result, error: rpcError } = await supabase.rpc('record_goal_with_assist', {
        p_match_id: match.id,
        p_team_color: goalData.team,
        p_scorer_profile_id: isOwnGoal ? null : goalData.player_id,
        p_minute: currentMin,
        p_is_own_goal: isOwnGoal,
        p_assist_profile_id: goalData.has_assist && goalData.assist_player_id ? goalData.assist_player_id : null,
      });

      if (rpcError) throw rpcError;

      const rpcResult = result as { success: boolean; error?: string };
      
      if (!rpcResult.success) {
        throw new Error(rpcResult.error || 'Erro ao registrar gol');
      }

      toast.success(`Gol registrado!`);
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

    const currentMin = Math.ceil((720 - timer) / 60);

    setLoading(true);
    try {
      const { error } = await supabase
        .from("cards")
        .insert([{
          match_id: match.id,
          player_id: cardData.player_id,
          card_type: cardData.card_type as "amarelo" | "azul",
          minute: currentMin,
        }]);

      if (error) throw error;

      toast.success(`Cartão registrado!`);
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

      const { error: deleteError } = await supabase
        .from("goals")
        .delete()
        .eq("id", lastGoal.id);

      if (deleteError) throw deleteError;

      const teamToUpdate = lastGoal.team_color === match?.team_home ? 'score_home' : 'score_away';
      const currentScore = lastGoal.team_color === match?.team_home ? match?.score_home : match?.score_away;
      
      const { error: updateError } = await supabase
        .from("matches")
        .update({
          [teamToUpdate]: Math.max(0, (currentScore || 0) - 1)
        })
        .eq("id", match?.id);

      if (updateError) throw updateError;

      await supabase.rpc('recalc_round_aggregates', { p_round_id: match?.round_id });
      await supabase.rpc('recalc_all_player_rankings');

      toast.success("Gol deletado!");
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

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        throw new Error(result.error || 'Erro ao encerrar partida');
      }
      
      setTimerRunning(false);
      toast.success("Partida encerrada!");
      loadMatchData();
    } catch (error: any) {
      toast.error("Erro ao encerrar partida: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !match) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">Carregando...</div>
        </main>
      </div>
    );
  }

  const isMatchActive = match.status === 'in_progress';
  const isMatchFinished = match.status === 'finished';
  const maxMinute = currentMinute || 12;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Sticky timer bar for in-progress matches */}
      {isMatchActive && (
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border py-3 shadow-lg">
          <div className="container mx-auto px-4 flex items-center justify-center gap-4">
            <div className="text-3xl font-bold text-primary font-mono">
              {currentMinute !== null ? `${currentMinute}'` : "0'"}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTimer}
              className="rounded-full border-primary/50 hover:bg-primary/10"
            >
              {timerRunning ? <Pause size={18} className="text-primary" /> : <Play size={18} className="text-primary" />}
            </Button>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-6 max-w-lg">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/admin/round/manage?round=${roundId}`)}
          className="mb-4 hover:bg-primary/10"
        >
          <ArrowLeft size={18} className="mr-2" />
          Voltar
        </Button>

        {/* Main match card using MatchHeader */}
        <Card className="border-border overflow-hidden mb-6">
          <CardContent className="p-4">
            <MatchHeader
              teamHome={match.team_home}
              teamAway={match.team_away}
              scoreHome={match.score_home}
              scoreAway={match.score_away}
              roundNumber={match.round_number}
              matchNumber={match.match_number}
              status={match.status as "not_started" | "in_progress" | "finished"}
              scheduledTime={match.scheduled_time}
              currentMinute={currentMinute}
              className="mb-4"
            />

            {/* Timeline */}
            {match.status !== 'not_started' && timelineEvents.length > 0 && (
              <MatchTimeline
                events={timelineEvents}
                teamHome={match.team_home}
                teamAway={match.team_away}
                maxMinute={maxMinute}
              />
            )}

            {match.status === 'not_started' && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Partida aguardando início
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin action buttons */}
        <div className="space-y-3">
          {match.status === 'not_started' && (
            <Button 
              onClick={startMatch} 
              className="w-full min-h-[52px] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={loading}
            >
              <Play size={20} className="mr-2" />
              Iniciar Partida
            </Button>
          )}

          {isMatchActive && (
            <>
              {/* Goal, Card and Substitution buttons row */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => { setAddingGoal(!addingGoal); setAddingCard(false); setAddingSub(false); }}
                  variant={addingGoal ? "default" : "outline"}
                  className={`min-h-[52px] rounded-xl font-medium ${
                    addingGoal 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border-0" 
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Goal size={18} className="mr-1" />
                  {addingGoal ? "X" : "Gol"}
                </Button>

                <Button
                  onClick={() => { setAddingCard(!addingCard); setAddingGoal(false); setAddingSub(false); }}
                  variant={addingCard ? "default" : "outline"}
                  className={`min-h-[52px] rounded-xl font-medium ${
                    addingCard 
                      ? "bg-yellow-600 hover:bg-yellow-700 text-white border-0" 
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Square size={18} className="mr-1" />
                  {addingCard ? "X" : "Cartão"}
                </Button>

                <Button
                  onClick={() => { setAddingSub(!addingSub); setAddingGoal(false); setAddingCard(false); }}
                  variant={addingSub ? "default" : "outline"}
                  className={`min-h-[52px] rounded-xl font-medium ${
                    addingSub 
                      ? "bg-gray-600 hover:bg-gray-700 text-white border-0" 
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <ArrowLeftRight size={18} className="mr-1" />
                  {addingSub ? "X" : "Subst."}
                </Button>
              </div>

              {/* Goal form */}
              {addingGoal && (
                <Card className="bg-muted/10 border-border rounded-xl">
                  <CardContent className="p-4 space-y-4">
                    <Select value={goalData.team} onValueChange={(v) => setGoalData({ ...goalData, team: v, player_id: "", has_assist: false, assist_player_id: "" })}>
                      <SelectTrigger className="h-12 rounded-lg">
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
                          <p className="text-sm font-medium mb-3 text-foreground">Quem marcou?</p>
                          <div className="grid grid-cols-3 gap-2">
                            {players[goalData.team]?.map((player) => (
                              <Button
                                key={player.id}
                                variant={goalData.player_id === player.id ? "default" : "outline"}
                                className={`h-auto py-3 px-2 text-xs min-h-[44px] rounded-lg ${
                                  goalData.player_id === player.id ? "bg-primary" : ""
                                }`}
                                onClick={() => setGoalData({ ...goalData, player_id: player.id })}
                              >
                                {player.nickname || player.name}
                              </Button>
                            ))}
                            <Button
                              variant={goalData.player_id === "own_goal" ? "default" : "outline"}
                              className={`h-auto py-3 px-2 text-xs min-h-[44px] rounded-lg ${
                                goalData.player_id === "own_goal" ? "bg-destructive" : ""
                              }`}
                              onClick={() => setGoalData({ ...goalData, player_id: "own_goal", has_assist: false, assist_player_id: "" })}
                            >
                              Gol Contra
                            </Button>
                          </div>
                        </div>

                        {goalData.player_id && goalData.player_id !== "own_goal" && (
                          <>
                            <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Target size={18} className="text-primary" />
                                <span className="text-sm font-medium">Houve assistência?</span>
                              </div>
                              <Switch
                                checked={goalData.has_assist}
                                onCheckedChange={(checked) => 
                                  setGoalData({ ...goalData, has_assist: checked, assist_player_id: "" })
                                }
                              />
                            </div>

                            {goalData.has_assist && (
                              <div>
                                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                                  <User size={16} />
                                  Quem deu a assistência?
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                  {players[goalData.team]
                                    ?.filter(p => p.id !== goalData.player_id)
                                    .map((player) => (
                                      <Button
                                        key={player.id}
                                        variant={goalData.assist_player_id === player.id ? "default" : "outline"}
                                        className={`h-auto py-3 px-2 text-xs min-h-[44px] rounded-lg ${
                                          goalData.assist_player_id === player.id ? "bg-primary" : ""
                                        }`}
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
                      className="w-full min-h-[48px] rounded-lg bg-emerald-600 hover:bg-emerald-700" 
                      disabled={loading || !goalData.team || !goalData.player_id || (goalData.has_assist && !goalData.assist_player_id)}
                    >
                      Confirmar Gol ({Math.ceil((720 - timer) / 60)}')
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Card form */}
              {addingCard && (
                <Card className="bg-muted/10 border-border rounded-xl">
                  <CardContent className="p-4 space-y-4">
                    <Select value={cardData.team} onValueChange={(v) => setCardData({ ...cardData, team: v, player_id: "" })}>
                      <SelectTrigger className="h-12 rounded-lg">
                        <SelectValue placeholder="Selecione o time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={match.team_home}>{teamNames[match.team_home]}</SelectItem>
                        <SelectItem value={match.team_away}>{teamNames[match.team_away]}</SelectItem>
                      </SelectContent>
                    </Select>

                    {cardData.team && (
                      <div>
                        <p className="text-sm font-medium mb-3">Jogador:</p>
                        <div className="grid grid-cols-3 gap-2">
                          {players[cardData.team]?.map((player) => (
                            <Button
                              key={player.id}
                              variant={cardData.player_id === player.id ? "default" : "outline"}
                              className={`h-auto py-3 px-2 text-xs min-h-[44px] rounded-lg ${
                                cardData.player_id === player.id ? "bg-primary" : ""
                              }`}
                              onClick={() => setCardData({ ...cardData, player_id: player.id })}
                            >
                              {player.nickname || player.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {cardData.player_id && (
                      <div>
                        <p className="text-sm font-medium mb-3">Tipo de cartão:</p>
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            variant={cardData.card_type === "amarelo" ? "default" : "outline"}
                            className={`min-h-[48px] rounded-lg ${
                              cardData.card_type === "amarelo" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""
                            }`}
                            onClick={() => setCardData({ ...cardData, card_type: "amarelo" })}
                          >
                            🟨 Amarelo
                          </Button>
                          <Button
                            variant={cardData.card_type === "azul" ? "default" : "outline"}
                            className={`min-h-[48px] rounded-lg ${
                              cardData.card_type === "azul" ? "bg-blue-500 hover:bg-blue-600 text-white" : ""
                            }`}
                            onClick={() => setCardData({ ...cardData, card_type: "azul" })}
                          >
                            🟦 Azul
                          </Button>
                        </div>
                      </div>
                    )}

                    <Button 
                      onClick={addCard} 
                      className="w-full min-h-[48px] rounded-lg bg-yellow-600 hover:bg-yellow-700" 
                      disabled={loading || !cardData.team || !cardData.player_id || !cardData.card_type}
                    >
                      Confirmar Cartão ({Math.ceil((720 - timer) / 60)}')
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Substitution form */}
              {addingSub && (
                <Card className="bg-muted/10 border-border rounded-xl">
                  <CardContent className="p-4 space-y-4">
                    <Select value={subData.team} onValueChange={(v) => setSubData({ ...subData, team: v, player_out_id: "", player_in_id: "" })}>
                      <SelectTrigger className="h-12 rounded-lg">
                        <SelectValue placeholder="Time que substitui" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={match.team_home}>{teamNames[match.team_home]}</SelectItem>
                        <SelectItem value={match.team_away}>{teamNames[match.team_away]}</SelectItem>
                      </SelectContent>
                    </Select>

                    {subData.team && (
                      <>
                        <div>
                          <p className="text-sm font-medium mb-3 text-foreground flex items-center gap-2">
                            <span className="text-red-500">▼</span> Quem sai?
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {getPlayersOnField(subData.team).map((player) => (
                              <Button
                                key={player.id}
                                variant={subData.player_out_id === player.id ? "default" : "outline"}
                                className={`h-auto py-3 px-2 text-xs min-h-[44px] rounded-lg ${
                                  subData.player_out_id === player.id ? "bg-red-600 hover:bg-red-700" : ""
                                }`}
                                onClick={() => setSubData({ ...subData, player_out_id: player.id })}
                              >
                                {player.nickname || player.name}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {subData.player_out_id && (
                          <div>
                            <p className="text-sm font-medium mb-3 text-foreground flex items-center gap-2">
                              <span className="text-green-500">▲</span> Quem entra?
                            </p>
                            {availablePlayersIn.length > 0 ? (
                              <div className="grid grid-cols-3 gap-2">
                                {availablePlayersIn.map((player) => (
                                  <Button
                                    key={player.id}
                                    variant={subData.player_in_id === player.id ? "default" : "outline"}
                                    className={`h-auto py-3 px-2 text-xs min-h-[44px] rounded-lg ${
                                      subData.player_in_id === player.id ? "bg-green-600 hover:bg-green-700" : ""
                                    }`}
                                    onClick={() => setSubData({ ...subData, player_in_id: player.id })}
                                  >
                                    {player.nickname || player.name}
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                Nenhum jogador disponível para entrar
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    <Button 
                      onClick={addSubstitution} 
                      className="w-full min-h-[48px] rounded-lg bg-gray-600 hover:bg-gray-700" 
                      disabled={loading || !subData.team || !subData.player_out_id || !subData.player_in_id}
                    >
                      Confirmar Substituição ({Math.ceil((720 - timer) / 60)}')
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Undo and Finish buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={deleteLastGoal}
                  variant="outline"
                  disabled={goals.length === 0 || loading}
                  className="min-h-[48px] rounded-xl border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                  <Undo2 size={18} className="mr-2" />
                  Desfazer Gol
                </Button>

                <Button 
                  onClick={finishMatch} 
                  variant="outline"
                  className="min-h-[48px] rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10"
                  disabled={loading}
                >
                  <Flag size={18} className="mr-2" />
                  Encerrar
                </Button>
              </div>
            </>
          )}

          {isMatchFinished && (
            <div className="space-y-3">
              <div className="text-center py-4 text-muted-foreground text-sm">
                Partida encerrada
              </div>
              <Button 
                onClick={() => navigate(`/admin/round/manage?round=${roundId}`)} 
                variant="outline"
                className="w-full min-h-[48px] rounded-xl"
              >
                <ArrowLeft size={18} className="mr-2" />
                Voltar para Gerenciar Rodada
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
