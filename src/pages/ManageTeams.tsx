import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RefreshCw, Eye, Edit, Trash2 } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

interface RoundWithTeams {
  id: string;
  round_number: number;
  scheduled_date: string;
  status: string;
  teamsCount: number;
}

export default function ManageTeams() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<RoundWithTeams[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso não autorizado");
      navigate("/");
    } else {
      loadRoundsWithTeams();
    }
  }, [isAdmin, navigate]);

  const loadRoundsWithTeams = async () => {
    setLoading(true);
    try {
      // Buscar todas as rodadas (sem filtro de status)
      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("*")
        .order("scheduled_date", { ascending: false })
        .order("round_number", { ascending: false });

      if (roundsError) throw roundsError;

      // Buscar contagem de times por rodada
      const { data: teamsData, error: teamsError } = await supabase
        .from("round_teams")
        .select("round_id, team_color");

      if (teamsError) throw teamsError;

      // Combinar dados - contar times por rodada
      const roundsWithTeams: RoundWithTeams[] = (roundsData || []).map(round => {
        const teamsCount = teamsData?.filter(t => t.round_id === round.id).length || 0;
        return {
          ...round,
          teamsCount
        };
      });

      // Filtrar apenas rodadas que têm times gerados
      const roundsWithGeneratedTeams = roundsWithTeams.filter(r => r.teamsCount > 0);
      
      setRounds(roundsWithGeneratedTeams);
    } catch (error) {
      console.error("Erro ao carregar rodadas:", error);
      toast.error("Erro ao carregar histórico de times");
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadRoundsWithTeams();
      toast.success("Dados atualizados!");
    },
    enabled: true,
  });

  const canEdit = (status: string) => status !== 'finalizada';
  const canDelete = (status: string) => status === 'a_iniciar';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'a_iniciar':
        return <Badge className="bg-gray-600 text-white hover:bg-gray-600">A Iniciar</Badge>;
      case 'em_andamento':
        return <Badge className="bg-yellow-600 text-white hover:bg-yellow-600">Em Andamento</Badge>;
      case 'finalizada':
        return <Badge className="bg-green-600 text-white hover:bg-green-600">Finalizada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const deleteRound = async (roundId: string, roundNumber: number) => {
    try {
      // Verificar quantos registros serão afetados
      const { count: teamPlayersCount } = await supabase
        .from("round_team_players")
        .select("*", { count: 'exact', head: true })
        .eq("round_id", roundId);

      const { count: matchesCount } = await supabase
        .from("matches")
        .select("*", { count: 'exact', head: true })
        .eq("round_id", roundId);

      const confirmed = window.confirm(
        `⚠️ ATENÇÃO: Esta ação irá excluir permanentemente:\n\n` +
        `• Rodada ${roundNumber}\n` +
        `• ${teamPlayersCount || 0} registros de jogadores nos times\n` +
        `• ${matchesCount || 0} partidas associadas\n` +
        `• Dados de presença dos jogadores\n\n` +
        `Os perfis dos jogadores não serão afetados.\n\n` +
        `Deseja continuar?`
      );

      if (!confirmed) return;

      const { error } = await supabase
        .from("rounds")
        .delete()
        .eq("id", roundId);

      if (error) throw error;
      
      toast.success("Rodada e dados associados excluídos com sucesso!");
      loadRoundsWithTeams();
    } catch (error: any) {
      console.error("Erro ao excluir rodada:", error);
      toast.error("Erro ao excluir rodada: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Pull to Refresh Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 transition-all"
          style={{ 
            transform: `translateY(${Math.min(pullDistance, 60)}px)`,
            opacity: Math.min(pullDistance / 60, 1)
          }}
        >
          <div className="bg-primary/90 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">
              {isRefreshing ? 'Atualizando...' : 'Solte para atualizar'}
            </span>
          </div>
        </div>
      )}

      <Header />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text text-center">
              GERENCIAR TIMES
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-5 w-32" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : rounds.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  Nenhum time gerado ainda
                </p>
                <Button onClick={() => navigate("/admin/teams")} variant="outline"> 
                  Voltar para Times
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Desktop: Tabela */}
                <div className="hidden md:block overflow-x-auto scrollbar-hide scroll-smooth">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Data</TableHead>
                        <TableHead>Times</TableHead>
                        <TableHead>Rodada</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rounds.map((round) => (
                        <TableRow key={round.id} className="border-border hover:bg-muted/30">
                          <TableCell>
                            {new Date(round.scheduled_date).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <span className="text-primary font-medium">{round.teamsCount} times</span>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="link" 
                              className="p-0 h-auto text-primary"
                              onClick={() => navigate(`/admin/round/manage?round=${round.id}`)}
                            >
                              Rodada {round.round_number}
                            </Button>
                          </TableCell>
                          <TableCell>{getStatusBadge(round.status)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2 justify-center">
                              <Button 
                                onClick={() => navigate(`/admin/round/${round.id}/view`)}
                                variant="outline"
                                size="sm"
                                className="min-w-[90px]"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
                              </Button>
                              {canEdit(round.status) && (
                                <Button 
                                  onClick={() => navigate(`/admin/round/${round.id}/edit`)}
                                  variant="outline"
                                  size="sm"
                                  className="min-w-[90px]"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                              )}
                              {canDelete(round.status) && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteRound(round.id, round.round_number)}
                                  className="min-w-[90px]"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Excluir
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile: Cards */}
                <div className="md:hidden space-y-3">
                  {rounds.map((round) => (
                    <Card key={round.id} className="border-border">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Rodada {round.round_number}</p>
                            <p className="font-medium">
                              {new Date(round.scheduled_date).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-sm text-primary font-medium mt-1">
                              {round.teamsCount} times
                            </p>
                          </div>
                          {getStatusBadge(round.status)}
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <Button 
                            onClick={() => navigate(`/admin/round/${round.id}/view`)}
                            variant="outline"
                            className="w-full min-h-[44px]"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Times
                          </Button>
                          {canEdit(round.status) && (
                            <Button 
                              onClick={() => navigate(`/admin/round/${round.id}/edit`)}
                              variant="outline"
                              className="w-full min-h-[44px]"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar Times
                            </Button>
                          )}
                          {canDelete(round.status) && (
                            <Button
                              variant="destructive"
                              className="w-full min-h-[44px]"
                              onClick={() => deleteRound(round.id, round.round_number)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button 
                  onClick={() => navigate("/admin/teams")} 
                  variant="outline" 
                  className="w-full mt-4 min-h-[44px]"
                >
                  Voltar para Times
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
