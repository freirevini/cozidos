import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PlayerStats {
  player_id: string;
  player_name: string;
  presenca: number;
  vitoria: number;
  empate: number;
  derrota: number;
  atraso: number;
  falta: number;
  punicao: number;
  cartoes_amarelos: number;
  cartoes_vermelhos: number;
  cartao_pontos: number;
  gols: number;
  total_pontos: number;
}

export default function Classification() {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPlayer, setIsPlayer] = useState(false);

  useEffect(() => {
    checkAdmin();
    loadStats();
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

      // Verificar se é jogador
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_player")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsPlayer(profile?.is_player || false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: players } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_player", true)
        .eq("is_approved", true)
        .order("nickname");

      if (!players) return;

      const statsPromises = players.map(async (player) => {
        // Presenças (apenas de rodadas completas)
        const { data: attendance } = await supabase
          .from("player_attendance")
          .select(`
            status,
            rounds!inner(status)
          `)
          .eq("player_id", player.id)
          .eq("rounds.status", "finalizada");

        const presenca = attendance?.filter((a) => a.status === "presente").length || 0;
        const atraso = attendance?.filter((a) => a.status === "atrasado").length || 0;
        const falta = attendance?.filter((a) => a.status === "falta").length || 0;

        // Buscar todas as partidas do jogador em rodadas finalizadas
        const { data: playerMatches } = await supabase
          .from("round_team_players")
          .select(`
            round_id, 
            team_color,
            rounds!inner(status)
          `)
          .eq("player_id", player.id)
          .eq("rounds.status", "finalizada");

        let vitoria = 0;
        let empate = 0;
        let derrota = 0;

        if (playerMatches) {
          for (const pm of playerMatches) {
            const { data: matches } = await supabase
              .from("matches")
              .select("*")
              .eq("round_id", pm.round_id)
              .eq("status", "finished")
              .or(`team_home.eq.${pm.team_color},team_away.eq.${pm.team_color}`);

            if (matches) {
              for (const match of matches) {
                const isHome = match.team_home === pm.team_color;
                const teamScore = isHome ? match.score_home : match.score_away;
                const opponentScore = isHome ? match.score_away : match.score_home;

                if (teamScore > opponentScore) {
                  vitoria++;
                } else if (teamScore === opponentScore) {
                  empate++;
                } else {
                  derrota++;
                }
              }
            }
          }
        }

        // Cartões (apenas de rodadas finalizadas)
        const { data: cards } = await supabase
          .from("cards")
          .select(`
            card_type,
            matches!inner(
              round_id,
              rounds!inner(status)
            )
          `)
          .eq("player_id", player.id)
          .eq("matches.rounds.status", "finalizada");

        const cartoes_amarelos = cards?.filter((c) => c.card_type === "amarelo").length || 0;
        const cartoes_vermelhos = cards?.filter((c) => c.card_type === "vermelho").length || 0;
        const cartao_pontos = (cartoes_amarelos * -1) + (cartoes_vermelhos * -2);

        // Gols (apenas de rodadas finalizadas)
        const { data: goals } = await supabase
          .from("goals")
          .select(`
            *,
            matches!inner(
              round_id,
              rounds!inner(status)
            )
          `)
          .eq("player_id", player.id)
          .eq("is_own_goal", false)
          .eq("matches.rounds.status", "finalizada");

        const gols = goals?.length || 0;

        // Punições (apenas de rodadas finalizadas)
        const { data: punishments } = await supabase
          .from("punishments")
          .select(`
            points,
            rounds!inner(status)
          `)
          .eq("player_id", player.id)
          .eq("rounds.status", "finalizada");

        const punicao = punishments?.reduce((sum, p) => sum + p.points, 0) || 0;

        // Calcular total de pontos
        const total_pontos =
          presenca * 3 +
          vitoria * 3 +
          empate * 1 +
          atraso * -5 +
          falta * -10 +
          punicao +
          cartao_pontos +
          gols * 1;

        return {
          player_id: player.id,
          player_name: player.nickname || player.name,
          presenca,
          vitoria,
          empate,
          derrota,
          atraso,
          falta,
          punicao,
          cartoes_amarelos,
          cartoes_vermelhos,
          cartao_pontos,
          gols,
          total_pontos,
        };
      });

      const calculatedStats = await Promise.all(statsPromises);
      calculatedStats.sort((a, b) => b.total_pontos - a.total_pontos);
      setStats(calculatedStats);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header isAdmin={isAdmin} isPlayer={isPlayer} />
      <main className="container mx-auto px-4 py-8 flex-1">
        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text text-center">
              CLASSIFICAÇÃO GERAL
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : (
              <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-muted/50">
                      <TableHead className="text-primary font-bold">Posição</TableHead>
                      <TableHead className="text-primary font-bold min-w-[120px]">Jogador</TableHead>
                      <TableHead className="text-primary font-bold text-center">Presença</TableHead>
                      <TableHead className="text-primary font-bold text-center">Vitória</TableHead>
                      <TableHead className="text-primary font-bold text-center">Empate</TableHead>
                      <TableHead className="text-primary font-bold text-center">Derrota</TableHead>
                      <TableHead className="text-primary font-bold text-center">Atraso</TableHead>
                      <TableHead className="text-primary font-bold text-center">Falta</TableHead>
                      <TableHead className="text-primary font-bold text-center">Punição</TableHead>
                      <TableHead className="text-primary font-bold text-center">Cartão Amarelo</TableHead>
                      <TableHead className="text-primary font-bold text-center">Cartão Vermelho</TableHead>
                      <TableHead className="text-primary font-bold text-center">Total de Pontos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((stat, index) => (
                      <TableRow key={stat.player_id} className="border-border hover:bg-muted/30">
                        <TableCell className="font-bold text-primary">{index + 1}</TableCell>
                        <TableCell className="font-medium">{stat.player_name}</TableCell>
                        <TableCell className="text-center">{stat.presenca}</TableCell>
                        <TableCell className="text-center">{stat.vitoria}</TableCell>
                        <TableCell className="text-center">{stat.empate}</TableCell>
                        <TableCell className="text-center">{stat.derrota}</TableCell>
                        <TableCell className="text-center">{stat.atraso}</TableCell>
                        <TableCell className="text-center">{stat.falta}</TableCell>
                        <TableCell className="text-center">{stat.punicao}</TableCell>
                        <TableCell className="text-center">{stat.cartoes_amarelos}</TableCell>
                        <TableCell className="text-center">{stat.cartoes_vermelhos}</TableCell>
                        <TableCell className="text-center font-bold text-primary">
                          {stat.total_pontos}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
