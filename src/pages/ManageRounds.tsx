import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";


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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roundId = searchParams.get("round");
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState<Round | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    checkAdmin();
    if (roundId) {
      loadRoundData();
    }
  }, [roundId]);

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

  const finalizeRound = async () => {
    if (!roundId || !round) return;

    // Verificar se todas as partidas foram finalizadas
    const unfinishedMatches = matches.filter(m => m.status !== 'finished');
    if (unfinishedMatches.length > 0) {
      toast.error(`Ainda há ${unfinishedMatches.length} partida(s) não finalizada(s)`);
      return;
    }

    if (!confirm("Tem certeza que deseja finalizar esta rodada?")) {
      return;
    }

    setLoading(true);

    try {
      // Atualizar status da rodada
      const { error: updateError } = await supabase
        .from("rounds")
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq("id", roundId);

      if (updateError) throw updateError;

      toast.success("Rodada finalizada com sucesso!");
      navigate("/admin/round");
    } catch (error: any) {
      console.error("Erro ao finalizar rodada:", error);
      toast.error("Erro ao finalizar rodada: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openMatchPage = (match: Match) => {
    navigate(`/admin/match/${match.id}/${roundId}`);
  };

  if (!roundId) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAdmin={isAdmin} />
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
      <Header isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm("Tem certeza que deseja voltar? Alterações não salvas serão perdidas.")) {
                    navigate("/admin/round");
                  }
                }}
              >
                <ArrowLeft size={24} />
              </Button>
              <CardTitle className="text-3xl font-bold text-primary glow-text text-center flex-1">
                {round ? `RODADA ${round.round_number}` : "GERENCIAR RODADA"}
                <div className="text-sm text-muted-foreground mt-1">
                  {round && new Date(round.scheduled_date).toLocaleDateString('pt-BR')}
                </div>
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={showAttendanceDialog}
                  disabled={loading || matches.some(m => m.status !== 'finished')}
                  variant="secondary"
                >
                  Registrar Atrasos/Faltas
                </Button>
                <Button
                  onClick={finalizeRound}
                  disabled={loading || matches.some(m => m.status !== 'finished')}
                >
                  Finalizar Rodada
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-primary font-bold">Horário</th>
                        <th className="text-left p-3 text-primary font-bold">Partida</th>
                        <th className="text-center p-3 text-primary font-bold">Status</th>
                        <th className="text-center p-3 text-primary font-bold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((match) => (
                        <tr key={match.id} className="border-b border-border hover:bg-muted/30">
                          <td className="p-3">{match.scheduled_time.substring(0, 5)}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Badge className={teamColors[match.team_home]}>
                                {teamNames[match.team_home]}
                              </Badge>
                              <span className="text-xl font-bold">{match.score_home}</span>
                              <span className="text-muted-foreground">×</span>
                              <span className="text-xl font-bold">{match.score_away}</span>
                              <Badge className={teamColors[match.team_away]}>
                                {teamNames[match.team_away]}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Badge 
                              className={
                                match.status === 'not_started' ? 'bg-red-600 text-white' :
                                match.status === 'in_progress' ? 'bg-yellow-700 text-white' :
                                'bg-green-600 text-white'
                              }
                            >
                              {match.status === 'not_started' ? 'Não Iniciado' : 
                               match.status === 'in_progress' ? 'Em Andamento' : 'Encerrado'}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              size="sm"
                              onClick={() => openMatchPage(match)}
                            >
                              {match.status === 'finished' ? 'Ver Partida' : 'Gerenciar'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

    </div>
  );
}
