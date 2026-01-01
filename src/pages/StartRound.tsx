import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

export default function StartRound() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso não autorizado");
      navigate("/");
    } else {
      loadAvailableRounds();
    }
  }, [isAdmin, navigate]);

  const loadAvailableRounds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select("*")
        .or("is_historical.is.null,is_historical.eq.false")
        .neq("round_number", 0)
        .order("round_number", { ascending: false });

      if (error) throw error;
      setRounds(data || []);
    } catch (error) {
      console.error("Erro ao carregar rodadas:", error);
      toast.error("Erro ao carregar rodadas disponíveis");
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadAvailableRounds();
      toast.success("Rodadas atualizadas!");
    },
    enabled: true,
  });

  const startRound = async (roundId: string) => {
    try {
      const { error } = await supabase
        .from("rounds")
        .update({ status: 'em_andamento' })
        .eq("id", roundId);

      if (error) throw error;

      toast.success("Rodada iniciada com sucesso!");
      loadAvailableRounds();
    } catch (error: any) {
      console.error("Erro ao iniciar rodada:", error);
      toast.error("Erro ao iniciar rodada: " + error.message);
    }
  };

  const manageRound = (roundId: string) => {
    navigate(`/admin/round/manage?round=${roundId}`);
  };

  const editRound = (roundId: string) => {
    navigate(`/admin/round/manage?round=${roundId}`);
  };

  const formatDate = (date: string) => {
    return new Date(date + "T00:00:00").toLocaleDateString('pt-BR');
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'a_iniciar': return 'A Iniciar';
      case 'em_andamento': return 'Em Andamento';
      case 'finalizada': return 'Finalizada';
      default: return status;
    }
  };

  const deleteRound = async (roundId: string, roundNumber: number) => {
    if (!confirm(`Tem certeza que deseja excluir a Rodada ${roundNumber}?

Esta ação irá:
• Excluir todas as partidas desta rodada
• Remover gols, assistências e cartões registrados
• Recalcular automaticamente a classificação geral

Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("rounds")
        .delete()
        .eq("id", roundId);

      if (error) throw error;

      toast.success("Rodada excluída e classificação recalculada com sucesso!");
      loadAvailableRounds();
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
        <Card className="card-glow bg-card border-border max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text text-center">
              GERENCIAR RODADAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : rounds.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Nenhuma rodada disponível
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Defina os times primeiro em "Times &gt; Definir Times"
                </p>
              </div>
            ) : (
              <>
                {/* Desktop: Tabela */}
                <div className="hidden md:block overflow-x-auto scroll-smooth">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Rodada</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rounds.map((round) => (
                        <TableRow key={round.id}>
                          <TableCell>{formatDate(round.scheduled_date)}</TableCell>
                          <TableCell>{round.round_number}</TableCell>
                          <TableCell>
                            <Badge
                              className={`${round.status === 'a_iniciar' ? 'bg-gray-600 hover:bg-gray-600' :
                                round.status === 'em_andamento' ? 'bg-yellow-600 hover:bg-yellow-600' :
                                  'bg-green-600 hover:bg-green-600'
                                } text-white`}
                            >
                              {getStatusLabel(round.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 justify-center">
                              {round.status === 'a_iniciar' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => startRound(round.id)}
                                    variant="default"
                                    className="min-w-[80px]"
                                  >
                                    Iniciar
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => deleteRound(round.id, round.round_number)}
                                    variant="destructive"
                                    className="min-w-[80px]"
                                  >
                                    Excluir
                                  </Button>
                                </>
                              )}
                              {round.status === 'em_andamento' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => manageRound(round.id)}
                                    variant="default"
                                    className="min-w-[80px]"
                                  >
                                    Gerenciar
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => deleteRound(round.id, round.round_number)}
                                    variant="destructive"
                                    className="min-w-[80px]"
                                  >
                                    Excluir
                                  </Button>
                                </>
                              )}
                              {round.status === 'finalizada' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => editRound(round.id)}
                                    variant="default"
                                    className="min-w-[80px]"
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => deleteRound(round.id, round.round_number)}
                                    variant="destructive"
                                    className="min-w-[80px]"
                                  >
                                    Excluir
                                  </Button>
                                </>
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
                  {loading ? (
                    // Skeleton Loading
                    Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i} className="border-border">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center mb-2">
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-5 w-32" />
                            </div>
                            <Skeleton className="h-6 w-24" />
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Skeleton className="h-11 flex-1" />
                            <Skeleton className="h-11 flex-1" />
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    rounds.map((round) => (
                      <Card key={round.id} className="border-border">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center mb-2">
                            <div>
                              <p className="text-sm text-muted-foreground">Rodada {round.round_number}</p>
                              <p className="font-medium">{formatDate(round.scheduled_date)}</p>
                            </div>
                            <Badge
                              className={`${round.status === 'a_iniciar' ? 'bg-gray-600 hover:bg-gray-600' :
                                round.status === 'em_andamento' ? 'bg-yellow-600 hover:bg-yellow-600' :
                                  'bg-green-600 hover:bg-green-600'
                                } text-white`}
                            >
                              {getStatusLabel(round.status)}
                            </Badge>
                          </div>
                          <div className="flex gap-2 mt-3">
                            {round.status === 'a_iniciar' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => startRound(round.id)}
                                  variant="default"
                                  className="flex-1 min-h-[44px]"
                                >
                                  Iniciar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => deleteRound(round.id, round.round_number)}
                                  variant="destructive"
                                  className="flex-1 min-h-[44px]"
                                >
                                  Excluir
                                </Button>
                              </>
                            )}
                            {round.status === 'em_andamento' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => manageRound(round.id)}
                                  variant="default"
                                  className="flex-1 min-h-[44px]"
                                >
                                  Gerenciar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => deleteRound(round.id, round.round_number)}
                                  variant="destructive"
                                  className="flex-1 min-h-[44px]"
                                >
                                  Excluir
                                </Button>
                              </>
                            )}
                            {round.status === 'finalizada' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => editRound(round.id)}
                                  variant="default"
                                  className="flex-1 min-h-[44px]"
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => deleteRound(round.id, round.round_number)}
                                  variant="destructive"
                                  className="flex-1 min-h-[44px]"
                                >
                                  Excluir
                                </Button>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}