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
            <Button
              onClick={() => toast.info("Funcionalidade em desenvolvimento")}
              className="w-full bg-primary hover:bg-secondary text-primary-foreground font-bold text-lg py-6"
            >
              Nova Rodada
            </Button>
            <Button
              onClick={() => navigate("/admin/round/manage")}
              className="w-full bg-secondary hover:bg-primary text-primary-foreground font-bold text-lg py-6"
            >
              Gerenciar Rodadas
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}