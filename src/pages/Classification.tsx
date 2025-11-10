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
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PlayerStats {
  player_id: string;
  nickname: string;
  presencas: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  atrasos: number;
  faltas: number;
  punicoes: number;
  cartoes_amarelos: number;
  cartoes_vermelhos: number;
  gols: number;
  assistencias: number;
  pontos_totais: number;
}

export default function Classification() {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPlayer, setIsPlayer] = useState(false);
  const [showRules, setShowRules] = useState(false);

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
      // Fetch directly from player_rankings table
      const { data: rankings, error } = await supabase
        .from("player_rankings")
        .select("*")
        .order("pontos_totais", { ascending: false });

      if (error) {
        console.error("Erro ao carregar rankings:", error);
        return;
      }

      if (!rankings) {
        setStats([]);
        return;
      }

      // Map to PlayerStats interface
      const mappedStats: PlayerStats[] = rankings.map((rank) => ({
        player_id: rank.player_id,
        nickname: rank.nickname,
        presencas: rank.presencas,
        vitorias: rank.vitorias,
        empates: rank.empates,
        derrotas: rank.derrotas,
        atrasos: rank.atrasos,
        faltas: rank.faltas,
        punicoes: rank.punicoes,
        cartoes_amarelos: rank.cartoes_amarelos,
        cartoes_vermelhos: rank.cartoes_vermelhos,
        gols: rank.gols,
        assistencias: rank.assistencias,
        pontos_totais: rank.pontos_totais,
      }));

      setStats(mappedStats);
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
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-3xl font-bold text-primary glow-text text-center flex-1">
                CLASSIFICAÇÃO GERAL
              </CardTitle>
              <AlertDialog open={showRules} onOpenChange={setShowRules}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Info className="h-4 w-4" />
                    Pontuação
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-border max-w-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-primary text-2xl">
                      📊 Regras de Pontuação
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="text-foreground space-y-4 mt-4">
                        <div className="space-y-2">
                          <h3 className="font-bold text-lg text-primary">Pontos Positivos:</h3>
                          <ul className="space-y-1 ml-4">
                            <li>✅ <strong>Presença:</strong> +10 pontos (status: presente ou atrasado)</li>
                            <li>🏆 <strong>Vitória:</strong> +10 pontos</li>
                            <li>🤝 <strong>Empate:</strong> +5 pontos</li>
                            <li>⚽ <strong>Gol:</strong> +1 ponto</li>
                            <li>🎯 <strong>Assistência:</strong> +2 pontos</li>
                          </ul>
                        </div>
                        
                        <div className="space-y-2">
                          <h3 className="font-bold text-lg text-destructive">Pontos Negativos:</h3>
                          <ul className="space-y-1 ml-4">
                            <li>⏰ <strong>Atraso:</strong> -5 pontos</li>
                            <li>❌ <strong>Falta:</strong> -10 pontos</li>
                            <li>🟨 <strong>Cartão Amarelo:</strong> -1 ponto</li>
                            <li>🟥 <strong>Cartão Vermelho:</strong> -1 ponto</li>
                            <li>⚠️ <strong>Punições:</strong> pontos negativos variáveis</li>
                          </ul>
                        </div>

                        <div className="space-y-2">
                          <h3 className="font-bold text-lg text-muted-foreground">Observações:</h3>
                          <ul className="space-y-1 ml-4 text-sm">
                            <li>• Derrota não pontua (0 pontos)</li>
                            <li>• O total de pontos é a soma de todos os componentes</li>
                            <li>• Apenas jogadores aprovados são contabilizados</li>
                          </ul>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogAction className="bg-primary hover:bg-primary/90">
                      Entendido
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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
                      <TableHead className="text-primary font-bold text-center">Gols</TableHead>
                      <TableHead className="text-primary font-bold text-center">Assistências</TableHead>
                      <TableHead className="text-primary font-bold text-center">Atraso</TableHead>
                      <TableHead className="text-primary font-bold text-center">Falta</TableHead>
                      <TableHead className="text-primary font-bold text-center">Punição</TableHead>
                      <TableHead className="text-primary font-bold text-center">Cartões</TableHead>
                      <TableHead className="text-primary font-bold text-center">Total de Pontos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((stat, index) => (
                      <TableRow key={stat.player_id} className="border-border hover:bg-muted/30">
                        <TableCell className="font-bold text-primary">{index + 1}</TableCell>
                        <TableCell className="font-medium">{stat.nickname}</TableCell>
                        <TableCell className="text-center">{stat.presencas}</TableCell>
                        <TableCell className="text-center">{stat.vitorias}</TableCell>
                        <TableCell className="text-center">{stat.empates}</TableCell>
                        <TableCell className="text-center">{stat.derrotas}</TableCell>
                        <TableCell className="text-center">{stat.gols}</TableCell>
                        <TableCell className="text-center">{stat.assistencias}</TableCell>
                        <TableCell className="text-center">{stat.atrasos}</TableCell>
                        <TableCell className="text-center">{stat.faltas}</TableCell>
                        <TableCell className="text-center">{stat.punicoes}</TableCell>
                        <TableCell className="text-center">
                          {stat.cartoes_amarelos > 0 && `🟨 ${stat.cartoes_amarelos} `}
                          {stat.cartoes_vermelhos > 0 && `🟥 ${stat.cartoes_vermelhos}`}
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">
                          {stat.pontos_totais}
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
