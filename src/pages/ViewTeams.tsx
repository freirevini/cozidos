import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TeamCardModern, ShareableTeamsView } from "@/components/teams";
import { ArrowLeft, Download, Share2, Eye, EyeOff, ChevronDown, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import teamBranco from "@/assets/team-branco.png";
import teamPreto from "@/assets/team-preto.png";
import teamAzul from "@/assets/team-azul.png";
import teamLaranja from "@/assets/team-laranja.png";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type TeamColor = "branco" | "preto" | "azul" | "laranja";

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

const teamLogos: Record<TeamColor, string> = {
  branco: teamBranco,
  preto: teamPreto,
  azul: teamAzul,
  laranja: teamLaranja,
};

export default function ViewTeams() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedTeam, setSelectedTeam] = useState<TeamColor | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareView, setShowShareView] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [roundPickerOpen, setRoundPickerOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Get available years from rounds
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rounds.forEach(r => {
      if (r.scheduled_date) {
        years.add(new Date(r.scheduled_date + "T00:00:00").getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [rounds]);

  // Filter rounds by selected year
  const filteredRounds = useMemo(() => {
    return rounds.filter(r => {
      if (!r.scheduled_date) return false;
      const year = new Date(r.scheduled_date + "T00:00:00").getFullYear();
      return year === selectedYear;
    });
  }, [rounds, selectedYear]);

  useEffect(() => {
    loadRounds();
  }, []);

  // Auto-select first round when year changes
  useEffect(() => {
    if (filteredRounds.length > 0) {
      setSelectedRound(filteredRounds[0].id);
    }
  }, [filteredRounds]);

  useEffect(() => {
    if (selectedRound) {
      loadTeamPlayers();
      loadMatches();
    }
  }, [selectedRound]);

  // Select first team when teams are loaded
  useEffect(() => {
    if (Object.keys(teamsByColor).length > 0 && !selectedTeam) {
      const firstTeam = orderedTeamColors[0];
      if (firstTeam) setSelectedTeam(firstTeam);
    }
  }, [teamPlayers]);

  const loadRounds = async () => {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select("*")
        .or("is_historical.is.null,is_historical.eq.false")
        .neq("round_number", 0)
        .order("round_number", { ascending: false });

      if (error) throw error;

      setRounds(data || []);
      if (data && data.length > 0) {
        // Set year based on most recent round
        if (data[0].scheduled_date) {
          const year = new Date(data[0].scheduled_date + "T00:00:00").getFullYear();
          setSelectedYear(year);
        }
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
      setSelectedTeam(null);
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

  const orderedTeamColors = ["branco", "azul", "laranja", "preto"].filter(
    color => teamsByColor[color]?.length > 0
  ) as TeamColor[];

  const handleGenerateImage = async () => {
    if (!shareRef.current) return;

    setGenerating(true);
    setCaptureMode(true);

    try {
      // Aguardar fontes e re-render com captureMode
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: 400,
        windowHeight: 711, // 400 * 16/9
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      const link = document.createElement("a");
      link.download = `cozidos-rodada-${selectedRoundData?.round_number || "times"}.jpeg`;
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
      setCaptureMode(false);
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!shareRef.current) return;

    setGenerating(true);
    setCaptureMode(true);

    try {
      // Aguardar fontes e re-render com captureMode
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: 400,
        windowHeight: 711,
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `cozidos-rodada-${selectedRoundData?.round_number}.jpeg`, { type: "image/jpeg" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Cozidos FC - Rodada ${selectedRoundData?.round_number}`,
          text: `Confira os times da Rodada ${selectedRoundData?.round_number}!`,
        });
      } else {
        // Fallback: baixar a imagem diretamente
        const link = document.createElement("a");
        link.download = `cozidos-rodada-${selectedRoundData?.round_number}.jpeg`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error("Erro ao compartilhar:", error);
      // Fallback já foi feito acima, apenas mostra erro se necessário
      if ((error as Error).name !== 'AbortError') {
        toast({
          title: "Compartilhamento cancelado",
          description: "A imagem foi gerada mas não compartilhada.",
        });
      }
    } finally {
      setCaptureMode(false);
      setGenerating(false);
    }
  };


  const handleRoundSelect = (roundId: string) => {
    setSelectedRound(roundId);
    setRoundPickerOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white font-sans">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-4xl">

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
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Nenhuma rodada disponível
              </p>
            </CardContent>
          </Card>
        ) : !selectedRoundData ? (
          <Card className="bg-card/50 border-border/30">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Selecione uma rodada para visualizar os times
              </p>
            </CardContent>
          </Card>
        ) : Object.keys(teamsByColor).length === 0 ? (
          <Card className="bg-card/50 border-border/30">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Times ainda não foram definidos para esta rodada
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Year Filter - Modern Tabs */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex bg-white/5 rounded-full p-1 gap-1">
                {availableYears.map((year) => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={cn(
                      "px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      selectedYear === year
                        ? "bg-pink-500 text-white shadow-md"
                        : "text-gray-400 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Round Title with Popover */}
            {selectedRoundData && (
              <Popover open={roundPickerOpen} onOpenChange={setRoundPickerOpen}>
                <PopoverTrigger asChild>
                  <button className="w-full flex flex-col items-center gap-1 mb-6 group cursor-pointer">
                    <div className="flex items-center gap-2">
                      <h1 className="text-[22px] font-bold text-white group-hover:text-gray-200 transition-colors tracking-tight">
                        Rodada {selectedRoundData.round_number}
                      </h1>
                      <ChevronDown className={cn(
                        "h-5 w-5 text-pink-500 transition-transform duration-200",
                        roundPickerOpen && "rotate-180"
                      )} />
                    </div>
                    <p className="text-sm text-gray-400 group-hover:text-gray-500">
                      {formatDate(selectedRoundData.scheduled_date)}
                    </p>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="center">
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {filteredRounds.map((round) => (
                      <button
                        key={round.id}
                        onClick={() => handleRoundSelect(round.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors",
                          selectedRound === round.id
                            ? "bg-pink-500/10 text-pink-400"
                            : "hover:bg-white/10"
                        )}
                      >
                        <span className="font-medium">Rodada {round.round_number}</span>
                        <span className="text-xs text-gray-400">
                          {formatDate(round.scheduled_date)}
                        </span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {/* Team Logo Carousel - Fixed z-index */}
            <div className="relative overflow-visible py-2">
              <div className="flex justify-center gap-4">
                {orderedTeamColors.map((color, index) => {
                  const isSelected = selectedTeam === color;
                  return (
                    <button
                      key={color}
                      onClick={() => setSelectedTeam(color)}
                      className={cn(
                        "relative flex-shrink-0 p-2 rounded-xl transition-all duration-300 ease-out",
                        isSelected
                          ? "scale-110 z-20"
                          : "scale-95 opacity-60 hover:opacity-100 hover:scale-100 z-10"
                      )}
                      style={{
                        backgroundColor: isSelected ? "hsl(var(--card))" : "transparent",
                        boxShadow: isSelected ? "0 8px 32px rgba(0,0,0,0.3)" : "none"
                      }}
                    >
                      {/* Selection ring */}
                      {isSelected && (
                        <div className="absolute inset-0 rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background" />
                      )}
                      <img
                        src={teamLogos[color]}
                        alt={color}
                        className="h-14 w-14 object-contain relative z-10"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Team Card */}
            {selectedTeam && teamsByColor[selectedTeam] && (
              <TeamCardModern
                teamColor={selectedTeam}
                players={teamsByColor[selectedTeam]}
              />
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4">
              <Button
                onClick={() => setShowShareView(!showShareView)}
                variant="outline"
                className="w-full h-12 gap-2 border-primary/30 hover:bg-primary/10"
              >
                {showShareView ? (
                  <>
                    <EyeOff className="h-5 w-5" />
                    Ocultar Preview
                  </>
                ) : (
                  <>
                    <Eye className="h-5 w-5" />
                    Ver para Compartilhar
                  </>
                )}
              </Button>

              {showShareView && (
                <div className="flex gap-3">
                  <Button
                    onClick={handleGenerateImage}
                    disabled={generating}
                    className="flex-1 h-12 gap-2"
                  >
                    <Download className="h-5 w-5" />
                    {generating ? "Gerando..." : "Baixar"}
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
                </div>
              )}
            </div>

            {/* Shareable View */}
            {showShareView && selectedRoundData && (
              <div className="mt-6">
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Preview para WhatsApp:
                </p>
                <div className="border border-border/30 rounded-2xl overflow-hidden overflow-x-auto bg-[#0a0a0a]">
                  <ShareableTeamsView
                    ref={shareRef}
                    roundNumber={selectedRoundData.round_number}
                    scheduledDate={selectedRoundData.scheduled_date || ""}
                    teamsByColor={teamsByColor}
                    matches={matches}
                    captureMode={captureMode}
                  />
                </div>
              </div>
            )}

            {/* Back Button */}
            <div className="pt-4">
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="w-full h-12 gap-2"
              >
                <ArrowLeft className="h-5 w-5" />
                Voltar
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
