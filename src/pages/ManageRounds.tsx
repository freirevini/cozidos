import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, PlayCircle, Edit3, Trash2, CheckCircle, Clock, AlertCircle, PlusCircle, Loader2 } from "lucide-react";
import ManageMatchDialog from "@/components/ManageMatchDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AdminMatchCard, AdminMatchMiniNav, useSwipeGesture } from "@/components/admin/AdminMatchCard";
import { RoundCarousel } from "@/components/admin/RoundCarousel";

interface Match {
  id: string;
  match_number: number;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  scheduled_time: string;
  status: string;
  match_timer_started_at?: string | null;
  match_timer_paused_at?: string | null;
  match_timer_total_paused_seconds?: number | null;
}

interface Round {
  id: string;
  round_number: number;
  scheduled_date: string;
  status: string;
}

// Swipeable card wrapper component
function SwipeableMatchCard({
  match,
  matches,
  selectedMatchId,
  onSelectMatch,
  onStart,
  onManage,
  onEdit,
  onDelete,
}: {
  match: Match;
  matches: Match[];
  selectedMatchId: string | null;
  onSelectMatch: (id: string) => void;
  onStart: () => void;
  onManage: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const navigateMatch = (direction: 'prev' | 'next') => {
    if (!selectedMatchId) return;
    const currentIndex = matches.findIndex(m => m.id === selectedMatchId);
    const newIndex = direction === 'prev'
      ? Math.max(0, currentIndex - 1)
      : Math.min(matches.length - 1, currentIndex + 1);

    if (newIndex !== currentIndex) {
      onSelectMatch(matches[newIndex].id);
    }
  };

  const { handleTouchStart, handleTouchEnd } = useSwipeGesture(
    () => navigateMatch('next'),  // Swipe left = next
    () => navigateMatch('prev')   // Swipe right = previous
  );

  return (
    <div
      className="mt-4 touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <AdminMatchCard
        match={match}
        isSelected={true}
        onStart={onStart}
        onManage={onManage}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

export default function ManageRounds() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roundId = searchParams.get("round");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [deleteConfirmMatch, setDeleteConfirmMatch] = useState<Match | null>(null);
  const [finishAllConfirm, setFinishAllConfirm] = useState(false);
  const [finalizeConfirm, setFinalizeConfirm] = useState(false);
  const [, setTick] = useState(0); // For timer updates

  // Timer update every second for live matches
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      await loadRoundData();
      toast.success("Dados atualizados!");
    }
  });

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso não autorizado");
      navigate("/");
    } else {
      loadAllRounds();
      if (roundId) {
        loadRoundData();
      }
    }
  }, [isAdmin, roundId, navigate]);

  useEffect(() => {
    if (matches.length > 0 && !selectedMatchId) {
      const inProgress = matches.find(m => m.status === "in_progress");
      const notStarted = matches.find(m => m.status === "not_started");
      setSelectedMatchId(inProgress?.id || notStarted?.id || matches[0].id);
    }
  }, [matches, selectedMatchId]);

  // Realtime subscription for matches
  useEffect(() => {
    if (!roundId) return;

    const channel = supabase
      .channel(`round-${roundId}-matches`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "matches",
        filter: `round_id=eq.${roundId}`
      }, () => {
        loadRoundData();
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "goals"
      }, () => {
        loadRoundData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  const loadAllRounds = async () => {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select("*")
        .or("is_historical.is.null,is_historical.eq.false")
        .neq("round_number", 0)
        .order("round_number", { ascending: false });

      if (error) throw error;
      setAllRounds(data || []);
    } catch (error) {
      console.error("Erro ao carregar rodadas:", error);
    }
  };

  const loadRoundData = async () => {
    if (!roundId) return;

    try {
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;
      setRound(roundData);

      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .eq("round_id", roundId)
        .order("match_number");

      if (matchesError) throw matchesError;
      setMatches(matchesData || []);
    } catch (error) {
      console.error("Erro ao carregar rodada:", error);
      toast.error("Erro ao carregar dados da rodada");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "A definir";
    try {
      const date = new Date(dateString + "T00:00:00");
      if (isNaN(date.getTime())) return "A definir";
      return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return "A definir";
    }
  };

  const selectedMatch = matches.find(m => m.id === selectedMatchId);
  const handleEditMatch = async (matchId: string) => {
    if (round?.status === 'finalizada') {
      try {
        const { error } = await supabase
          .from('rounds')
          .update({ status: 'em_andamento' })
          .eq('id', round.id);

        if (error) throw error;

        toast.success('Rodada reaberta para edição');
        await loadRoundData();
      } catch (error: any) {
        toast.error('Erro ao reabrir rodada: ' + error.message);
        return;
      }
    }

    setEditingMatchId(matchId);
  };

  const createMatches = async () => {
    if (!roundId || !round) return;

    setActionLoading('create');

    try {
      const { data: teams, error: teamsError } = await supabase
        .from("round_teams")
        .select("team_color")
        .eq("round_id", roundId);

      if (teamsError) throw teamsError;

      if (!teams || teams.length < 3) {
        toast.error("É necessário ter pelo menos 3 times para criar partidas");
        return;
      }

      const teamColors = teams.map(t => t.team_color);
      const matchesToCreate: any[] = [];
      let matchNumber = 1;
      let currentTime = 21 * 60;

      if (teamColors.length === 4) {
        const matchPairs = [
          ['azul', 'branco'],
          ['vermelho', 'azul'],
          ['laranja', 'vermelho'],
          ['branco', 'laranja'],
          ['azul', 'branco'],
          ['vermelho', 'laranja'],
          ['branco', 'vermelho'],
          ['laranja', 'azul'],
        ];

        matchPairs.forEach(([home, away]) => {
          const hours = Math.floor(currentTime / 60);
          const minutes = currentTime % 60;
          const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

          matchesToCreate.push({
            round_id: roundId,
            match_number: matchNumber++,
            team_home: home,
            team_away: away,
            score_home: 0,
            score_away: 0,
            scheduled_time: timeString,
            status: 'not_started',
          });

          currentTime += 12;
        });
      } else if (teamColors.length === 3) {
        const matchPairs: string[][] = [];

        for (let i = 0; i < teamColors.length; i++) {
          for (let j = i + 1; j < teamColors.length; j++) {
            matchPairs.push([teamColors[i], teamColors[j]]);
          }
        }

        for (let i = 0; i < teamColors.length; i++) {
          for (let j = i + 1; j < teamColors.length; j++) {
            matchPairs.push([teamColors[j], teamColors[i]]);
          }
        }

        matchPairs.forEach(([home, away]) => {
          const hours = Math.floor(currentTime / 60);
          const minutes = currentTime % 60;
          const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

          matchesToCreate.push({
            round_id: roundId,
            match_number: matchNumber++,
            team_home: home,
            team_away: away,
            score_home: 0,
            score_away: 0,
            scheduled_time: timeString,
            status: 'not_started',
          });

          currentTime += 12;
        });
      } else {
        for (let i = 0; i < teamColors.length; i++) {
          for (let j = i + 1; j < teamColors.length; j++) {
            const hours = Math.floor(currentTime / 60);
            const minutes = currentTime % 60;
            const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

            matchesToCreate.push({
              round_id: roundId,
              match_number: matchNumber++,
              team_home: teamColors[i],
              team_away: teamColors[j],
              score_home: 0,
              score_away: 0,
              scheduled_time: timeString,
              status: 'not_started',
            });

            currentTime += 12;
          }
        }
      }

      const { error: insertError } = await supabase
        .from("matches")
        .insert(matchesToCreate);

      if (insertError) throw insertError;

      toast.success("Partidas criadas com sucesso!");
      loadRoundData();
    } catch (error: any) {
      console.error("Erro ao criar partidas:", error);
      toast.error("Erro ao criar partidas: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const finishAllMatches = async () => {
    if (!roundId) return;

    setActionLoading('finishAll');
    setFinishAllConfirm(false);
    try {
      const { data, error } = await supabase.rpc('close_all_matches_by_round', {
        p_round_id: roundId
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        error?: string;
        message?: string;
        newly_closed?: number;
        already_closed?: number;
      };

      if (!result.success) {
        throw new Error(result.error || 'Erro ao encerrar partidas');
      }

      toast.success(result.message || `${result.newly_closed} partida(s) encerrada(s)!`);
      loadRoundData();
    } catch (error: any) {
      console.error("Erro ao encerrar partidas:", error);
      toast.error("Erro ao encerrar partidas: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const finalizeRound = async () => {
    if (!roundId || !round) return;

    const unfinishedMatches = matches.filter(m => m.status !== 'finished');
    if (unfinishedMatches.length > 0) {
      toast.error(`Ainda há ${unfinishedMatches.length} partida(s) não finalizada(s)`);
      return;
    }

    setActionLoading('finalize');
    setFinalizeConfirm(false);

    try {
      const { error: updateError } = await supabase
        .from("rounds")
        .update({
          status: 'finalizada',
          completed_at: new Date().toISOString()
        })
        .eq("id", roundId);

      if (updateError) throw updateError;

      const { error: recalcError } = await supabase.rpc('recalc_round_aggregates', {
        p_round_id: roundId
      });

      if (recalcError) {
        console.error('Erro ao recalcular pontos:', recalcError);
        toast.error('Rodada finalizada, mas houve erro ao recalcular pontos.');
      } else {
        toast.success('Rodada finalizada com sucesso!');
      }

      navigate("/admin/round");
    } catch (error: any) {
      console.error("Erro ao finalizar rodada:", error);
      toast.error("Erro ao finalizar rodada: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const startMatch = async (matchId: string) => {
    setActionLoading(matchId);
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          match_timer_started_at: new Date().toISOString()
        })
        .eq('id', matchId);

      if (error) throw error;

      // Update round status if needed
      if (round?.status === 'a_iniciar') {
        await supabase
          .from('rounds')
          .update({ status: 'em_andamento' })
          .eq('id', roundId);
      }

      toast.success('Partida iniciada!');
      await loadRoundData();
    } catch (error: any) {
      toast.error('Erro ao iniciar partida: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteMatch = async (matchId: string) => {
    setActionLoading(matchId);
    setDeleteConfirmMatch(null);
    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);

      if (error) throw error;

      toast.success('Partida excluída!');
      if (selectedMatchId === matchId) {
        setSelectedMatchId(null);
      }
      await loadRoundData();
    } catch (error: any) {
      toast.error('Erro ao excluir partida: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const openMatchPage = (match: Match) => {
    navigate(`/admin/match/${match.id}/${roundId}`);
  };

  if (!roundId) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card className="bg-card border-border">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">Nenhuma rodada selecionada</p>
              <Button onClick={() => navigate("/admin/round")}>
                Voltar
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const allFinished = matches.every(m => m.status === 'finished');
  const anyInProgress = matches.some(m => m.status === 'in_progress');

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 pointer-events-none"
          style={{ opacity: Math.min(pullDistance / 80, 1) }}
        >
          <div className="bg-primary text-primary-foreground rounded-full p-3 shadow-lg">
            {isRefreshing ? <Loader2 className="animate-spin" size={20} /> : "↓"}
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-4 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/round")}
            className="h-10 w-10"
          >
            <ArrowLeft size={20} />
          </Button>

          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary">Rodada {round?.round_number}</h1>
            <p className="text-sm text-muted-foreground">{formatDate(round?.scheduled_date)}</p>
          </div>

          {round && (
            <Badge className={cn(
              "py-1.5 px-3",
              round.status === 'a_iniciar' && "bg-muted text-muted-foreground",
              round.status === 'em_andamento' && "bg-amber-600 text-white",
              round.status === 'finalizada' && "bg-emerald-600 text-white"
            )}>
              {round.status === 'a_iniciar' && <Clock size={14} className="mr-1" />}
              {round.status === 'em_andamento' && <PlayCircle size={14} className="mr-1" />}
              {round.status === 'finalizada' && <CheckCircle size={14} className="mr-1" />}
              {round.status === 'a_iniciar' ? 'A Iniciar' :
                round.status === 'em_andamento' ? 'Em Andamento' : 'Finalizada'}
            </Badge>
          )}
        </div>

        {/* Round Navigation Carousel */}
        {allRounds.length > 1 && roundId && (
          <RoundCarousel
            rounds={allRounds}
            selectedRoundId={roundId}
            onSelectRound={(newRoundId) => {
              navigate(`/admin/round/manage?round=${newRoundId}`);
            }}
          />
        )}

        {/* Action Buttons */}
        {matches.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              onClick={() => setFinishAllConfirm(true)}
              disabled={!!actionLoading || allFinished}
              variant="outline"
              size="sm"
              className="flex-1 min-w-[140px] gap-1"
            >
              {actionLoading === 'finishAll' ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
              Encerrar Todas
            </Button>
            <Button
              onClick={() => navigate(`/admin/round/${roundId}/attendance`)}
              disabled={!!actionLoading}
              variant="outline"
              size="sm"
              className="flex-1 min-w-[140px] gap-1"
            >
              <AlertCircle size={14} />
              Atrasos/Faltas
            </Button>
            <Button
              onClick={() => setFinalizeConfirm(true)}
              disabled={!!actionLoading || !allFinished}
              size="sm"
              className="flex-1 min-w-[140px] gap-1"
            >
              {actionLoading === 'finalize' ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
              Finalizar Rodada
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : matches.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Nenhuma partida criada</p>
              <Button
                onClick={createMatches}
                disabled={actionLoading === 'create'}
                className="gap-2"
              >
                {actionLoading === 'create' ? <Loader2 className="animate-spin" size={16} /> : <PlusCircle size={16} />}
                Criar Partidas
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mini Navigation with integrated arrows */}
            <AdminMatchMiniNav
              matches={matches}
              selectedMatchId={selectedMatchId}
              onSelectMatch={setSelectedMatchId}
            />

            {/* Selected Match Card with Swipe Support */}
            {selectedMatch && (
              <SwipeableMatchCard
                match={selectedMatch}
                matches={matches}
                selectedMatchId={selectedMatchId}
                onSelectMatch={setSelectedMatchId}
                onStart={() => startMatch(selectedMatch.id)}
                onManage={() => openMatchPage(selectedMatch)}
                onEdit={() => handleEditMatch(selectedMatch.id)}
                onDelete={() => setDeleteConfirmMatch(selectedMatch)}
              />
            )}
          </>
        )}
      </main>

      {/* Edit Dialog */}
      {editingMatchId && roundId && (
        <ManageMatchDialog
          matchId={editingMatchId}
          roundId={roundId}
          roundNumber={round?.round_number}
          open={!!editingMatchId}
          onOpenChange={(open) => !open && setEditingMatchId(null)}
          onSaved={async () => {
            await loadRoundData();
            await supabase.rpc('recalc_round_aggregates', { p_round_id: roundId });
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmMatch} onOpenChange={() => setDeleteConfirmMatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Partida</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta partida? Todos os gols, cartões e substituições serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmMatch && deleteMatch(deleteConfirmMatch.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finish All Confirmation */}
      <AlertDialog open={finishAllConfirm} onOpenChange={setFinishAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar Todas as Partidas</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encerrar todas as partidas desta rodada?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={finishAllMatches}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finalize Round Confirmation */}
      <AlertDialog open={finalizeConfirm} onOpenChange={setFinalizeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Rodada</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja finalizar esta rodada? Os pontos serão calculados e a classificação será atualizada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={finalizeRound}>
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
