import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { metrics } from "@/lib/metrics";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { TeamLogo } from "@/components/match/TeamLogo";
import { MatchEventsSummary } from "@/components/match/MatchEventsSummary";
import { Card, CardContent } from "@/components/ui/card";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import { cn } from "@/lib/utils";
import { formatMatchTimer } from "@/lib/matchTimer";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  preto: "Preto",
  azul: "Azul",
  laranja: "Laranja",
};

export default function Matches() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [, setTick] = useState(0); // For timer updates

  // React Query for Rounds
  const { data: rounds = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['rounds_with_matches'],
    queryFn: async () => {
      return await metrics.track('get_rounds_and_matches', async () => {
        // Fetch rounds
        const { data: roundsData, error: roundError } = await supabase
          .from("rounds")
          .select("*")
          .or("is_historical.is.null,is_historical.eq.false")
          .neq("round_number", 0)
          .order("round_number", { ascending: false });

        if (roundError) throw roundError;
        if (!roundsData) return [];

        // Fetch matches for all rounds
        const roundsWithMatches = await Promise.all(
          roundsData.map(async (round) => {
            const { data: matches, error: matchError } = await supabase
              .from("matches")
              .select("*")
              .eq("round_id", round.id)
              .order("scheduled_time", { ascending: true });

            if (matchError) throw matchError;

            return {
              ...round,
              matches: matches || [],
            };
          })
        );
        return roundsWithMatches;
      });
    },
    staleTime: 1000 * 60, // 1 minute stale time (Phase 1 req)
    refetchOnWindowFocus: false,
  });

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
      toast.success("Rodadas atualizadas!");
    },
    enabled: true,
  });

  // Calculate default round index only when data changes
  useEffect(() => {
    if (rounds.length > 0) {
      // Check for roundId param
      const roundIdParam = searchParams.get("roundId");
      const paramIdx = roundIdParam ? rounds.findIndex(r => r.id === roundIdParam) : -1;

      if (paramIdx !== -1) {
        setCurrentRoundIndex(paramIdx);
      } else {
        // Find in-progress round
        const inProgressIdx = rounds.findIndex((r) => r.status === "em_andamento");
        if (inProgressIdx !== -1) {
          setCurrentRoundIndex(inProgressIdx);
        } else {
          // Find last finished round or most recent with matches
          const withMatches = rounds.filter((r) => r.matches.length > 0);
          if (withMatches.length > 0) {
            const lastWithMatches = rounds.findIndex((r) => r.id === withMatches[0].id);
            setCurrentRoundIndex(lastWithMatches !== -1 ? lastWithMatches : 0);
          } else {
            setCurrentRoundIndex(0);
          }
        }
      }
    }
  }, [rounds.length, searchParams]); // Only run when rounds loaded length changes or param changes

  // Realtime subscriptions
  const currentRound = rounds[currentRoundIndex];
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
          // Invalidate query to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['rounds_with_matches'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
    };
  }, [currentRound?.id, queryClient]);

  // Timer update for live matches
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter logic
  const visibleRounds = rounds.filter((r) =>
    r.matches.length > 0 || r.status !== "a_iniciar"
  );

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString + "T00:00:00");
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch {
      return "";
    }
  };

  const formatTime = (timeString: string | null | undefined): string => {
    if (!timeString) return "--:--";
    try {
      if (timeString.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
        return timeString.substring(0, 5);
      }
      const date = new Date(timeString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      }
      return "--:--";
    } catch {
      return "--:--";
    }
  };

  const getStatusContent = (match: Match): string => {
    if (match.status === "finished") {
      return "Encerrado";
    }
    if (match.status === "in_progress") {
      return formatMatchTimer(match);
    }
    return formatTime(match.scheduled_time);
  };

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-pink-300 mb-6">Rodadas</h1>

        <div className="mb-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 min-w-max pb-2">
            {visibleRounds.map((round) => {
              const actualIndex = rounds.findIndex((r) => r.id === round.id);
              const isActive = currentRoundIndex === actualIndex;

              return (
                <button
                  key={round.id}
                  onClick={() => setCurrentRoundIndex(actualIndex)}
                  className={cn(
                    "flex flex-col items-center justify-center px-4 py-3 rounded-lg min-w-[80px] transition-all border",
                    isActive
                      ? "bg-pink-500 text-white border-pink-500 shadow-lg"
                      : "bg-[#1c1c1e] text-gray-400 border-white/10 hover:bg-white/10"
                  )}
                >
                  <span className="text-xl font-bold">{round.round_number}</span>
                  <span className="text-xs mt-1">{formatDate(round.scheduled_date)}</span>
                </button>
              );
            })}
          </div>
        </div>

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
                  className="overflow-hidden hover:shadow-lg hover:shadow-pink-500/20 transition-all bg-[#1c1c1e] border-white/5 cursor-pointer active:scale-[0.98]"
                  onClick={() => navigate(`/match/${match.id}`)}
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center justify-center gap-2 sm:gap-4">
                      {/* Home Team */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
                        <div className="flex flex-col items-center gap-1">
                          <TeamLogo teamColor={match.team_home as any} size="sm" />
                          <span className="text-xs sm:text-sm font-medium text-foreground">
                            {teamNames[match.team_home]}
                          </span>
                        </div>
                        <span className="text-2xl sm:text-3xl md:text-4xl font-bold tabular-nums text-pink-300">
                          {match.score_home}
                        </span>
                      </div>

                      {/* Status Chip */}
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
                        <span className="text-2xl sm:text-3xl md:text-4xl font-bold tabular-nums text-pink-300">
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
