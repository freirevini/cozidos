import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

export default function ManageTeams() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso não autorizado");
      navigate("/");
    } else {
      loadPendingRounds();
    }
  }, [isAdmin, navigate]);

  const loadPendingRounds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select("*")
        .eq("status", "a_iniciar")
        .order("scheduled_date", { ascending: false })
        .order("round_number", { ascending: false });

      if (error) throw error;
      setRounds(data || []);
    } catch (error) {
      console.error("Erro ao carregar rodadas:", error);
      toast.error("Erro ao carregar rodadas pendentes");
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadPendingRounds();
      toast.success("Times atualizados!");
    },
    enabled: true,
  });

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
      loadPendingRounds();
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
              <div className="text-center py-8">Carregando...</div>
            ) : rounds.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  Nenhuma rodada pendente encontrada
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
                        <TableHead>Rodada</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rounds.map((round) => (
                        <TableRow key={round.id} className="border-border hover:bg-muted/30">
                          <TableCell>{new Date(round.scheduled_date).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell className="font-bold text-primary">Rodada {round.round_number}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2 justify-center">
                              <Button 
                                onClick={() => navigate(`/admin/round/${round.id}/view`)}
                                variant="outline"
                                size="sm"
                                className="min-w-[100px]"
                              >
                                Ver Times
                              </Button>
                              <Button 
                                onClick={() => navigate(`/admin/round/${round.id}/edit`)}
                                variant="outline"
                                size="sm"
                                className="min-w-[100px]"
                              >
                                Editar Times
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteRound(round.id, round.round_number)}
                                className="min-w-[100px]"
                              >
                                Excluir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile: Cards */}
                <div className="md:hidden space-y-3">
                  {loading ? (
                    // Skeleton Loading
                    Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i} className="border-border">
                        <CardContent className="p-4">
                          <div className="mb-3 space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-5 w-32" />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Skeleton className="h-11 w-full" />
                            <Skeleton className="h-11 w-full" />
                            <Skeleton className="h-11 w-full" />
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    rounds.map((round) => (
                    <Card key={round.id} className="border-border">
                      <CardContent className="p-4">
                        <div className="mb-3">
                          <p className="text-sm text-muted-foreground">Rodada {round.round_number}</p>
                          <p className="font-medium">{new Date(round.scheduled_date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button 
                            onClick={() => navigate(`/admin/round/${round.id}/view`)}
                            variant="outline"
                            size="sm"
                            className="w-full min-h-[44px]"
                          >
                            Ver Times
                          </Button>
                          <Button 
                            onClick={() => navigate(`/admin/round/${round.id}/edit`)}
                            variant="outline"
                            size="sm"
                            className="w-full min-h-[44px]"
                          >
                            Editar Times
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteRound(round.id, round.round_number)}
                            className="w-full min-h-[44px]"
                          >
                            Excluir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    ))
                  )}
                </div>
                <Button onClick={() => navigate("/admin/teams")} variant="outline" className="w-full mt-4 min-h-[44px]">
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