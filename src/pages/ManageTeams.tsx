import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
        .eq("status", "pending")
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

  const deleteRound = async (roundId: string) => {
    try {
      const { error } = await supabase
        .from("rounds")
        .delete()
        .eq("id", roundId);

      if (error) throw error;
      
      toast.success("Rodada excluída com sucesso!");
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
                <Button onClick={() => navigate("/admin/teams")}> 
                  Voltar para Times
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground text-center mb-4">
                  Selecione uma rodada para gerenciar os times
                </p>
                {rounds.map((round) => (
                  <Card key={round.id} className="bg-muted/20 border-border">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-primary">
                            Rodada {round.round_number}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(round.scheduled_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="destructive"
                            onClick={() => {
                              if (confirm("Tem certeza que deseja excluir esta rodada?")) {
                                deleteRound(round.id);
                              }
                            }}
                            className="flex-1 sm:flex-none"
                          >
                            Excluir
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => navigate(`/admin/round/${round.id}/edit`)}
                            className="flex-1 sm:flex-none"
                          >
                            Editar Times
                          </Button>
                          <Button 
                            onClick={() => navigate(`/admin/round/${round.id}/view`)}
                            className="flex-1 sm:flex-none"
                          >
                            Ver Times
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button onClick={() => navigate("/admin/teams")} variant="outline" className="w-full">
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