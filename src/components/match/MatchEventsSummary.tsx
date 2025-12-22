import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatEventMinute } from "@/lib/matchTimer";

interface Goal {
    id: string;
    minute: number;
    team_color: string;
    player?: {
        name: string;
        nickname: string | null;
    };
    assists?: Array<{
        player?: {
            name: string;
            nickname: string | null;
        };
    }>;
}

interface MatchEventsSummaryProps {
    matchId: string;
    teamHome: string;
    teamAway: string;
    compact?: boolean;
}

// Single Goal Item - Mirrored Layout
function GoalItem({ goal, isHome }: { goal: Goal; isHome: boolean }) {
    const playerName = goal.player?.nickname || goal.player?.name || "Jogador";
    const assistData = Array.isArray(goal.assists) && goal.assists.length > 0 ? goal.assists[0] : null;
    const assistName = assistData?.player?.nickname || assistData?.player?.name;

    return (
        <div className={cn(
            "flex flex-col mb-3 sm:mb-4",
            isHome ? "items-end text-right" : "items-start text-left"
        )}>
            {/* Line 1: Minute + Ball Icon (Mirrored) */}
            <div className={cn(
                "flex items-center gap-1.5 mb-1",
                isHome ? "flex-row" : "flex-row-reverse"
            )}>
                {isHome ? (
                    <>
                        <span className="text-xs sm:text-sm font-semibold text-primary tabular-nums">
                            {formatEventMinute(goal.minute)}
                        </span>
                        <img
                            src="/assets/icons/ball-icon.png"
                            alt="⚽"
                            className="w-4 h-4 sm:w-5 sm:h-5 object-contain flex-shrink-0"
                        />
                    </>
                ) : (
                    <>
                        <img
                            src="/assets/icons/ball-icon.png"
                            alt="⚽"
                            className="w-4 h-4 sm:w-5 sm:h-5 object-contain flex-shrink-0"
                        />
                        <span className="text-xs sm:text-sm font-semibold text-primary tabular-nums">
                            {formatEventMinute(goal.minute)}
                        </span>
                    </>
                )}
            </div>

            {/* Line 2: Goal Scorer (Bold) */}
            <span className="text-sm sm:text-base font-bold text-white leading-tight break-words max-w-[140px] sm:max-w-[180px]">
                {playerName}
            </span>

            {/* Line 3: Assist (Lighter, smaller) */}
            {assistName && (
                <span className="text-xs sm:text-sm font-normal text-muted-foreground leading-tight break-words max-w-[130px] sm:max-w-[170px]">
                    {assistName}
                </span>
            )}
        </div>
    );
}

export function MatchEventsSummary({
    matchId,
    teamHome,
    teamAway,
    compact = false
}: MatchEventsSummaryProps) {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadGoals();

        // Realtime subscription
        const channel = supabase
            .channel(`match-goals-${matchId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "goals", filter: `match_id=eq.${matchId}` },
                () => loadGoals()
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "assists" },
                () => loadGoals()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [matchId]);

    const loadGoals = async () => {
        try {
        const { data, error } = await supabase
            .from("goals")
            .select(`
              id,
              minute,
              team_color,
              player:profiles!goals_player_id_fkey(name, nickname),
              assists(
                player:profiles!assists_player_id_fkey(name, nickname)
              )
            `)
            .eq("match_id", matchId)
            .order("minute", { ascending: true });

            if (error) throw error;
            setGoals((data as any) || []);
        } catch (error) {
            console.error("Erro ao carregar gols:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || goals.length === 0) {
        return null;
    }

    const homeGoals = goals.filter(g => g.team_color === teamHome);
    const awayGoals = goals.filter(g => g.team_color === teamAway);

    return (
        <div className={cn(
            "grid grid-cols-2 gap-3 sm:gap-6 border-t border-border/50 bg-muted/5",
            compact ? "py-2 px-2 sm:px-3" : "py-3 px-3 sm:px-4"
        )}>
            {/* Left Column - Home Team (Right-aligned) */}
            <div className="flex flex-col items-end pr-1 sm:pr-2 border-r border-border/30">
                {homeGoals.map(goal => (
                    <GoalItem key={goal.id} goal={goal} isHome={true} />
                ))}
            </div>

            {/* Right Column - Away Team (Left-aligned) */}
            <div className="flex flex-col items-start pl-1 sm:pl-2">
                {awayGoals.map(goal => (
                    <GoalItem key={goal.id} goal={goal} isHome={false} />
                ))}
            </div>
        </div>
    );
}
