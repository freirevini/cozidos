import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function ManageTeams() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

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

  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      loadPendingRounds();
    }
  }, [isAdmin]);

  const loadPendingRounds = async () => {
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
      <Header isAdmin={isAdmin} />
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
                <div className="overflow-x-auto scrollbar-hide">
                  <div className="min-w-[700px]">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="p-4 text-left font-semibold text-foreground">Data</th>
                          <th className="p-4 text-left font-semibold text-foreground">Rodada</th>
                          <th className="p-4 text-center font-semibold text-foreground">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rounds.map((round, index) => (
                          <tr 
                            key={round.id}
                            className={`border-b border-border transition-colors hover:bg-muted/30 ${
                              index % 2 === 0 ? 'bg-muted/10' : ''
                            }`}
                          >
                            <td className="p-4 text-foreground">
                              {new Date(round.scheduled_date).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-4 font-bold text-primary">
                              Rodada {round.round_number}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-2 justify-center">
                                <Button 
                                  onClick={() => navigate(`/admin/round/${round.id}/view`)}
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 sm:flex-none min-w-[100px]"
                                >
                                  Ver Times
                                </Button>
                                <Button 
                                  onClick={() => navigate(`/admin/round/${round.id}/edit`)}
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 sm:flex-none min-w-[100px]"
                                >
                                  Editar Times
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteRound(round.id, round.round_number)}
                                  className="flex-1 sm:flex-none min-w-[100px]"
                                >
                                  Excluir
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <Button onClick={() => navigate("/admin/teams")} variant="outline" className="w-full mt-4">
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