import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Play, Pause, Goal, Square, Undo2, Flag, ArrowLeftRight, X, Check } from "lucide-react";
import { MatchTimeline, TimelineEvent } from "@/components/match/MatchTimeline";
import { TeamLogo } from "@/components/match/TeamLogo";

type TeamColor = "branco" | "vermelho" | "azul" | "laranja";

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
  const [activeForm, setActiveForm] = useState<"goal" | "card" | "sub" | null>(null);
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

  useEffect(() => {
    if (match?.status === "in_progress") {
      const interval = setInterval(() => setCurrentMinute(getCurrentMatchMinute(match)), 1000);
      return () => clearInterval(interval);
    } else {
      setCurrentMinute(match ? getCurrentMatchMinute(match) : null);
    }
  }, [match]);

  useEffect(() => {
    if (!match) return;
    
    const events: TimelineEvent[] = [];
    
    if (match.started_at) {
      events.push({ id: `start-${match.id}`, type: "match_start", minute: 0 });
    }
    
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
    
    if (match.status === "finished" && match.finished_at) {
      const endMinute = getCurrentMatchMinute(match);
      events.push({ id: `end-${match.id}`, type: "match_end", minute: Math.max(endMinute, 12) });
    }
    
    events.sort((a, b) => a.minute - b.minute);
    setTimelineEvents(events);
  }, [match, goals, cards, substitutions]);

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

  const loadAvailablePlayersIn = async () => {
    if (!roundId || !match) return;

    try {
      // Buscar jogadores de times que NÃO estão jogando nesta partida
      const { data: otherTeamPlayers } = await supabase
        .from("round_team_players")
        .select("player_id, team_color, profiles!inner(id, name, nickname, avatar_url, position)")
        .eq("round_id", roundId)
        .not("team_color", "in", `(${match.team_home},${match.team_away})`);

      // IDs de jogadores que já entraram em alguma substituição DESTA partida
      const playersAlreadyIn = new Set(substitutions.map(s => s.player_in_id));

      const availablePlayers = (otherTeamPlayers || [])
        .map((p: any) => p.profiles)
        .filter(Boolean)
        .filter((p: Player) => !playersAlreadyIn.has(p.id));

      console.log('[ManageMatch] loadAvailablePlayersIn:', {
        roundId,
        teamsNotPlaying: `NOT in (${match.team_home},${match.team_away})`,
        totalFromOtherTeams: otherTeamPlayers?.length || 0,
        alreadyEnteredIds: Array.from(playersAlreadyIn),
        availableCount: availablePlayers.length,
        availableNames: availablePlayers.map((p: Player) => p.nickname || p.name)
      });

      setAvailablePlayersIn(availablePlayers);
    } catch (error) {
      console.error("Erro ao carregar jogadores disponíveis:", error);
    }
  };

  const getPlayersOnField = (teamColor: string): Player[] => {
    const starters = players[teamColor] || [];
    
    // Jogadores que entraram via substituição para este time
    const playersIn = substitutions
      .filter(s => s.team_color === teamColor)
      .map(s => s.player_in)
      .filter(Boolean) as Player[];
    
    // IDs de jogadores que saíram via substituição deste time
    const playersOutIds = new Set(
      substitutions
        .filter(s => s.team_color === teamColor)
        .map(s => s.player_out_id)
    );
    
    // Todos em campo = titulares + entraram - saíram
    const allPlayers = [...starters, ...playersIn];
    const onField = allPlayers.filter(p => !playersOutIds.has(p.id));

    console.log(`[ManageMatch] getPlayersOnField(${teamColor}):`, {
      starters: starters.map(p => p.nickname || p.name),
      playersIn: playersIn.map(p => p.nickname || p.name),
      playersOut: Array.from(playersOutIds),
      onField: onField.map(p => p.nickname || p.name)
    });

    return onField;
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
      closeForm();
      loadMatchData();
    } catch (error: any) {
      toast.error("Erro ao registrar substituição: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeForm === "sub" && match) {
      loadAvailablePlayersIn();
    }
  }, [activeForm, substitutions, match]);

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

  const closeForm = () => {
    setActiveForm(null);
    setGoalData({ team: "", player_id: "", has_assist: false, assist_player_id: "" });
    setCardData({ team: "", player_id: "", card_type: "" });
    setSubData({ team: "", player_out_id: "", player_in_id: "" });
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
      closeForm();
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
      closeForm();
      loadMatchData();
    } catch (error: any) {
      toast.error("Erro ao registrar cartão: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteLastEvent = async () => {
    const allEvents = [
      ...goals.map(g => ({ type: 'goal' as const, minute: g.minute, id: g.id, team_color: g.team_color })),
      ...cards.map(c => ({ type: 'card' as const, minute: c.minute, id: c.id })),
      ...substitutions.map(s => ({ type: 'sub' as const, minute: s.minute, id: s.id })),
    ].sort((a, b) => b.minute - a.minute);

    if (allEvents.length === 0) {
      toast.error("Não há eventos para desfazer");
      return;
    }

    const lastEvent = allEvents[0];
    const eventTypeText = lastEvent.type === 'goal' ? 'gol' : lastEvent.type === 'card' ? 'cartão' : 'substituição';
    
    const confirmed = window.confirm(`Tem certeza que deseja desfazer o último evento (${eventTypeText})?`);
    if (!confirmed) return;

    setLoading(true);
    try {
      if (lastEvent.type === 'goal') {
        const { error: deleteError } = await supabase
          .from("goals")
          .delete()
          .eq("id", lastEvent.id);

        if (deleteError) throw deleteError;

        const teamToUpdate = lastEvent.team_color === match?.team_home ? 'score_home' : 'score_away';
        const currentScore = lastEvent.team_color === match?.team_home ? match?.score_home : match?.score_away;
        
        await supabase
          .from("matches")
          .update({ [teamToUpdate]: Math.max(0, (currentScore || 0) - 1) })
          .eq("id", match?.id);

        await supabase.rpc('recalc_round_aggregates', { p_round_id: match?.round_id });
        await supabase.rpc('recalc_all_player_rankings');
      } else if (lastEvent.type === 'card') {
        const { error: deleteError } = await supabase
          .from("cards")
          .delete()
          .eq("id", lastEvent.id);

        if (deleteError) throw deleteError;
      } else {
        const { error: deleteError } = await supabase
          .from("substitutions")
          .delete()
          .eq("id", lastEvent.id);

        if (deleteError) throw deleteError;
      }

      toast.success(`${eventTypeText.charAt(0).toUpperCase() + eventTypeText.slice(1)} desfeito!`);
      await loadMatchData();
    } catch (error) {
      console.error("Erro ao desfazer evento:", error);
      toast.error("Erro ao desfazer evento");
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

  if (loading && !match) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">Carregando...</div>
        </main>
      </div>
    );
  }

  if (!match) return null;

  const isMatchActive = match.status === 'in_progress';
  const isMatchFinished = match.status === 'finished';
  const maxMinute = currentMinute || 12;
  const displayMinute = Math.ceil((720 - timer) / 60);

  // Status badge styling
  const getStatusStyle = () => {
    if (match.status === 'in_progress') return "bg-primary/20 text-primary border-primary/30";
    if (match.status === 'finished') return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const getStatusText = () => {
    if (match.status === 'in_progress') return `${currentMinute || 0}'`;
    if (match.status === 'finished') return "Encerrado";
    return "A iniciar";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-4 max-w-md">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/admin/round/manage?round=${roundId}`)}
          className="mb-3 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} className="mr-1" />
          Voltar
        </Button>

        {/* Compact Header - Score Board */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-4">
          {/* Round info */}
          <p className="text-center text-xs text-muted-foreground mb-3">
            Rodada {match.round_number || '?'} • Jogo {match.match_number}
          </p>
          
          {/* Score display */}
          <div className="flex items-center justify-center gap-6 mb-3">
            <div className="flex flex-col items-center gap-1">
              <TeamLogo teamColor={match.team_home as TeamColor} size="md" />
              <span className="text-xs text-muted-foreground">{teamNames[match.team_home]}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold text-foreground">{match.score_home}</span>
              <span className="text-2xl text-muted-foreground">:</span>
              <span className="text-4xl font-bold text-foreground">{match.score_away}</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <TeamLogo teamColor={match.team_away as TeamColor} size="md" />
              <span className="text-xs text-muted-foreground">{teamNames[match.team_away]}</span>
            </div>
          </div>

          {/* Status / Timer */}
          <div className="flex items-center justify-center gap-2">
            <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusStyle()}`}>
              {getStatusText()}
            </span>
            
            {isMatchActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTimer}
                className="h-8 w-8 p-0 rounded-full hover:bg-muted"
              >
                {timerRunning ? <Pause size={14} /> : <Play size={14} />}
              </Button>
            )}
          </div>
        </div>

        {/* Action Buttons - Only show when match is active */}
        {isMatchActive && !activeForm && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            <Button
              onClick={() => setActiveForm("goal")}
              className="flex flex-col items-center gap-1 h-auto py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
            >
              <Goal size={18} />
              <span className="text-xs">Gol</span>
            </Button>

            <Button
              onClick={() => setActiveForm("card")}
              className="flex flex-col items-center gap-1 h-auto py-3 bg-amber-500 hover:bg-amber-600 text-black rounded-xl"
            >
              <Square size={16} />
              <span className="text-xs">Cartão</span>
            </Button>

            <Button
              onClick={() => setActiveForm("sub")}
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-3 rounded-xl border-border hover:bg-muted"
            >
              <ArrowLeftRight size={18} />
              <span className="text-xs">Subst.</span>
            </Button>

            <Button
              onClick={deleteLastEvent}
              variant="outline"
              disabled={goals.length === 0 && cards.length === 0 && substitutions.length === 0}
              className="flex flex-col items-center gap-1 h-auto py-3 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <Undo2 size={18} />
              <span className="text-xs">Desfazer</span>
            </Button>
          </div>
        )}

        {/* Goal Form */}
        {activeForm === "goal" && (
          <Card className="mb-4 border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-emerald-400 flex items-center gap-2">
                  <Goal size={16} />
                  Registrar Gol
                </h3>
                <Button variant="ghost" size="sm" onClick={closeForm} className="h-8 w-8 p-0">
                  <X size={16} />
                </Button>
              </div>

              {/* Team Selection */}
              <div className="grid grid-cols-2 gap-2">
                {([match.team_home, match.team_away] as TeamColor[]).map((team) => (
                  <Button
                    key={team}
                    variant={goalData.team === team ? "default" : "outline"}
                    className={`h-12 rounded-lg ${goalData.team === team ? "bg-primary" : ""}`}
                    onClick={() => setGoalData({ ...goalData, team, player_id: "", has_assist: false, assist_player_id: "" })}
                  >
                    <TeamLogo teamColor={team} size="sm" className="mr-2" />
                    {teamNames[team]}
                  </Button>
                ))}
              </div>

              {/* Player Selection */}
              {goalData.team && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Quem marcou?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {getPlayersOnField(goalData.team).map((player) => (
                      <Button
                        key={player.id}
                        variant={goalData.player_id === player.id ? "default" : "outline"}
                        className={`h-11 text-xs px-2 rounded-lg ${goalData.player_id === player.id ? "bg-emerald-600" : ""}`}
                        onClick={() => setGoalData({ ...goalData, player_id: player.id })}
                      >
                        {player.nickname || player.name.split(' ')[0]}
                      </Button>
                    ))}
                    <Button
                      variant={goalData.player_id === "own_goal" ? "default" : "outline"}
                      className={`h-11 text-xs px-2 rounded-lg ${goalData.player_id === "own_goal" ? "bg-destructive" : ""}`}
                      onClick={() => setGoalData({ ...goalData, player_id: "own_goal", has_assist: false, assist_player_id: "" })}
                    >
                      Gol Contra
                    </Button>
                  </div>
                </div>
              )}

              {/* Assist Toggle */}
              {goalData.player_id && goalData.player_id !== "own_goal" && (
                <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                  <span className="text-sm">Houve assistência?</span>
                  <Switch
                    checked={goalData.has_assist}
                    onCheckedChange={(checked) => setGoalData({ ...goalData, has_assist: checked, assist_player_id: "" })}
                  />
                </div>
              )}

              {/* Assist Player Selection */}
              {goalData.has_assist && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Quem assistiu?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {getPlayersOnField(goalData.team)
                      .filter(p => p.id !== goalData.player_id)
                      .map((player) => (
                        <Button
                          key={player.id}
                          variant={goalData.assist_player_id === player.id ? "default" : "outline"}
                          className={`h-11 text-xs px-2 rounded-lg ${goalData.assist_player_id === player.id ? "bg-primary" : ""}`}
                          onClick={() => setGoalData({ ...goalData, assist_player_id: player.id })}
                        >
                          {player.nickname || player.name.split(' ')[0]}
                        </Button>
                      ))}
                  </div>
                </div>
              )}

              {/* Confirm Button */}
              <Button 
                onClick={addGoal} 
                className="w-full h-12 rounded-lg bg-emerald-600 hover:bg-emerald-700" 
                disabled={loading || !goalData.team || !goalData.player_id || (goalData.has_assist && !goalData.assist_player_id)}
              >
                <Check size={16} className="mr-2" />
                Confirmar Gol ({displayMinute}')
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Card Form */}
        {activeForm === "card" && (
          <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-amber-400 flex items-center gap-2">
                  <Square size={16} />
                  Registrar Cartão
                </h3>
                <Button variant="ghost" size="sm" onClick={closeForm} className="h-8 w-8 p-0">
                  <X size={16} />
                </Button>
              </div>

              {/* Team Selection */}
              <div className="grid grid-cols-2 gap-2">
                {([match.team_home, match.team_away] as TeamColor[]).map((team) => (
                  <Button
                    key={team}
                    variant={cardData.team === team ? "default" : "outline"}
                    className={`h-12 rounded-lg ${cardData.team === team ? "bg-primary" : ""}`}
                    onClick={() => setCardData({ ...cardData, team, player_id: "" })}
                  >
                    <TeamLogo teamColor={team} size="sm" className="mr-2" />
                    {teamNames[team]}
                  </Button>
                ))}
              </div>

              {/* Player Selection */}
              {cardData.team && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Jogador:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {getPlayersOnField(cardData.team).map((player) => (
                      <Button
                        key={player.id}
                        variant={cardData.player_id === player.id ? "default" : "outline"}
                        className={`h-11 text-xs px-2 rounded-lg ${cardData.player_id === player.id ? "bg-amber-500 text-black" : ""}`}
                        onClick={() => setCardData({ ...cardData, player_id: player.id })}
                      >
                        {player.nickname || player.name.split(' ')[0]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Card Type Selection */}
              {cardData.player_id && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Tipo:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={cardData.card_type === "amarelo" ? "default" : "outline"}
                      className={`h-12 rounded-lg ${cardData.card_type === "amarelo" ? "bg-yellow-500 text-black" : ""}`}
                      onClick={() => setCardData({ ...cardData, card_type: "amarelo" })}
                    >
                      🟨 Amarelo
                    </Button>
                    <Button
                      variant={cardData.card_type === "azul" ? "default" : "outline"}
                      className={`h-12 rounded-lg ${cardData.card_type === "azul" ? "bg-blue-500 text-white" : ""}`}
                      onClick={() => setCardData({ ...cardData, card_type: "azul" })}
                    >
                      🟦 Azul
                    </Button>
                  </div>
                </div>
              )}

              {/* Confirm Button */}
              <Button 
                onClick={addCard} 
                className="w-full h-12 rounded-lg bg-amber-500 hover:bg-amber-600 text-black" 
                disabled={loading || !cardData.team || !cardData.player_id || !cardData.card_type}
              >
                <Check size={16} className="mr-2" />
                Confirmar Cartão ({displayMinute}')
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Substitution Form */}
        {activeForm === "sub" && (
          <Card className="mb-4 border-border">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground flex items-center gap-2">
                  <ArrowLeftRight size={16} />
                  Registrar Substituição
                </h3>
                <Button variant="ghost" size="sm" onClick={closeForm} className="h-8 w-8 p-0">
                  <X size={16} />
                </Button>
              </div>

              {/* Team Selection */}
              <div className="grid grid-cols-2 gap-2">
                {([match.team_home, match.team_away] as TeamColor[]).map((team) => (
                  <Button
                    key={team}
                    variant={subData.team === team ? "default" : "outline"}
                    className={`h-12 rounded-lg ${subData.team === team ? "bg-primary" : ""}`}
                    onClick={() => setSubData({ ...subData, team, player_out_id: "", player_in_id: "" })}
                  >
                    <TeamLogo teamColor={team} size="sm" className="mr-2" />
                    {teamNames[team]}
                  </Button>
                ))}
              </div>

              {/* Player Out Selection */}
              {subData.team && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <span className="text-red-500">▼</span> Quem sai?
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {getPlayersOnField(subData.team).map((player) => (
                      <Button
                        key={player.id}
                        variant={subData.player_out_id === player.id ? "default" : "outline"}
                        className={`h-11 text-xs px-2 rounded-lg ${subData.player_out_id === player.id ? "bg-red-600" : ""}`}
                        onClick={() => setSubData({ ...subData, player_out_id: player.id })}
                      >
                        {player.nickname || player.name.split(' ')[0]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Player In Selection */}
              {subData.player_out_id && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <span className="text-green-500">▲</span> Quem entra?
                  </p>
                  {availablePlayersIn.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {availablePlayersIn.map((player) => (
                        <Button
                          key={player.id}
                          variant={subData.player_in_id === player.id ? "default" : "outline"}
                          className={`h-11 text-xs px-2 rounded-lg ${subData.player_in_id === player.id ? "bg-green-600" : ""}`}
                          onClick={() => setSubData({ ...subData, player_in_id: player.id })}
                        >
                          {player.nickname || player.name.split(' ')[0]}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum jogador disponível
                    </p>
                  )}
                </div>
              )}

              {/* Confirm Button */}
              <Button 
                onClick={addSubstitution} 
                className="w-full h-12 rounded-lg" 
                disabled={loading || !subData.team || !subData.player_out_id || !subData.player_in_id}
              >
                <Check size={16} className="mr-2" />
                Confirmar Substituição ({displayMinute}')
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        {match.status !== 'not_started' && timelineEvents.length > 0 && (
          <Card className="mb-4 border-border">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-2 text-center">Eventos da Partida</p>
              <MatchTimeline
                events={timelineEvents}
                teamHome={match.team_home}
                teamAway={match.team_away}
                maxMinute={maxMinute}
              />
            </CardContent>
          </Card>
        )}

        {/* Start Match Button */}
        {match.status === 'not_started' && (
          <Button 
            onClick={startMatch} 
            className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-lg"
            disabled={loading}
          >
            <Play size={20} className="mr-2" />
            Iniciar Partida
          </Button>
        )}

        {/* Finish Match Button */}
        {isMatchActive && !activeForm && (
          <Button 
            onClick={finishMatch} 
            variant="outline"
            className="w-full h-12 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10 mt-2"
            disabled={loading}
          >
            <Flag size={16} className="mr-2" />
            Encerrar Partida
          </Button>
        )}

        {/* Finished State */}
        {isMatchFinished && (
          <div className="space-y-3">
            <div className="text-center py-4">
              <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                ✓ Partida Encerrada
              </span>
            </div>
            <Button 
              onClick={() => navigate(`/admin/round/manage?round=${roundId}`)} 
              variant="outline"
              className="w-full h-12 rounded-xl"
            >
              <ArrowLeft size={16} className="mr-2" />
              Voltar para Gerenciar Rodada
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
