import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, AlertCircle, Save, X, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EVENT_ICONS, formatMinute } from "@/components/ui/event-item";
import { TeamLogo } from "@/components/match/TeamLogo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface CardEvent {
  id: string;
  player_id: string;
  card_type: string;
  minute: number;
  player?: Player;
  team_color?: string;
}

const teamNames: Record<string, string> = {
  branco: "Branco",
  vermelho: "Vermelho",
  azul: "Azul",
  laranja: "Laranja",
};

interface ManageMatchDialogProps {
  matchId: string;
  roundId: string;
  roundNumber?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function ManageMatchDialog({ matchId, roundId, roundNumber, open, onOpenChange, onSaved }: ManageMatchDialogProps) {
  const { toast } = useToast();
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Record<string, Player[]>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cards, setCards] = useState<CardEvent[]>([]);
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
    }
  }, [open, matchId, roundId]);

  useEffect(() => {
    if (match) {
      loadPlayers();
    }
  }, [match, roundId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!open || !matchId) return;

    const channel = supabase
      .channel(`dialog-match-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "goals", filter: `match_id=eq.${matchId}` }, () => {
        loadGoals();
        recalculateMatchScore();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cards", filter: `match_id=eq.${matchId}` }, () => {
        loadCards();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "assists" }, () => {
        loadGoals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, matchId]);

  const loadMatchData = async () => {
    setIsLoading(true);
    try {
      await recalculateMatchScore();
      
      const { data: matchData, error } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (error) throw error;
      setMatch(matchData);

      await Promise.all([loadGoals(), loadCards()]);
      setHasUnsavedChanges(false);
    } catch (error: any) {
      console.error("Erro ao carregar partida:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlayers = async () => {
    if (!match) return;

    try {
      const { data: homePlayers } = await supabase
        .from("round_team_players")
        .select("player_id, profiles!inner(id, name, nickname)")
        .eq("round_id", roundId)
        .eq("team_color", match.team_home as "azul" | "branco" | "laranja" | "vermelho");

      const { data: awayPlayers } = await supabase
        .from("round_team_players")
        .select("player_id, profiles!inner(id, name, nickname)")
        .eq("round_id", roundId)
        .eq("team_color", match.team_away as "azul" | "branco" | "laranja" | "vermelho");

      setPlayers({
        [match.team_home]: (homePlayers || []).map((p: any) => p.profiles),
        [match.team_away]: (awayPlayers || []).map((p: any) => p.profiles),
      });
    } catch (error) {
      console.error("Erro ao carregar jogadores:", error);
    }
  };

  const loadGoals = async () => {
    try {
      const { data: goalsData } = await supabase
        .from("goals")
        .select(`
          id, player_id, minute, is_own_goal, team_color,
          player:profiles!goals_player_id_fkey(id, name, nickname),
          assists(id, player_id, player:profiles!assists_player_id_fkey(id, name, nickname))
        `)
        .eq("match_id", matchId)
        .order("minute", { ascending: true });

      setGoals((goalsData || []).map((g: any) => ({
        ...g,
        player: g.player,
        assists: g.assists,
      })));
    } catch (error) {
      console.error("Erro ao carregar gols:", error);
    }
  };

  const loadCards = async () => {
    try {
      const { data: cardsData } = await supabase
        .from("cards")
        .select(`
          id, player_id, card_type, minute,
          player:profiles!cards_player_id_fkey(id, name, nickname)
        `)
        .eq("match_id", matchId)
        .order("minute", { ascending: true });

      // Get team colors for cards
      const cardsWithTeam: CardEvent[] = [];
      for (const card of cardsData || []) {
        const { data: teamData } = await supabase
          .from("round_team_players")
          .select("team_color")
          .eq("player_id", card.player_id)
          .eq("round_id", roundId)
          .maybeSingle();

        cardsWithTeam.push({ ...card, team_color: teamData?.team_color });
      }

      setCards(cardsWithTeam);
    } catch (error) {
      console.error("Erro ao carregar cartões:", error);
    }
  };

  const calculateExpectedScore = useCallback((goalsData: Goal[], teamHome: string, teamAway: string) => {
    let scoreHome = 0;
    let scoreAway = 0;
    
    goalsData.forEach(goal => {
      if (goal.is_own_goal) {
        if (goal.team_color === teamHome) scoreAway++;
        else scoreHome++;
      } else {
        if (goal.team_color === teamHome) scoreHome++;
        else scoreAway++;
      }
    });
    
    return { scoreHome, scoreAway };
  }, []);

  const recalculateMatchScore = async () => {
    try {
      const [{ data: matchData }, { data: allGoals }] = await Promise.all([
        supabase.from("matches").select("team_home, team_away, score_home, score_away").eq("id", matchId).single(),
        supabase.from("goals").select("team_color, is_own_goal").eq("match_id", matchId)
      ]);
      
      if (!matchData) return;
      
      const expected = calculateExpectedScore(
        (allGoals || []).map(g => ({ ...g, id: '', match_id: matchId, player_id: '', minute: 0 })),
        matchData.team_home,
        matchData.team_away
      );
      
      const needsUpdate = matchData.score_home !== expected.scoreHome || matchData.score_away !== expected.scoreAway;
      
      if (needsUpdate) {
        await supabase
          .from("matches")
          .update({ score_home: expected.scoreHome, score_away: expected.scoreAway })
          .eq("id", matchId);
      }
      
      if (match) {
        setMatch(prev => prev ? { ...prev, score_home: expected.scoreHome, score_away: expected.scoreAway } : null);
      }
    } catch (error) {
      console.error("Erro ao recalcular placar:", error);
    }
  };

  const handleAddGoal = async () => {
    if (!match || !goalData.team || (!goalData.player_id && !goalData.is_own_goal)) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione o time e o jogador",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      let currentMinute = 12;
      
      if (match.status === 'in_progress' && match.match_timer_started_at) {
        const startTime = new Date(match.match_timer_started_at).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const totalPausedSeconds = match.match_timer_total_paused_seconds || 0;
        const effectiveSeconds = elapsedSeconds - totalPausedSeconds;
        const calculatedMinute = Math.ceil(effectiveSeconds / 60);
        
        if (calculatedMinute >= 1) {
          currentMinute = calculatedMinute;
        }
      }
      
      const { data: result, error: rpcError } = await supabase.rpc('record_goal_with_assist', {
        p_match_id: matchId,
        p_team_color: goalData.team,
        p_scorer_profile_id: goalData.is_own_goal ? null : goalData.player_id,
        p_minute: currentMinute,
        p_is_own_goal: goalData.is_own_goal,
        p_assist_profile_id: goalData.has_assist && goalData.assist_player_id && !goalData.is_own_goal 
          ? goalData.assist_player_id 
          : null,
      });

      if (rpcError) throw rpcError;

      const rpcResult = result as { success: boolean; error?: string };
      
      if (!rpcResult.success) {
        throw new Error(rpcResult.error || 'Erro ao registrar gol');
      }

      setHasUnsavedChanges(true);
      toast({
        title: "✅ Gol registrado!",
        description: "Lembre-se de salvar as alterações",
      });
      
      setGoalData({ team: "", player_id: "", has_assist: false, assist_player_id: "", is_own_goal: false });
      setAddingGoal(false);
      await loadMatchData();
    } catch (error: any) {
      console.error("Erro ao adicionar gol:", error);
      toast({
        title: "Erro ao adicionar gol",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    setIsSaving(true);
    try {
      await supabase.from("assists").delete().eq("goal_id", goalId);
      const { error } = await supabase.from("goals").delete().eq("id", goalId);
      
      if (error) throw error;
      
      await recalculateMatchScore();
      setHasUnsavedChanges(true);
      
      toast({
        title: "✅ Gol excluído!",
      });
      
      await loadMatchData();
    } catch (error: any) {
      console.error("Erro ao excluir gol:", error);
      toast({
        title: "Erro ao excluir gol",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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

    setIsSaving(true);
    try {
      let currentMinute = 12;
      
      if (match?.status === 'in_progress' && match.match_timer_started_at) {
        const startTime = new Date(match.match_timer_started_at).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const totalPausedSeconds = match.match_timer_total_paused_seconds || 0;
        const effectiveSeconds = elapsedSeconds - totalPausedSeconds;
        const calculatedMinute = Math.ceil(effectiveSeconds / 60);
        
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
        title: "✅ Cartão registrado!",
      });
      
      setCardData({ team: "", player_id: "", card_type: "" });
      setAddingCard(false);
      await loadCards();
    } catch (error: any) {
      console.error("Erro ao adicionar cartão:", error);
      toast({
        title: "Erro ao adicionar cartão",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("cards").delete().eq("id", cardId);
      if (error) throw error;

      setHasUnsavedChanges(true);
      toast({ title: "✅ Cartão excluído!" });
      await loadCards();
    } catch (error: any) {
      console.error("Erro ao excluir cartão:", error);
      toast({ title: "Erro ao excluir cartão", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMatch = async () => {
    setIsSaving(true);
    try {
      // Recalcular pontos da rodada
      const { error: recalcError } = await supabase.rpc('recalc_round_aggregates', {
        p_round_id: roundId
      });

      if (recalcError) {
        console.error("Erro ao recalcular stats:", recalcError);
      }

      // Recalcular rankings globais
      const { error: rankError } = await supabase.rpc('recalc_all_player_rankings');

      if (rankError) {
        console.error("Erro ao recalcular rankings:", rankError);
      }

      if (recalcError || rankError) {
        toast({
          title: "⚠️ Salvo com aviso",
          description: "Dados salvos, mas houve erro ao recalcular pontos.",
        });
      } else {
        toast({
          title: "✅ Partida salva!",
          description: "Todos os dados foram atualizados.",
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialog = async () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      // Sempre recalcular ao fechar para garantir consistência
      try {
        await supabase.rpc('recalc_round_aggregates', { p_round_id: roundId });
        await supabase.rpc('recalc_all_player_rankings');
      } catch (error) {
        console.error("Erro ao recalcular ao fechar:", error);
      }
      onSaved();
      onOpenChange(false);
    }
  };

  const handleDiscardAndClose = async () => {
    setShowCloseConfirm(false);
    try {
      await supabase.rpc('recalc_round_aggregates', { p_round_id: roundId });
      await supabase.rpc('recalc_all_player_rankings');
    } catch (error) {
      console.error("Erro ao recalcular:", error);
    }
    setHasUnsavedChanges(false);
    onSaved();
    onOpenChange(false);
  };

  const handleSaveAndClose = async () => {
    setShowCloseConfirm(false);
    await handleSaveMatch();
  };

  // Combine and sort all events for timeline
  const timelineEvents = [
    ...goals.map(g => ({
      id: g.id,
      type: 'goal' as const,
      minute: g.minute,
      team_color: g.team_color,
      player: g.player,
      assist: g.assists?.[0]?.player,
      is_own_goal: g.is_own_goal,
    })),
    ...cards.map(c => ({
      id: c.id,
      type: c.card_type as 'amarelo' | 'azul',
      minute: c.minute,
      team_color: c.team_color,
      player: c.player,
    })),
  ].sort((a, b) => a.minute - b.minute);

  if (!match) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-lg max-h-[95vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">
                {roundNumber ? `Rodada ${roundNumber} — ` : ''}Jogo {match.match_number}
              </DialogTitle>
              <Button variant="ghost" size="icon" onClick={handleCloseDialog} className="h-8 w-8">
                <X size={18} />
              </Button>
            </div>
          </DialogHeader>

          {/* Score Display */}
          <div className="px-4 py-3 bg-muted/30">
            <div className="flex items-center justify-center gap-6">
              <div className="flex flex-col items-center gap-1">
                <TeamLogo teamColor={match.team_home as TeamColor} size="md" />
                <span className="text-xs text-muted-foreground">{teamNames[match.team_home]}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold">{match.score_home}</span>
                <span className="text-xl text-muted-foreground">:</span>
                <span className="text-4xl font-bold">{match.score_away}</span>
              </div>
              
              <div className="flex flex-col items-center gap-1">
                <TeamLogo teamColor={match.team_away as TeamColor} size="md" />
                <span className="text-xs text-muted-foreground">{teamNames[match.team_away]}</span>
              </div>
            </div>
            
            <div className="text-center mt-2">
              <Badge variant="outline" className="text-xs">
                {goals.length} gol(s) • {cards.length} cartão(ões)
              </Badge>
            </div>
          </div>

          {/* Alerts */}
          {hasUnsavedChanges && (
            <Alert className="mx-4 mt-2 bg-amber-500/10 border-amber-500/30">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-500 text-sm">
                Alterações não salvas
              </AlertDescription>
            </Alert>
          )}

          {/* Tabs Content */}
          <Tabs defaultValue="events" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-4 mt-2 grid grid-cols-2">
              <TabsTrigger value="events">Eventos</TabsTrigger>
              <TabsTrigger value="add">Adicionar</TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="flex-1 overflow-y-auto px-4 pb-4 mt-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : timelineEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum evento registrado
                </div>
              ) : (
                <div className="space-y-2">
                  {timelineEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors group"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <TeamLogo teamColor={event.team_color as TeamColor} size="sm" />
                        <span className="text-lg">
                          {event.type === 'goal' ? EVENT_ICONS.goal : 
                           event.type === 'amarelo' ? EVENT_ICONS.amarelo : EVENT_ICONS.azul}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {formatMinute(event.minute)}
                            </span>
                            <span className="truncate text-sm">
                              {event.type === 'goal' && event.is_own_goal 
                                ? 'Gol Contra' 
                                : event.player?.nickname || event.player?.name || '—'}
                            </span>
                          </div>
                          {event.type === 'goal' && event.assist && (
                            <div className="text-xs text-muted-foreground truncate">
                              Assist: {event.assist.nickname || event.assist.name}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => event.type === 'goal' ? handleDeleteGoal(event.id) : handleDeleteCard(event.id)}
                        disabled={isSaving}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="add" className="flex-1 overflow-y-auto px-4 pb-4 mt-2 space-y-4">
              {/* Add Goal Section */}
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-emerald-500 flex items-center gap-2">
                      {EVENT_ICONS.goal} Adicionar Gol
                    </span>
                    {addingGoal && (
                      <Button variant="ghost" size="sm" onClick={() => setAddingGoal(false)} className="h-7 px-2">
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  {!addingGoal ? (
                    <Button onClick={() => setAddingGoal(true)} variant="outline" className="w-full border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10">
                      <Plus size={16} className="mr-2" />
                      Registrar Gol
                    </Button>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {[match.team_home, match.team_away].map((team) => (
                          <Button
                            key={team}
                            variant={goalData.team === team ? "default" : "outline"}
                            className={`h-10 ${goalData.team === team ? "bg-emerald-600" : ""}`}
                            onClick={() => setGoalData({ ...goalData, team, player_id: "", assist_player_id: "" })}
                          >
                            <TeamLogo teamColor={team as TeamColor} size="sm" className="mr-1" />
                            {teamNames[team]}
                          </Button>
                        ))}
                      </div>

                      {goalData.team && (
                        <>
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

                          {!goalData.is_own_goal && (
                            <Select value={goalData.player_id} onValueChange={(v) => setGoalData({ ...goalData, player_id: v })}>
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="Quem marcou?" />
                              </SelectTrigger>
                              <SelectContent>
                                {(players[goalData.team] || []).map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.nickname || p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {goalData.player_id && !goalData.is_own_goal && (
                            <>
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id="has_assist"
                                  checked={goalData.has_assist}
                                  onChange={(e) => setGoalData({ ...goalData, has_assist: e.target.checked, assist_player_id: "" })}
                                  className="h-4 w-4"
                                />
                                <label htmlFor="has_assist" className="text-sm">Houve assistência?</label>
                              </div>

                              {goalData.has_assist && (
                                <Select value={goalData.assist_player_id} onValueChange={(v) => setGoalData({ ...goalData, assist_player_id: v })}>
                                  <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Quem assistiu?" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(players[goalData.team] || []).filter(p => p.id !== goalData.player_id).map((p) => (
                                      <SelectItem key={p.id} value={p.id}>{p.nickname || p.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </>
                          )}

                          <Button 
                            onClick={handleAddGoal} 
                            disabled={isSaving || (!goalData.player_id && !goalData.is_own_goal)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700"
                          >
                            {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                            Confirmar Gol
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Add Card Section */}
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-amber-500 flex items-center gap-2">
                      {EVENT_ICONS.amarelo} Adicionar Cartão
                    </span>
                    {addingCard && (
                      <Button variant="ghost" size="sm" onClick={() => setAddingCard(false)} className="h-7 px-2">
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  {!addingCard ? (
                    <Button onClick={() => setAddingCard(true)} variant="outline" className="w-full border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
                      <Plus size={16} className="mr-2" />
                      Registrar Cartão
                    </Button>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {[match.team_home, match.team_away].map((team) => (
                          <Button
                            key={team}
                            variant={cardData.team === team ? "default" : "outline"}
                            className={`h-10 ${cardData.team === team ? "bg-amber-600" : ""}`}
                            onClick={() => setCardData({ ...cardData, team, player_id: "" })}
                          >
                            <TeamLogo teamColor={team as TeamColor} size="sm" className="mr-1" />
                            {teamNames[team]}
                          </Button>
                        ))}
                      </div>

                      {cardData.team && (
                        <>
                          <Select value={cardData.player_id} onValueChange={(v) => setCardData({ ...cardData, player_id: v })}>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Selecione o jogador" />
                            </SelectTrigger>
                            <SelectContent>
                              {(players[cardData.team] || []).map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.nickname || p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant={cardData.card_type === "amarelo" ? "default" : "outline"}
                              className={`h-10 ${cardData.card_type === "amarelo" ? "bg-yellow-500 text-black" : ""}`}
                              onClick={() => setCardData({ ...cardData, card_type: "amarelo" })}
                            >
                              🟨 Amarelo
                            </Button>
                            <Button
                              variant={cardData.card_type === "azul" ? "default" : "outline"}
                              className={`h-10 ${cardData.card_type === "azul" ? "bg-blue-600" : ""}`}
                              onClick={() => setCardData({ ...cardData, card_type: "azul" })}
                            >
                              🟦 Azul
                            </Button>
                          </div>

                          <Button 
                            onClick={handleAddCard} 
                            disabled={isSaving || !cardData.player_id || !cardData.card_type}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-black"
                          >
                            {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                            Confirmar Cartão
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Sticky Save Button */}
          <div className="p-4 border-t border-border bg-background">
            <Button 
              onClick={handleSaveMatch} 
              disabled={isSaving}
              className="w-full min-h-[48px] gap-2"
            >
              {isSaving ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Save size={18} />
              )}
              Salvar Partida
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Confirmation */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas. O que deseja fazer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowCloseConfirm(false)}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardAndClose} className="bg-destructive hover:bg-destructive/90">
              Descartar
            </AlertDialogAction>
            <AlertDialogAction onClick={handleSaveAndClose} className="bg-primary">
              Salvar e Fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
