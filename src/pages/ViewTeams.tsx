import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TeamsCarousel, TeamDetailModal, ShareableTeamsView } from "@/components/teams";
import { ArrowLeft, Download, Share2, Image } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";

type TeamColor = "branco" | "vermelho" | "azul" | "laranja";

interface Round {
  id: string;
  round_number: number;
  scheduled_date: string | null;
  status: string;
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

export default function ViewTeams() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<TeamColor | null>(null);
  const [showShareView, setShowShareView] = useState(false);
  const [generating, setGenerating] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadRounds();
  }, []);

  useEffect(() => {
    if (selectedRound) {
      loadTeamPlayers();
      loadMatches();
    }
  }, [selectedRound]);

  const loadRounds = async () => {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select("*")
        .order("round_number", { ascending: false });

      if (error) throw error;

      setRounds(data || []);
      if (data && data.length > 0) {
        setSelectedRound(data[0].id);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar rodadas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTeamPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from("round_team_players")
        .select(`
          id,
          player_id,
          team_color,
          profiles!inner (
            name,
            nickname,
            position,
            level
          )
        `)
        .eq("round_id", selectedRound);

      if (error) throw error;
      setTeamPlayers(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar times",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadMatches = async () => {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("id, match_number, team_home, team_away, scheduled_time")
        .eq("round_id", selectedRound)
        .order("match_number", { ascending: true });

      if (error) throw error;
      setMatches((data as Match[]) || []);
    } catch (error: any) {
      console.error("Erro ao carregar partidas:", error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("pt-BR");
  };

  const selectedRoundData = rounds.find((r) => r.id === selectedRound);

  const teamsByColor = teamPlayers.reduce((acc, player) => {
    if (!acc[player.team_color]) {
      acc[player.team_color] = [];
    }
    acc[player.team_color].push(player);
    return acc;
  }, {} as Record<string, TeamPlayer[]>);

  const handleGenerateImage = async () => {
    if (!shareRef.current) return;
    
    setGenerating(true);
    try {
      const dataUrl = await toPng(shareRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#0a0a0a",
      });
      
      // Criar link para download
      const link = document.createElement("a");
      link.download = `cozidos-rodada-${selectedRoundData?.round_number || "times"}.png`;
      link.href = dataUrl;
      link.click();
      
      toast({
        title: "Imagem gerada!",
        description: "A imagem foi baixada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao gerar imagem:", error);
      toast({
        title: "Erro ao gerar imagem",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!shareRef.current) return;
    
    setGenerating(true);
    try {
      const dataUrl = await toPng(shareRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#0a0a0a",
      });
      
      // Converter dataUrl para blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `cozidos-rodada-${selectedRoundData?.round_number}.png`, { type: "image/png" });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Cozidos FC - Rodada ${selectedRoundData?.round_number}`,
          text: `Confira os times da Rodada ${selectedRoundData?.round_number}!`,
        });
      } else {
        // Fallback: baixar a imagem
        handleGenerateImage();
      }
    } catch (error) {
      console.error("Erro ao compartilhar:", error);
      // Fallback: baixar a imagem
      handleGenerateImage();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        {/* Header com botão voltar */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">
            Times
          </h1>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-muted/30 rounded-lg max-w-xs mx-auto" />
              <div className="h-64 bg-muted/30 rounded-2xl" />
            </div>
          </div>
        ) : rounds.length === 0 ? (
          <Card className="bg-card/50 border-border/30">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhuma rodada disponível
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Seletor de rodada */}
            <div className="max-w-sm">
              <Select value={selectedRound} onValueChange={setSelectedRound}>
                <SelectTrigger className="h-12 text-base bg-card/50 border-border/30">
                  <SelectValue placeholder="Selecione uma rodada" />
                </SelectTrigger>
                <SelectContent>
                  {rounds.map((round) => (
                    <SelectItem key={round.id} value={round.id}>
                      Rodada {round.round_number} - {formatDate(round.scheduled_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info da rodada */}
            {selectedRoundData && (
              <div className="text-center py-2">
                <h2 className="text-xl font-bold text-foreground">
                  Rodada {selectedRoundData.round_number}
                </h2>
                <p className="text-muted-foreground">
                  {formatDate(selectedRoundData.scheduled_date)}
                </p>
              </div>
            )}

            {/* Times */}
            {Object.keys(teamsByColor).length === 0 ? (
              <Card className="bg-card/50 border-border/30">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    Times ainda não foram definidos para esta rodada
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Carrossel/Grid de times */}
                <TeamsCarousel
                  teamsByColor={teamsByColor}
                  onTeamClick={(color) => setSelectedTeam(color)}
                />

                {/* Botões de ação */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    onClick={() => setShowShareView(!showShareView)}
                    variant="outline"
                    className="flex-1 h-12 gap-2"
                  >
                    <Image className="h-5 w-5" />
                    {showShareView ? "Ocultar Preview" : "Ver para Compartilhar"}
                  </Button>
                  
                  {showShareView && (
                    <>
                      <Button
                        onClick={handleGenerateImage}
                        disabled={generating}
                        className="flex-1 h-12 gap-2"
                      >
                        <Download className="h-5 w-5" />
                        {generating ? "Gerando..." : "Baixar Imagem"}
                      </Button>
                      
                      <Button
                        onClick={handleShare}
                        disabled={generating}
                        variant="secondary"
                        className="flex-1 h-12 gap-2"
                      >
                        <Share2 className="h-5 w-5" />
                        Compartilhar
                      </Button>
                    </>
                  )}
                </div>

                {/* View compartilhável */}
                {showShareView && selectedRoundData && (
                  <div className="mt-6">
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      Preview da imagem para compartilhar:
                    </p>
                    <div className="border border-border/30 rounded-2xl overflow-hidden">
                      <ShareableTeamsView
                        ref={shareRef}
                        roundNumber={selectedRoundData.round_number}
                        scheduledDate={selectedRoundData.scheduled_date || ""}
                        teamsByColor={teamsByColor}
                        matches={matches}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Modal de detalhes do time */}
        <TeamDetailModal
          open={!!selectedTeam}
          onOpenChange={(open) => !open && setSelectedTeam(null)}
          teamColor={selectedTeam}
          players={selectedTeam ? teamsByColor[selectedTeam] || [] : []}
        />
      </main>
    </div>
  );
}
