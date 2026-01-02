import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { TeamLogo } from "@/components/match/TeamLogo";
import { MatchEventsSummary } from "@/components/match/MatchEventsSummary";
import { Card, CardContent } from "@/components/ui/card";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMatchTimer, formatEventMinute, getMatchCurrentMinute } from "@/lib/matchTimer";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { toast } from "sonner";
import { Calendar, ChevronDown } from "lucide-react";

interface Match {
  id: string;
  match_number: number;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  scheduled_time: string;
  started_at: string | null;
  finished_at: string | null;
  match_timer_started_at: string | null;
  match_timer_paused_at: string | null;
  match_timer_total_paused_seconds: number | null;
  status: string;
}

interface Round {
  id: string;
  round_number: number;
  status: string;
  scheduled_date: string;
  matches: Match[];
}

const teamNames: Record<string, string> = {
  branco: "Branco",
  vermelho: "Vermelho",
  azul: "Azul",
  laranja: "Laranja",
};

export default function Matches() {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0); // For timer updates
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadRounds();
      toast.success("Rodadas atualizadas!");
    },
    enabled: true,
  });

  useEffect(() => {
    loadRounds();
  }, []);

  // Timer update for live matches
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadRounds = async () => {
    try {
      if (rounds.length === 0) {
        setLoading(true);
      }

      const { data: roundsData } = await supabase
        .from("rounds")
        .select("*")
        .or("is_historical.is.null,is_historical.eq.false")
        .neq("round_number", 0)
        .order("round_number", { ascending: false });

      if (!roundsData) {
        setLoading(false);
        return;
      }

      const roundsWithMatches = await Promise.all(
        roundsData.map(async (round) => {
          const { data: matches } = await supabase
            .from("matches")
            .select("*")
            .eq("round_id", round.id)
            .order("scheduled_time", { ascending: true });

          return {
            ...round,
            matches: matches || [],
          };
        })
      );

      setRounds(roundsWithMatches);
      if (roundsWithMatches.length > 0) {
        setCurrentRoundIndex(0);
      }
      setLoading(false);
    } catch (error) {
      console.error("Erro ao carregar rodadas:", error);
      setLoading(false);
    }
  };

  const currentRound = rounds[currentRoundIndex];

  // Realtime subscriptions
  useEffect(() => {
    if (!currentRound) return;

    const matchesChannel = supabase
      .channel("matches-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `round_id=eq.${currentRound.id}`,
        },
        () => {
          loadRounds();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
    };
  }, [currentRound]);

  // Filter only visible rounds (not "a_iniciar")
  const visibleRounds = rounds.filter((r) => r.status !== "a_iniciar");

  // Extract available years from rounds
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    visibleRounds.forEach((r) => {
      if (r.scheduled_date) {
        const year = new Date(r.scheduled_date + "T00:00:00").getFullYear().toString();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [visibleRounds]);

  // Set default season to current year or most recent
  useEffect(() => {
    if (!selectedSeason && availableYears.length > 0) {
      const currentYear = new Date().getFullYear().toString();
      setSelectedSeason(availableYears.includes(currentYear) ? currentYear : availableYears[0]);
    }
  }, [availableYears, selectedSeason]);

  // Filter rounds by selected season
  const filteredRounds = useMemo(() => {
    if (!selectedSeason) return visibleRounds;
    return visibleRounds.filter((r) => {
      const year = new Date(r.scheduled_date + "T00:00:00").getFullYear().toString();
      return year === selectedSeason;
    });
  }, [visibleRounds, selectedSeason]);

  // Reset current round index when season changes
  useEffect(() => {
    if (filteredRounds.length > 0) {
      const actualIndex = rounds.findIndex((r) => r.id === filteredRounds[0].id);
      if (actualIndex >= 0) setCurrentRoundIndex(actualIndex);
    }
  }, [selectedSeason]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString + "T00:00:00");
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch {
      return "";
    }
  };

  // Safe time formatting - handles both ISO strings and time-only strings
  const formatTime = (timeString: string | null | undefined): string => {
    if (!timeString) return "--:--";

    try {
      // If it's a time-only string (HH:MM:SS or HH:MM), extract hours and minutes
      if (timeString.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
        return timeString.substring(0, 5);
      }

      // Try parsing as ISO date
      const date = new Date(timeString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      }

      return "--:--";
    } catch {
      return "--:--";
    }
  };

  // Get status chip content based on match state - now uses centralized timer
  const getStatusContent = (match: Match): string => {
    if (match.status === "finished") {
      return "Encerrado";
    }

    if (match.status === "in_progress") {
      // Use centralized timer for MM:SS format
      return formatMatchTimer(match);
    }

    // Not started - show scheduled time
    return formatTime(match.scheduled_time);
  };

  return (
    <div className="min-h-screen bg-background">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      <Header />

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Season Filter - Centered */}
        {availableYears.length > 1 && (
          <div className="flex justify-center mb-4">
            <Select
              value={selectedSeason || undefined}
              onValueChange={(value) => setSelectedSeason(value)}
            >
              <SelectTrigger className="w-auto gap-2 bg-muted/30 border-border/50">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Temporada" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    Temporada {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Round Selector - Centered Modern Dropdown */}
        <div className="flex justify-center mb-6">
          <Select
            value={currentRound?.id || undefined}
            onValueChange={(value) => {
              const actualIndex = rounds.findIndex((r) => r.id === value);
              if (actualIndex >= 0) setCurrentRoundIndex(actualIndex);
            }}
          >
            <SelectTrigger className="w-auto min-w-[200px] gap-2 bg-primary/10 border-primary/30 hover:bg-primary/20 transition-colors">
              <SelectValue>
                <span className="font-semibold text-primary">
                  {currentRound ? `Rodada ${currentRound.round_number} - ${formatDate(currentRound.scheduled_date)}` : 'Selecione'}
                </span>
              </SelectValue>
              <ChevronDown className="h-4 w-4 text-primary" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {filteredRounds.map((round) => (
                <SelectItem key={round.id} value={round.id}>
                  Rodada {round.round_number} - {formatDate(round.scheduled_date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Match List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : !currentRound ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma rodada disponível
          </div>
        ) : (
          <div className="space-y-4">
            {currentRound.matches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma partida nesta rodada
              </div>
            ) : (
              currentRound.matches.map((match) => (
                <Card
                  key={match.id}
                  className="overflow-hidden hover:shadow-lg hover:shadow-primary/20 transition-all border-border cursor-pointer active:scale-[0.98]"
                  onClick={() => navigate(`/match/${match.id}`)}
                >
                  <CardContent className="p-4 sm:p-6">
                    {/* Score Layout - Centered with Status Pill */}
                    <div className="flex items-center justify-center gap-2 sm:gap-4">
                      {/* Home Team */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
                        <div className="flex flex-col items-center gap-1">
                          <TeamLogo teamColor={match.team_home as any} size="sm" />
                          <span className="text-xs sm:text-sm font-medium text-foreground">
                            {teamNames[match.team_home]}
                          </span>
                        </div>
                        <span className="text-2xl sm:text-3xl md:text-4xl font-bold tabular-nums text-primary">
                          {match.score_home}
                        </span>
                      </div>

                      {/* Status Chip - Central */}
                      <div
                        className={cn(
                          "px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border text-xs sm:text-sm font-medium",
                          "min-w-[70px] sm:min-w-[90px] text-center whitespace-nowrap flex items-center justify-center gap-1.5",
                          match.status === "in_progress"
                            ? "bg-primary/20 border-primary/50 text-foreground"
                            : "bg-muted border-border text-foreground"
                        )}
                      >
                        {match.status === "in_progress" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        )}
                        <span>{getStatusContent(match)}</span>
                      </div>

                      {/* Away Team */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-start">
                        <span className="text-2xl sm:text-3xl md:text-4xl font-bold tabular-nums text-primary">
                          {match.score_away}
                        </span>
                        <div className="flex flex-col items-center gap-1">
                          <TeamLogo teamColor={match.team_away as any} size="sm" />
                          <span className="text-xs sm:text-sm font-medium text-foreground">
                            {teamNames[match.team_away]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Match Events Summary - Goals */}
                    {match.status !== "not_started" && (
                      <MatchEventsSummary
                        matchId={match.id}
                        teamHome={match.team_home}
                        teamAway={match.team_away}
                        compact={true}
                      />
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
