import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface PlayerStat {
  player_id: string;
  player_name: string;
  position: string;
  goals: number;
}

export default function Statistics() {
  const [topScorers, setTopScorers] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin();
    loadStatistics();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      setIsAdmin(data?.role === "admin");
    }
  };

  const loadStatistics = async () => {
    try {
      const { data: players } = await supabase.from("players").select("*");

      if (!players) return;

      const statsPromises = players.map(async (player) => {
        const { data: goals } = await supabase
          .from("goals")
          .select("*")
          .eq("player_id", player.id)
          .eq("is_own_goal", false);

        return {
          player_id: player.id,
          player_name: player.name,
          position: player.position,
          goals: goals?.length || 0,
        };
      });

      const stats = await Promise.all(statsPromises);
      stats.sort((a, b) => b.goals - a.goals);
      setTopScorers(stats.slice(0, 10));
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPositionLabel = (position: string) => {
    const labels: Record<string, string> = {
      goleiro: "Goleiro",
      defensor: "Defensor",
      "meio-campista": "Meio-Campo",
      atacante: "Atacante",
    };
    return labels[position] || position;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text">
              ARTILHARIA
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : (
              <div className="space-y-4">
                {topScorers.map((player, index) => (
                  <div
                    key={player.player_id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <span className="text-2xl font-bold text-primary w-8">
                        {index + 1}
                      </span>
                      <Avatar className="h-12 w-12 border-2 border-primary">
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                          {player.player_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-bold text-foreground">
                          {player.player_name}
                        </div>
                        <Badge variant="outline" className="text-xs border-primary text-primary">
                          {getPositionLabel(player.position)}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-primary">{player.goals}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
