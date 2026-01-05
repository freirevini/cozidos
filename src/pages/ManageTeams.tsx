import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RefreshCw, Eye, Edit, Trash2, ArrowLeft, Download, Share2 } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { TeamLogo } from "@/components/match/TeamLogo";
import { ShareableTeamsView } from "@/components/teams";
import { toPng } from "html-to-image";

type TeamColor = "branco" | "preto" | "azul" | "laranja";

interface RoundWithTeams {
  id: string;
  round_number: number;
  scheduled_date: string;
  status: string;
  teamColors: TeamColor[];
}

interface TeamPlayer {
  id: string;
  player_id: string;
  team_color: string;
  profiles: {
    name: string;
    nickname: string | null;
    position: string | null;
    level: string | null;
  };
}

interface Match {
  id: string;
  match_number: number;
  team_home: TeamColor;
  team_away: TeamColor;
  scheduled_time: string;
}

export default function ManageTeams() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<RoundWithTeams[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [shareData, setShareData] = useState<{
    teamsByColor: Record<string, TeamPlayer[]>;
    matches: Match[];
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso não autorizado");
      navigate("/");
    } else {
      loadRoundsWithTeams();
    }
  }, [isAdmin, navigate]);

  const loadRoundsWithTeams = async () => {
    setLoading(true);
    try {
      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("*")
        .or("is_historical.is.null,is_historical.eq.false")
        .neq("round_number", 0)
        .order("scheduled_date", { ascending: false })
        .order("round_number", { ascending: false });

      if (roundsError) throw roundsError;

      const { data: teamsData, error: teamsError } = await supabase
        .from("round_teams")
        .select("round_id, team_color");

      if (teamsError) throw teamsError;

      const roundsWithTeams: RoundWithTeams[] = (roundsData || [])
        .map(round => {
          const teamColors = teamsData
            ?.filter(t => t.round_id === round.id)
            .map(t => t.team_color as TeamColor) || [];
          return {
            ...round,
            teamColors
          };
        })
        .filter(r => r.teamColors.length > 0);

      setRounds(roundsWithTeams);
    } catch (error) {
      console.error("Erro ao carregar rodadas:", error);
      toast.error("Erro ao carregar histórico de times");
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadRoundsWithTeams();
      toast.success("Dados atualizados!");
    },
    enabled: true,
  });

  const canEdit = (status: string) => status !== 'finalizada';
  const canDelete = (status: string) => status === 'a_iniciar';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'a_iniciar':
        return <Badge className="bg-muted text-muted-foreground">A Iniciar</Badge>;
      case 'em_andamento':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Em Andamento</Badge>;
      case 'finalizada':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Finalizada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const deleteRound = async (roundId: string, roundNumber: number) => {
    try {
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
      loadRoundsWithTeams();
    } catch (error: any) {
      console.error("Erro ao excluir rodada:", error);
      toast.error("Erro ao excluir rodada: " + error.message);
    }
  };

  const loadShareData = async (roundId: string) => {
    try {
      const [playersRes, matchesRes] = await Promise.all([
        supabase
          .from("round_team_players")
          .select(`
            id,
            player_id,
            team_color,
            profiles!inner (name, nickname, position, level)
          `)
          .eq("round_id", roundId),
        supabase
          .from("matches")
          .select("id, match_number, team_home, team_away, scheduled_time")
          .eq("round_id", roundId)
          .order("match_number", { ascending: true })
      ]);

      if (playersRes.error) throw playersRes.error;

      const teamsByColor = (playersRes.data || []).reduce((acc, player) => {
        if (!acc[player.team_color]) acc[player.team_color] = [];
        acc[player.team_color].push(player);
        return acc;
      }, {} as Record<string, TeamPlayer[]>);

      setShareData({
        teamsByColor,
        matches: (matchesRes.data as Match[]) || []
      });
      setSelectedRoundId(roundId);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados para compartilhar");
    }
  };

  const handleGenerateImage = async (round: RoundWithTeams) => {
    if (!shareRef.current) {
      await loadShareData(round.id);
      // Aguardar um tick para o componente renderizar
      setTimeout(() => generateImage(round), 100);
      return;
    }
    generateImage(round);
  };

  const generateImage = async (round: RoundWithTeams) => {
    if (!shareRef.current) return;

    setGenerating(true);
    try {
      const dataUrl = await toPng(shareRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#0a0a0a",
      });

      const link = document.createElement("a");
      link.download = `cozidos-rodada-${round.round_number}.png`;
      link.href = dataUrl;
      link.click();

      toast.success("Imagem gerada com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar imagem:", error);
      toast.error("Erro ao gerar imagem");
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short"
    });
  };

  const selectedRound = rounds.find(r => r.id === selectedRoundId);

  return (
    <div className="min-h-screen bg-background">
      {/* Pull to Refresh */}
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
      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/teams")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">
            Gerenciar Times
          </h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-border/30">
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : rounds.length === 0 ? (
          <Card className="bg-card/50 border-border/30">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Nenhum time gerado ainda
              </p>
              <Button onClick={() => navigate("/admin/teams/define")}>
                Definir Times
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rounds.map((round) => {
              const d = new Date(round.scheduled_date + "T00:00:00");
              const dateInfo = {
                day: d.getDate(),
                month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()
              };
              const statusConfig = {
                'a_iniciar': { label: 'Iniciar', color: 'bg-slate-500' },
                'em_andamento': { label: 'Ao Vivo', color: 'bg-amber-500' },
                'finalizada': { label: 'Fim', color: 'bg-emerald-500' }
              }[round.status] || { label: round.status, color: 'bg-gray-500' };

              return (
                <Card
                  key={round.id}
                  className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden rounded-xl"
                >
                  <div className="flex items-stretch">
                    {/* Date Column - Compact */}
                    <div className="flex flex-col items-center justify-center px-3 py-3 min-w-[56px] bg-muted/30">
                      <span className="text-xl font-bold text-foreground leading-none">{dateInfo.day}</span>
                      <span className="text-[10px] font-medium text-muted-foreground mt-0.5">{dateInfo.month}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-3">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base">R{round.round_number}</h3>
                          <Badge className={`text-[9px] px-1.5 py-0 ${statusConfig.color} text-white`}>
                            {statusConfig.label}
                          </Badge>
                        </div>
                        {/* Team logos */}
                        <div className="flex gap-1">
                          {round.teamColors.slice(0, 4).map((color) => (
                            <TeamLogo key={color} teamColor={color} size="sm" />
                          ))}
                        </div>
                      </div>

                      {/* Actions - Compact row */}
                      <div className="flex gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/round/${round.id}/view`)}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadShareData(round.id)}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          Enviar
                        </Button>

                        {canEdit(round.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admin/round/${round.id}/edit`)}
                            className="h-8 px-2.5 text-xs gap-1"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                        )}

                        {canDelete(round.status) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteRound(round.id, round.round_number)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal/View de compartilhamento */}
        {selectedRoundId && shareData && selectedRound && (
          <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
            <div className="container mx-auto px-4 py-6">
              <div className="flex items-center justify-between mb-6">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedRoundId(null);
                    setShareData(null);
                  }}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleGenerateImage(selectedRound)}
                    disabled={generating}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {generating ? "Gerando..." : "Baixar"}
                  </Button>
                </div>
              </div>

              <div className="max-w-lg mx-auto">
                <ShareableTeamsView
                  ref={shareRef}
                  roundNumber={selectedRound.round_number}
                  scheduledDate={selectedRound.scheduled_date}
                  teamsByColor={shareData.teamsByColor}
                  matches={shareData.matches}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
