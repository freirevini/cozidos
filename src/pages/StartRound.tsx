import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function StartRound() {
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

  useEffect(() => {
    if (isAdmin) {
      loadAvailableRounds();
    }
  }, [isAdmin]);

  const loadAvailableRounds = async () => {
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
      toast.error("Erro ao carregar rodadas disponíveis");
    } finally {
      setLoading(false);
    }
  };

  const startRound = (roundId: string) => {
    navigate(`/admin/round/manage?round=${roundId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text text-center">
              INICIAR RODADA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : rounds.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Nenhuma rodada disponível para iniciar
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Defina os times primeiro em "Times &gt; Definir Times"
                </p>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground text-center mb-4">
                  Selecione uma rodada para iniciar
                </p>
                {rounds.map((round) => (
                  <Button
                    key={round.id}
                    onClick={() => startRound(round.id)}
                    className="w-full bg-primary hover:bg-secondary text-primary-foreground font-bold text-lg py-6"
                  >
                    Rodada {round.round_number} - {new Date(round.scheduled_date).toLocaleDateString('pt-BR')}
                  </Button>
                ))}
              </>
            )}
            <Button
              onClick={() => navigate("/admin/round/manage")}
              variant="outline"
              className="w-full font-bold text-lg py-6"
            >
              Gerenciar Rodadas
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}