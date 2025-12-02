import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, PlayCircle, Edit3, Trash2, CheckCircle, Clock, AlertCircle, PlusCircle } from "lucide-react";
import ManageMatchDialog from "@/components/ManageMatchDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Skeleton } from "@/components/ui/skeleton";
import EventsFilterPanel from "@/components/EventsFilterPanel";


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

interface Round {
  id: string;
  round_number: number;
  scheduled_date: string;
  status: string;
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

export default function ManageRounds() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roundId = searchParams.get("round");
  
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState<Round | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [deleteConfirmMatch, setDeleteConfirmMatch] = useState<Match | null>(null);
  const [finishAllConfirm, setFinishAllConfirm] = useState(false);
  const [finalizeConfirm, setFinalizeConfirm] = useState(false);

  // Pull to refresh
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
    } else if (roundId) {
      loadRoundData();
    }
  }, [isAdmin, roundId, navigate]);

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

  const handleEditMatch = async (matchId: string) => {
    // Se a rodada estiver finalizada, mudar para em_andamento
    if (round?.status === 'finalizada') {
      try {
        const { error } = await supabase
          .from('rounds')
          .update({ status: 'em_andamento' })
          .eq('id', round.id);
        
        if (error) throw error;
        
        toast.success('Rodada reaberta para edição. Lembre-se de finalizar novamente após as alterações.');
        await loadRoundData(); // Recarregar dados
      } catch (error: any) {
        toast.error('Erro ao reabrir rodada: ' + error.message);
        return; // Não abrir o diálogo se houver erro
      }
    }
    
    setEditingMatchId(matchId);
  };

  const createMatches = async () => {
    if (!roundId || !round) return;

    setLoading(true);

    try {
      // Buscar times da rodada
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
      let currentTime = 21 * 60; // 21:00 em minutos

      // Criar partidas seguindo ordem específica
      if (teamColors.length === 4) {
        // Ordem específica para 4 times: AZUL x BRANCO, VERMELHO x AZUL, LARANJA x VERMELHO, BRANCO x LARANJA, AZUL x BRANCO, VERMELHO x LARANJA, BRANCO x VERMELHO, LARANJA x AZUL
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
        // Para 3 times: ida e volta entre todos, evitando que um time jogue 2 seguidas
        const matchPairs: string[][] = [];
        
        // Primeira rodada
        for (let i = 0; i < teamColors.length; i++) {
          for (let j = i + 1; j < teamColors.length; j++) {
            matchPairs.push([teamColors[i], teamColors[j]]);
          }
        }
        
        // Segunda rodada (volta)
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
        // Rodízio padrão para outros números de times
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

      // Rodada permanece como 'a_iniciar' até que alguma partida seja iniciada
      // Não alterar status automaticamente aqui

      toast.success("Partidas criadas com sucesso!");
      loadRoundData();
    } catch (error: any) {
      console.error("Erro ao criar partidas:", error);
      toast.error("Erro ao criar partidas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const showAttendanceDialog = () => {
    const yesNo = window.confirm("Houve atraso e falta na rodada?\n\nClique em 'OK' para SIM ou 'Cancelar' para NÃO");
    if (yesNo) {
      navigate(`/admin/round/${roundId}/attendance`);
    } else {
      // Não houve atrasos/faltas, permitir edição de partidas antes de finalizar
      toast.info("Você pode editar as partidas agora antes de finalizar");
    }
  };

  const finishAllMatches = async () => {
    if (!roundId) return;

    setLoading(true);
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

      toast.success(result.message || `${result.newly_closed} partida(s) encerrada(s) com sucesso!`);
      loadRoundData();
    } catch (error: any) {
      console.error("Erro ao encerrar partidas:", error);
      toast.error("Erro ao encerrar partidas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const recalculateRoundPoints = async () => {
    if (!roundId) return;

    toast.info("Recalculando pontos da rodada...");

    try {
      const { data, error } = await supabase.rpc('recalc_round_aggregates', {
        p_round_id: roundId
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao recalcular pontos');
      }

      toast.success("✅ Pontos da rodada recalculados com sucesso!");
    } catch (error: any) {
      console.error("Erro ao recalcular pontos:", error);
      toast.error("❌ Erro ao recalcular pontos: " + error.message);
    }
  };

  const finalizeRound = async () => {
    if (!roundId || !round) return;

    // Verificar se todas as partidas foram finalizadas
    const unfinishedMatches = matches.filter(m => m.status !== 'finished');
    if (unfinishedMatches.length > 0) {
      toast.error(`Ainda há ${unfinishedMatches.length} partida(s) não finalizada(s)`);
      return;
    }

    setLoading(true);
    setFinalizeConfirm(false);

    try {
      // Atualizar status da rodada para "finalizada"
      const { error: updateError } = await supabase
        .from("rounds")
        .update({ 
          status: 'finalizada',
          completed_at: new Date().toISOString()
        })
        .eq("id", roundId);

      if (updateError) throw updateError;

      // Recalcular pontos da rodada
      const { error: recalcError } = await supabase.rpc('recalc_round_aggregates', {
        p_round_id: roundId
      });

      if (recalcError) {
        console.error('Erro ao recalcular pontos:', recalcError);
        toast.error('Rodada finalizada, mas houve erro ao recalcular pontos. Verifique a classificação.');
      } else {
        toast.success('Rodada finalizada com sucesso! Classificação atualizada.');
      }

      navigate("/admin/round");
    } catch (error: any) {
      console.error("Erro ao finalizar rodada:", error);
      toast.error("Erro ao finalizar rodada: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startMatch = async (matchId: string) => {
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
      
      toast.success('Partida iniciada com sucesso!');
      await loadRoundData();
      await syncRoundStatus();
    } catch (error: any) {
      toast.error('Erro ao iniciar partida: ' + error.message);
    }
  };

  const deleteMatch = async (matchId: string) => {
    try {
      setDeleteConfirmMatch(null);
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);
      
      if (error) throw error;
      
      toast.success('Partida excluída com sucesso!');
      await loadRoundData();
      await syncRoundStatus();
    } catch (error: any) {
      toast.error('Erro ao excluir partida: ' + error.message);
    }
  };

  const syncRoundStatus = async () => {
    if (!roundId) return;
    
    // NÃO alterar rodadas que já foram iniciadas ou finalizadas manualmente
    if (round?.status === 'em_andamento' || round?.status === 'finalizada') {
      return;
    }
    
    // Apenas sincronizar rodadas em 'a_iniciar'
    if (round?.status === 'a_iniciar') {
      const anyInProgress = matches.some(m => m.status === 'in_progress');
      const anyFinished = matches.some(m => m.status === 'finished');
      
      // Se alguma partida foi iniciada, mudar status para 'em_andamento'
      if (anyInProgress || anyFinished) {
        await supabase
          .from('rounds')
          .update({ status: 'em_andamento' })
          .eq('id', roundId);
        
        loadRoundData();
      }
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
          <Card className="card-glow bg-card border-border">
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 pointer-events-none"
          style={{ opacity: Math.min(pullDistance / 80, 1) }}
        >
          <div className="bg-primary text-primary-foreground rounded-full p-3 shadow-lg">
            {isRefreshing ? (
              <div className="animate-spin">⟳</div>
            ) : (
              <div>↓</div>
            )}
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin/round")}
                className="hover:bg-primary/10"
              >
                <ArrowLeft size={24} />
              </Button>
              
              {matches.length === 0 && !loading && (
                <Button
                  onClick={createMatches}
                  size="sm"
                  className="gap-2"
                >
                  <PlusCircle size={16} />
                  <span className="hidden sm:inline">Criar Partidas</span>
                </Button>
              )}
            </div>
            
            <div className="text-center mb-6">
              <CardTitle className="text-2xl sm:text-3xl font-bold text-primary glow-text mb-3">
                Rodada {round?.round_number}
              </CardTitle>
              <div className="text-muted-foreground mb-3">
                {round && new Date(round.scheduled_date).toLocaleDateString('pt-BR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
              {round && (
                <Badge 
                  className={`text-base py-2 px-4 ${
                    round.status === 'a_iniciar' ? 'bg-gray-600 hover:bg-gray-600' :
                    round.status === 'em_andamento' ? 'bg-yellow-600 hover:bg-yellow-600' :
                    'bg-green-600 hover:bg-green-600'
                  } text-white`}
                >
                  {round.status === 'a_iniciar' && <Clock size={16} className="inline mr-2" />}
                  {round.status === 'em_andamento' && <PlayCircle size={16} className="inline mr-2" />}
                  {round.status === 'finalizada' && <CheckCircle size={16} className="inline mr-2" />}
                  {round.status === 'a_iniciar' ? 'A Iniciar' : 
                   round.status === 'em_andamento' ? 'Em Andamento' : 'Finalizada'}
                </Badge>
              )}
            </div>
            
            {matches.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <Button
                  onClick={() => setFinishAllConfirm(true)}
                  disabled={loading || matches.every(m => m.status === 'finished')}
                  variant="outline"
                  className="w-full sm:w-auto py-3 sm:py-2 gap-2"
                >
                  <CheckCircle size={18} />
                  Encerrar Todas
                </Button>
                <Button
                  onClick={showAttendanceDialog}
                  disabled={loading || matches.some(m => m.status !== 'finished')}
                  variant="secondary"
                  className="w-full sm:w-auto py-3 sm:py-2 gap-2"
                >
                  <AlertCircle size={18} />
                  Atrasos/Faltas
                </Button>
                <Button
                  onClick={() => setFinalizeConfirm(true)}
                  disabled={loading || matches.some(m => m.status !== 'finished')}
                  className="w-full sm:w-auto py-3 sm:py-2 gap-2"
                >
                  <CheckCircle size={18} />
                  Finalizar Rodada
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <>
                {/* Loading skeletons desktop */}
                <div className="hidden md:block space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border-b border-border">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-8 w-64" />
                      <Skeleton className="h-6 w-24 ml-auto" />
                      <Skeleton className="h-9 w-32" />
                    </div>
                  ))}
                </div>
                
                {/* Loading skeletons mobile */}
                <div className="md:hidden space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="bg-muted/10">
                      <CardContent className="p-5">
                        <div className="flex justify-between mb-4">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-6 w-24" />
                        </div>
                        <div className="flex justify-center gap-4 mb-5">
                          <Skeleton className="h-20 w-20" />
                          <Skeleton className="h-20 w-20" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : matches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  Nenhuma partida criada para esta rodada
                </p>
                <Button onClick={createMatches}>
                  Criar Partidas
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Desktop: Tabela otimizada */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-primary/20">
                        <th className="text-left p-4 text-primary font-bold">
                          <div className="flex items-center gap-2">
                            <Clock size={18} />
                            Horário
                          </div>
                        </th>
                        <th className="text-left p-4 text-primary font-bold">Partida</th>
                        <th className="text-center p-4 text-primary font-bold">Status</th>
                        <th className="text-center p-4 text-primary font-bold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((match) => (
                        <tr 
                          key={match.id} 
                          className="border-b border-border hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-base font-medium">
                              <Clock size={16} className="text-muted-foreground" />
                              {match.scheduled_time.substring(0, 5)}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Badge className={`${teamColors[match.team_home]} text-sm px-3 py-1`}>
                                {teamNames[match.team_home]}
                              </Badge>
                              <span className="text-2xl font-bold text-primary">{match.score_home}</span>
                              <span className="text-muted-foreground text-xl">×</span>
                              <span className="text-2xl font-bold text-primary">{match.score_away}</span>
                              <Badge className={`${teamColors[match.team_away]} text-sm px-3 py-1`}>
                                {teamNames[match.team_away]}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <Badge 
                              className={`${
                                match.status === 'not_started' ? 'bg-gray-600 text-white' :
                                match.status === 'in_progress' ? 'bg-yellow-600 text-white' :
                                'bg-green-600 text-white'
                              } gap-1 text-sm px-3 py-1`}
                            >
                              {match.status === 'not_started' && <Clock size={14} />}
                              {match.status === 'in_progress' && <PlayCircle size={14} />}
                              {match.status === 'finished' && <CheckCircle size={14} />}
                              {match.status === 'not_started' ? 'A Iniciar' : 
                               match.status === 'in_progress' ? 'Ao Vivo' : 'Encerrado'}
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex gap-2 justify-center">
                              {match.status === 'not_started' && (
                                <Button
                                  size="sm"
                                  onClick={() => startMatch(match.id)}
                                  variant="default"
                                  className="min-w-[100px] gap-2"
                                >
                                  <PlayCircle size={16} />
                                  Iniciar
                                </Button>
                              )}
                              
                              {match.status === 'in_progress' && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => openMatchPage(match)}
                                  className="min-w-[100px] gap-2"
                                >
                                  <PlayCircle size={16} />
                                  Gerenciar
                                </Button>
                              )}
                              
                              {match.status === 'finished' && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleEditMatch(match.id)}
                                  className="min-w-[100px] gap-2"
                                >
                                  <Edit3 size={16} />
                                  Editar
                                </Button>
                              )}
                              
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteConfirmMatch(match)}
                                className="min-w-[100px] gap-2"
                              >
                                <Trash2 size={16} />
                                Excluir
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: Cards otimizados */}
                <div className="md:hidden space-y-4">
                  {matches.map((match) => (
                    <Card 
                      key={match.id} 
                      className="bg-muted/10 border-border hover:shadow-lg hover:shadow-primary/20 transition-all"
                    >
                      <CardContent className="p-5">
                        {/* Header: Horário e Status */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                            <Clock size={16} />
                            {match.scheduled_time.substring(0, 5)}
                          </div>
                          <Badge 
                            className={`${
                              match.status === 'not_started' ? 'bg-gray-600 text-white' :
                              match.status === 'in_progress' ? 'bg-yellow-600 text-white' :
                              'bg-green-600 text-white'
                            } gap-1`}
                          >
                            {match.status === 'not_started' && <Clock size={14} />}
                            {match.status === 'in_progress' && <PlayCircle size={14} />}
                            {match.status === 'finished' && <CheckCircle size={14} />}
                            {match.status === 'not_started' ? 'A Iniciar' : 
                             match.status === 'in_progress' ? 'Ao Vivo' : 'Encerrado'}
                          </Badge>
                        </div>
                        
                        {/* Placar central com animação */}
                        <div className="flex items-center justify-center gap-4 mb-5 py-4 bg-background/50 rounded-lg">
                          <div className="text-center flex-1">
                            <Badge className={`${teamColors[match.team_home]} mb-2 text-sm px-3 py-1`}>
                              {teamNames[match.team_home]}
                            </Badge>
                            <div className="text-4xl font-bold text-primary">{match.score_home}</div>
                          </div>
                          
                          <div className="text-2xl text-muted-foreground font-light">×</div>
                          
                          <div className="text-center flex-1">
                            <Badge className={`${teamColors[match.team_away]} mb-2 text-sm px-3 py-1`}>
                              {teamNames[match.team_away]}
                            </Badge>
                            <div className="text-4xl font-bold text-primary">{match.score_away}</div>
                          </div>
                        </div>
                        
                        {/* Botões de ação */}
                        <div className="grid grid-cols-2 gap-2">
                          {match.status === 'not_started' && (
                            <>
                              <Button
                                onClick={() => startMatch(match.id)}
                                variant="default"
                                className="min-h-[48px] gap-2 col-span-2"
                              >
                                <PlayCircle size={18} />
                                Iniciar Partida
                              </Button>
                            </>
                          )}
                          
                          {match.status === 'in_progress' && (
                            <Button
                              variant="default"
                              onClick={() => openMatchPage(match)}
                              className="min-h-[48px] gap-2 col-span-2"
                            >
                              <PlayCircle size={18} />
                              Gerenciar Ao Vivo
                            </Button>
                          )}
                          
                          {match.status === 'finished' && (
                            <Button
                              variant="secondary"
                              onClick={() => handleEditMatch(match.id)}
                              className="min-h-[48px] gap-2"
                            >
                              <Edit3 size={18} />
                              Editar
                            </Button>
                          )}
                          
                          <Button
                            variant="destructive"
                            onClick={() => setDeleteConfirmMatch(match)}
                            className="min-h-[48px] gap-2"
                          >
                            <Trash2 size={18} />
                            Excluir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Painel de Filtros de Eventos */}
        {matches.length > 0 && (
          <div className="mt-4">
            <EventsFilterPanel 
              roundId={roundId} 
              onEventClick={(matchId) => handleEditMatch(matchId)}
            />
          </div>
        )}
      </main>

      {/* Dialog de edição */}
      {editingMatchId && roundId && (
        <ManageMatchDialog
          matchId={editingMatchId}
          roundId={roundId}
          open={!!editingMatchId}
          onOpenChange={(open) => !open && setEditingMatchId(null)}
          onSaved={async () => {
            await loadRoundData();
            
            // Recalcular pontos se rodada estiver finalizada ou em andamento
            if (round && (round.status === 'finalizada' || round.status === 'em_andamento')) {
              await recalculateRoundPoints();
            }
          }}
        />
      )}

      {/* Confirmação de exclusão de partida */}
      <AlertDialog open={!!deleteConfirmMatch} onOpenChange={(open) => !open && setDeleteConfirmMatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Partida</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta partida?
              <br /><br />
              <strong>Gols, assistências e cartões também serão excluídos.</strong>
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

      {/* Confirmação de encerrar todas */}
      <AlertDialog open={finishAllConfirm} onOpenChange={setFinishAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar Todas as Partidas</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encerrar TODAS as partidas desta rodada?
              <br /><br />
              Esta ação irá finalizar todas as partidas que ainda não foram encerradas.
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

      {/* Confirmação de finalizar rodada */}
      <AlertDialog open={finalizeConfirm} onOpenChange={setFinalizeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Rodada</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja finalizar esta rodada?
              <br /><br />
              <strong>Isso irá recalcular todas as estatísticas e pontuações dos jogadores.</strong>
              <br /><br />
              Após finalizar, será necessário reabrir a rodada para fazer edições.
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
