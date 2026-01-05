import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Calendar,
    ChevronRight,
    ArrowUpRight,
    Check,
    X,
    Minus,
    LogOut,
    PlusCircle, Search, Trophy, History, ArrowRight, UserPlus, BarChart3, Goal, Footprints, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Users, CalendarDays, DollarSign, Play, AlertTriangle } from "lucide-react";

// Types
interface PlayerStats {
    player_id: string;
    nickname: string;
    pontos_totais: number;
    gols: number;
    assistencias: number;
}

interface LastRoundStats {
    total_points: number;
    goals: number;
    assists: number;
}

interface RetrospectItem {
    result: 'win' | 'draw' | 'loss';
}

interface NextMatchData {
    round_id: string;
    round_number: number;
    scheduled_date: string;
    user_team_name: string | null;
    user_team_color: string | null;
}

// Admin-specific types
interface AdminLastRoundEvents {
    goals: number;
    assists: number;
    yellowCards: number;
    blueCards: number;
}

interface LiveMatch {
    id: string;
    teamHome: string;
    teamAway: string;
    scoreHome: number;
    scoreAway: number;
    minutes: number;
}

export default function Home() {
    const navigate = useNavigate();
    const { user, profile, signOut, isAdmin } = useAuth();
    const [loading, setLoading] = useState(true);

    // Top 5 data
    const [topRanking, setTopRanking] = useState<PlayerStats[]>([]);
    const [topScorers, setTopScorers] = useState<PlayerStats[]>([]);
    const [topAssists, setTopAssists] = useState<PlayerStats[]>([]);

    // User position in each ranking
    const [userRankingPos, setUserRankingPos] = useState<{ position: number; value: number } | null>(null);
    const [userGoalsPos, setUserGoalsPos] = useState<{ position: number; value: number } | null>(null);
    const [userAssistsPos, setUserAssistsPos] = useState<{ position: number; value: number } | null>(null);

    // Last round stats
    const [lastRound, setLastRound] = useState<LastRoundStats | null>(null);
    const [retrospect, setRetrospect] = useState<RetrospectItem[]>([]);

    // Next match
    const [nextMatch, setNextMatch] = useState<NextMatchData | null>(null);

    // Admin stats (only loaded for admins)
    const [adminStats, setAdminStats] = useState<{ totalPlayers: number; pendingPlayers: number; totalRounds: number; activeRounds: number } | null>(null);
    const [adminLastRoundEvents, setAdminLastRoundEvents] = useState<AdminLastRoundEvents | null>(null);
    const [liveMatch, setLiveMatch] = useState<LiveMatch | null>(null);
    const [defaultersCount, setDefaultersCount] = useState<number>(0);

    const currentYear = new Date().getFullYear();

    useEffect(() => {
        if (user && profile) {
            loadHomeData();
        }
    }, [user, profile]);

    const loadHomeData = async () => {
        if (!profile?.id) return;

        try {
            setLoading(true);

            // Load stats from player_round_stats for current year
            const { data: roundStats, error: statsError } = await supabase
                .from("player_round_stats")
                .select(`
          player_id,
          goals,
          assists,
          victories,
          draws,
          defeats,
          total_points,
          round:rounds!inner(scheduled_date, status),
          profile:profiles!inner(nickname, is_player, status)
        `)
                .gte("round.scheduled_date", `${currentYear}-01-01`)
                .lte("round.scheduled_date", `${currentYear}-12-31`);

            if (statsError) {
                console.error("[Home] Error loading round stats:", statsError);
            }

            // Aggregate stats by player
            const playerMap = new Map<string, PlayerStats>();

            (roundStats || []).forEach((rs: any) => {
                if (!rs.profile?.is_player || rs.profile?.status !== 'aprovado') return;

                const playerId = rs.player_id;
                const existing = playerMap.get(playerId);

                if (existing) {
                    existing.gols += rs.goals || 0;
                    existing.assistencias += rs.assists || 0;
                    existing.pontos_totais += rs.total_points || 0;
                } else {
                    playerMap.set(playerId, {
                        player_id: playerId,
                        nickname: rs.profile?.nickname || 'Sem nome',
                        gols: rs.goals || 0,
                        assistencias: rs.assists || 0,
                        pontos_totais: rs.total_points || 0
                    });
                }
            });

            const playersArray = Array.from(playerMap.values());

            // Sort and get Top 5 for each category
            const sortedByPoints = [...playersArray].sort((a, b) => b.pontos_totais - a.pontos_totais);
            const sortedByGoals = [...playersArray].sort((a, b) => b.gols - a.gols);
            const sortedByAssists = [...playersArray].sort((a, b) => b.assistencias - a.assistencias);

            setTopRanking(sortedByPoints.slice(0, 5));
            setTopScorers(sortedByGoals.slice(0, 5));
            setTopAssists(sortedByAssists.slice(0, 5));

            // Find user position in each ranking
            const userRankIdx = sortedByPoints.findIndex(p => p.player_id === profile.id);
            if (userRankIdx !== -1) {
                setUserRankingPos({ position: userRankIdx + 1, value: sortedByPoints[userRankIdx].pontos_totais });
            }

            const userGoalsIdx = sortedByGoals.findIndex(p => p.player_id === profile.id);
            if (userGoalsIdx !== -1) {
                setUserGoalsPos({ position: userGoalsIdx + 1, value: sortedByGoals[userGoalsIdx].gols });
            }

            const userAssistsIdx = sortedByAssists.findIndex(p => p.player_id === profile.id);
            if (userAssistsIdx !== -1) {
                setUserAssistsPos({ position: userAssistsIdx + 1, value: sortedByAssists[userAssistsIdx].assistencias });
            }

            // Load user's last round stats
            const { data: lastRoundData } = await supabase
                .from("player_round_stats")
                .select(`
          total_points, goals, assists, victories, draws, defeats,
          round:rounds!inner(status)
        `)
                .eq("player_id", profile.id)
                .eq("round.status", "finalizada")
                .order("created_at", { ascending: false })
                .limit(1);

            if (lastRoundData && lastRoundData.length > 0) {
                setLastRound({
                    total_points: lastRoundData[0].total_points || 0,
                    goals: lastRoundData[0].goals || 0,
                    assists: lastRoundData[0].assists || 0
                });
            }

            // Load retrospect (last 4 rounds)
            const { data: retrospectData } = await supabase
                .from("player_round_stats")
                .select(`victories, draws, defeats`)
                .eq("player_id", profile.id)
                .order("created_at", { ascending: false })
                .limit(4);

            if (retrospectData) {
                const retro: RetrospectItem[] = retrospectData.map((r: any) => {
                    if ((r.victories || 0) > 0) return { result: 'win' as const };
                    if ((r.defeats || 0) > 0) return { result: 'loss' as const };
                    return { result: 'draw' as const };
                });
                setRetrospect(retro);
            }

            // Load next scheduled round
            const { data: nextRound } = await supabase
                .from("rounds")
                .select("id, round_number, scheduled_date")
                .gte("scheduled_date", new Date().toISOString().split("T")[0])
                .order("scheduled_date", { ascending: true })
                .limit(1);

            if (nextRound && nextRound.length > 0) {
                const roundId = nextRound[0].id;

                // Get user's team for this round
                const { data: userTeamData } = await supabase
                    .from("team_players")
                    .select(`team:teams!inner(id, name, color, round_id)`)
                    .eq("player_id", profile.id)
                    .eq("teams.round_id", roundId)
                    .limit(1);

                setNextMatch({
                    round_id: roundId,
                    round_number: nextRound[0].round_number,
                    scheduled_date: nextRound[0].scheduled_date,
                    user_team_name: userTeamData?.[0]?.team?.name || null,
                    user_team_color: userTeamData?.[0]?.team?.color || null,
                });
            }

            // Load admin stats (only for admins)
            if (isAdmin) {
                const [playersResult, pendingResult, roundsResult] = await Promise.all([
                    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "aprovado").eq("is_player", true),
                    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "pendente").eq("is_player", true),
                    supabase.from("rounds").select("id, status").eq("season", currentYear)
                ]);

                const totalRounds = roundsResult.data?.length || 0;
                const activeRounds = roundsResult.data?.filter(r => r.status !== "finalizada").length || 0;

                setAdminStats({
                    totalPlayers: playersResult.count || 0,
                    pendingPlayers: pendingResult.count || 0,
                    totalRounds,
                    activeRounds
                });

                // Load last round events for admin
                const { data: lastRoundInfo } = await supabase
                    .from("rounds")
                    .select("id")
                    .eq("status", "finalizada")
                    .eq("season", currentYear)
                    .order("scheduled_date", { ascending: false })
                    .limit(1);

                if (lastRoundInfo && lastRoundInfo.length > 0) {
                    const lastRoundId = lastRoundInfo[0].id;
                    const { data: events } = await supabase
                        .from("match_events")
                        .select("event_type, matches!inner(round_id)")
                        .eq("matches.round_id", lastRoundId);

                    if (events) {
                        setAdminLastRoundEvents({
                            goals: events.filter(e => e.event_type === "goal").length,
                            assists: events.filter(e => e.event_type === "assist").length,
                            yellowCards: events.filter(e => e.event_type === "yellow_card").length,
                            blueCards: events.filter(e => e.event_type === "blue_card").length
                        });
                    }
                }

                // Load live match (in_progress)
                const { data: liveMatches } = await supabase
                    .from("matches")
                    .select("id, team_home, team_away, score_home, score_away, match_timer_started_at, match_timer_paused_at, match_timer_total_paused_seconds")
                    .eq("status", "in_progress")
                    .limit(1);

                if (liveMatches && liveMatches.length > 0) {
                    const match = liveMatches[0];
                    let minutes = 0;
                    if (match.match_timer_started_at) {
                        const startTime = new Date(match.match_timer_started_at).getTime();
                        const now = match.match_timer_paused_at
                            ? new Date(match.match_timer_paused_at).getTime()
                            : Date.now();
                        const pausedSeconds = match.match_timer_total_paused_seconds || 0;
                        minutes = Math.floor((now - startTime - pausedSeconds * 1000) / 60000);
                    }
                    setLiveMatch({
                        id: match.id,
                        teamHome: match.team_home,
                        teamAway: match.team_away,
                        scoreHome: match.score_home,
                        scoreAway: match.score_away,
                        minutes: minutes
                    });
                }

                // Load defaulters count (placeholder - adjust table/column as needed)
                // For now, count players with payment_status = 'inadimplente' if exists
                const { count: defaulters } = await supabase
                    .from("profiles")
                    .select("*", { count: "exact", head: true })
                    .eq("is_player", true)
                    .eq("payment_status", "inadimplente");

                setDefaultersCount(defaulters || 0);
            }

        } catch (error) {
            console.error("Error loading home data:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + "T12:00:00");
        return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
    };

    const getInitials = (name: string) => {
        return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
    };

    // If not logged in or no profile, show skeleton
    if (!user || !profile) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <Header />
                <main className="flex-1 container mx-auto px-4 py-6">
                    <Skeleton className="h-64 w-full rounded-xl" />
                </main>
                <Footer />
            </div>
        );
    }

    const nickname = profile.nickname || profile.name || "Jogador";

    return (
        <div className="min-h-screen bg-[#0e0e10] text-white font-sans selection:bg-white/20">
            {/* Header Section - Always Fixed at Top */}
            <header className="flex items-start justify-between p-4 pt-6 fixed top-0 left-0 right-0 bg-[#0e0e10]/95 backdrop-blur-sm z-50">
                <div className="flex items-center gap-3 flex-1">
                    {/* Avatar - Only for non-admins */}
                    {!isAdmin && (
                        <Avatar
                            className="w-10 h-10 border-2 border-white/10 cursor-pointer hover:border-pink-500/50 transition-colors"
                            onClick={() => navigate("/profile")}
                        >
                            <AvatarImage src={profile.avatar_url || undefined} alt={nickname} />
                            <AvatarFallback className="bg-pink-500/20 text-pink-300 text-sm font-bold">
                                {getInitials(nickname)}
                            </AvatarFallback>
                        </Avatar>
                    )}

                    <div>
                        {loading ? (
                            <Skeleton className="h-6 w-40" />
                        ) : (
                            <h1 className="text-[22px] font-bold leading-tight text-white tracking-tight">
                                {isAdmin ? 'Painel Admin' : `Eae, Cozido ${nickname}!`}
                            </h1>
                        )}
                        <span className="block text-[13px] font-medium text-gray-400 tracking-wide uppercase">
                            Temporada {currentYear}
                        </span>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={signOut}
                    className="w-9 h-9 rounded-full bg-[#1c1c1e] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors group"
                >
                    <LogOut className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                </button>
            </header>

            {/* Main Content Grid - Add top padding for fixed header */}
            <main className="grid grid-cols-2 gap-3 p-4 pb-24 pt-24">

                {/* Original Top 5 Cards - Only for non-admins */}
                {!isAdmin && (
                    <>
                        {/* Ranking Card - Top 5 */}
                        <article
                            className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 flex flex-col border border-white/5 shadow-lg group transition-transform duration-300 hover:-translate-y-1 cursor-pointer"
                            onClick={() => navigate("/classification")}
                        >
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />

                            {/* Header */}
                            <div className="relative z-10 flex justify-between items-start mb-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200 bg-pink-500/20 px-2 py-0.5 rounded-md border border-pink-500/20">
                                    Ranking
                                </span>
                            </div>

                            {/* Top 5 List */}
                            <div className="relative z-10 flex-grow flex flex-col gap-2">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <Skeleton key={i} className="h-5 w-full" />
                                    ))
                                ) : topRanking.length > 0 ? (
                                    <>
                                        {/* 1st Place */}
                                        <div className="flex items-end justify-between pb-2 mb-1 border-b border-white/10">
                                            <div>
                                                <span className="text-[9px] font-bold text-pink-300 uppercase tracking-wider block mb-0.5">1º LUGAR</span>
                                                <span className="text-lg font-black text-white leading-none">{topRanking[0]?.nickname?.toUpperCase()}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-bold text-pink-300 leading-none">{topRanking[0]?.pontos_totais}</span>
                                                <span className="text-[9px] text-gray-300 block uppercase font-bold">Pts</span>
                                            </div>
                                        </div>

                                        {/* 2nd - 5th Place */}
                                        {topRanking.slice(1, 5).map((player, idx) => (
                                            <div key={player.player_id} className="flex items-center justify-between text-xs py-0.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="font-bold text-gray-400 w-3 text-center">{idx + 2}</span>
                                                    <span className="font-bold text-gray-100">{player.nickname?.toUpperCase()}</span>
                                                </div>
                                                <span className="font-bold text-white">{player.pontos_totais}</span>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="text-gray-400 text-sm">Sem dados</div>
                                )}
                            </div>

                            {/* Footer - Your Position (hidden for admins) */}
                            {!isAdmin && (
                                <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex justify-between items-center bg-black/20 -mx-4 -mb-4 px-4 py-3">
                                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Você</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[12px] font-bold text-white">#{userRankingPos?.position || '-'}</span>
                                        <span className="text-[10px] text-gray-300 font-medium">{userRankingPos?.value || 0} pts</span>
                                    </div>
                                </div>
                            )}
                        </article>

                        {/* Goals Card - Top 5 */}
                        <article
                            className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 flex flex-col border border-white/5 shadow-lg group transition-transform duration-300 hover:-translate-y-1 cursor-pointer"
                            onClick={() => navigate("/statistics")}
                        >
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />

                            <div className="relative z-10 flex justify-between items-start mb-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200 bg-pink-500/20 px-2 py-0.5 rounded-md border border-pink-500/20">
                                    Gols
                                </span>
                            </div>

                            <div className="relative z-10 flex-grow flex flex-col gap-2">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <Skeleton key={i} className="h-5 w-full" />
                                    ))
                                ) : topScorers.length > 0 ? (
                                    <>
                                        <div className="flex items-end justify-between pb-2 mb-1 border-b border-white/10">
                                            <div>
                                                <span className="text-[9px] font-bold text-pink-300 uppercase tracking-wider block mb-0.5">ARTILHEIRO</span>
                                                <span className="text-lg font-black text-white leading-none">{topScorers[0]?.nickname?.toUpperCase()}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-bold text-pink-300 leading-none">{topScorers[0]?.gols}</span>
                                                <span className="text-[9px] text-gray-300 block uppercase font-bold">Gols</span>
                                            </div>
                                        </div>

                                        {topScorers.slice(1, 5).map((player, idx) => (
                                            <div key={player.player_id} className="flex items-center justify-between text-xs py-0.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="font-bold text-gray-400 w-3 text-center">{idx + 2}</span>
                                                    <span className="font-bold text-gray-100">{player.nickname?.toUpperCase()}</span>
                                                </div>
                                                <span className="font-bold text-white">{player.gols}</span>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="text-gray-400 text-sm">Sem dados</div>
                                )}
                            </div>

                            {!isAdmin && (
                                <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex justify-between items-center bg-black/20 -mx-4 -mb-4 px-4 py-3">
                                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Você</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[12px] font-bold text-white">{userGoalsPos?.value || 0}</span>
                                        <span className="text-[10px] text-gray-300 font-medium">gol{(userGoalsPos?.value || 0) !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            )}
                        </article>

                        {/* Assists Card - Top 5 */}
                        <article
                            className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 flex flex-col border border-white/5 shadow-lg group transition-transform duration-300 hover:-translate-y-1 cursor-pointer"
                            onClick={() => navigate("/statistics")}
                        >
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />

                            <div className="relative z-10 flex justify-between items-start mb-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200 bg-pink-500/20 px-2 py-0.5 rounded-md border border-pink-500/20">
                                    Assis.
                                </span>
                            </div>

                            <div className="relative z-10 flex-grow flex flex-col gap-2">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <Skeleton key={i} className="h-5 w-full" />
                                    ))
                                ) : topAssists.length > 0 ? (
                                    <>
                                        <div className="flex items-end justify-between pb-2 mb-1 border-b border-white/10">
                                            <div>
                                                <span className="text-[9px] font-bold text-pink-300 uppercase tracking-wider block mb-0.5">GARÇOM</span>
                                                <span className="text-lg font-black text-white leading-none">{topAssists[0]?.nickname?.toUpperCase()}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-bold text-pink-300 leading-none">{topAssists[0]?.assistencias}</span>
                                                <span className="text-[9px] text-gray-300 block uppercase font-bold">Ass.</span>
                                            </div>
                                        </div>

                                        {topAssists.slice(1, 5).map((player, idx) => (
                                            <div key={player.player_id} className="flex items-center justify-between text-xs py-0.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="font-bold text-gray-400 w-3 text-center">{idx + 2}</span>
                                                    <span className="font-bold text-gray-100">{player.nickname?.toUpperCase()}</span>
                                                </div>
                                                <span className="font-bold text-white">{player.assistencias}</span>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="text-gray-400 text-sm">Sem dados</div>
                                )}
                            </div>

                            {!isAdmin && (
                                <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex justify-between items-center bg-black/20 -mx-4 -mb-4 px-4 py-3">
                                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Você</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[12px] font-bold text-white">{userAssistsPos?.value || 0}</span>
                                        <span className="text-[10px] text-gray-300 font-medium">ass.</span>
                                    </div>
                                </div>
                            )}
                        </article>

                        {/* Last Round Card */}
                        <article
                            className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 flex flex-col border border-white/5 shadow-lg group cursor-pointer transition-transform duration-300 hover:-translate-y-1"
                            onClick={() => navigate("/profile")}
                        >
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />

                            <div className="relative z-10 flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200 bg-pink-500/20 px-2 py-0.5 rounded-md border border-pink-500/20">
                                    Últ. Rodada
                                </span>
                            </div>

                            <div className="relative z-10 flex-grow flex flex-col gap-3 mt-1">
                                {loading ? (
                                    <Skeleton className="h-20 w-full" />
                                ) : lastRound ? (
                                    <>
                                        {/* Hero Section */}
                                        <div className="flex items-end justify-between pb-3 border-b border-white/10">
                                            <div>
                                                <span className="text-[9px] font-bold text-pink-300 uppercase tracking-wider block mb-0.5">PONTUAÇÃO</span>
                                                <span className="text-[40px] font-black text-white leading-none tracking-tighter">{lastRound.total_points}</span>
                                            </div>
                                            <div className="text-right flex flex-col justify-end pb-1 gap-1">
                                                <div className="flex items-baseline justify-end gap-1.5">
                                                    <span className="text-lg font-bold text-white leading-none">{lastRound.goals}</span>
                                                    <span className="text-[9px] text-gray-300 uppercase font-bold">Gols</span>
                                                </div>
                                                <div className="flex items-baseline justify-end gap-1.5">
                                                    <span className="text-lg font-bold text-white leading-none">{lastRound.assists}</span>
                                                    <span className="text-[9px] text-gray-300 uppercase font-bold">Ass.</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Retrospect Section */}
                                        {retrospect.length > 0 && (
                                            <div className="flex-grow flex flex-col justify-center items-center mt-2">
                                                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-2 block text-center">
                                                    Retrospecto ({retrospect.length}J)
                                                </span>
                                                <div className="flex justify-center items-center gap-2">
                                                    {retrospect.map((r, i) => (
                                                        <div
                                                            key={i}
                                                            className={cn(
                                                                "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-transform hover:scale-110 shadow-lg",
                                                                r.result === 'win' && "bg-emerald-500 border-emerald-400",
                                                                r.result === 'loss' && "bg-rose-500 border-rose-400",
                                                                r.result === 'draw' && "bg-zinc-600 border-zinc-500"
                                                            )}
                                                        >
                                                            {r.result === 'win' && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                                                            {r.result === 'loss' && <X className="w-4 h-4 text-white" strokeWidth={3} />}
                                                            {r.result === 'draw' && <Minus className="w-4 h-4 text-white" strokeWidth={3} />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-gray-400 text-sm text-center py-4">Sem dados</div>
                                )}
                            </div>

                            <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex items-center justify-between bg-black/20 -mx-4 -mb-4 px-4 py-3">
                                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Estatísticas</span>
                                <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-pink-300 transition-colors" />
                            </div>
                        </article>
                    </>
                )}

                {/* Admin Quick Access Section - Only for Admins */}
                {isAdmin && adminStats && (
                    <>
                        {/* Gestão Rápida Section - Moved Up */}
                        <div className="col-span-2 mt-2">
                            <h2 className="text-[16px] font-bold text-white mb-3 pl-1 tracking-tight flex items-center gap-2">
                                Gestão Rápida
                                <div className="h-px bg-white/10 flex-grow" />
                            </h2>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Financeiro Card */}
                                <article
                                    className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 border border-white/5 shadow-lg cursor-pointer hover:bg-white/5 transition-all group"
                                    onClick={() => navigate("/admin/financeiro")}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-amber-500/20 rounded-xl">
                                            <DollarSign className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <span className="text-sm font-bold text-white">Financeiro</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-white">{defaultersCount}</span>
                                        <span className="text-xs text-gray-400">pendentes</span>
                                    </div>
                                    {defaultersCount > 0 && (
                                        <div className="mt-2 px-2 py-1 bg-red-500/20 rounded-lg inline-flex items-center gap-1.5">
                                            <AlertTriangle className="w-3 h-3 text-red-400" />
                                            <span className="text-xs font-bold text-red-400">
                                                Ação necessária
                                            </span>
                                        </div>
                                    )}
                                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                </article>

                                {/* Rodadas Card */}
                                <article
                                    className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 border border-white/5 shadow-lg cursor-pointer hover:bg-white/5 transition-all group"
                                    onClick={() => navigate("/admin/round/manage")}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-emerald-500/20 rounded-xl">
                                            <CalendarDays className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <span className="text-sm font-bold text-white">Rodadas</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-white">{adminStats.totalRounds}</span>
                                        <span className="text-xs text-gray-400">total</span>
                                    </div>
                                    {adminStats.activeRounds > 0 && (
                                        <div className="mt-2 px-2 py-1 bg-emerald-500/20 rounded-lg inline-flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-xs font-bold text-emerald-400">
                                                {adminStats.activeRounds} ativa{adminStats.activeRounds > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                </article>

                                {/* Jogadores Card */}
                                <article
                                    className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 border border-white/5 shadow-lg cursor-pointer hover:bg-white/5 transition-all group"
                                    onClick={() => navigate("/admin/players")}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-blue-500/20 rounded-xl">
                                            <Users className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <span className="text-sm font-bold text-white">Jogadores</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-white">{adminStats.totalPlayers}</span>
                                        <span className="text-xs text-gray-400">ativos</span>
                                    </div>
                                    {adminStats.pendingPlayers > 0 && (
                                        <div className="mt-2 px-2 py-1 bg-yellow-500/20 rounded-lg inline-flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                                            <span className="text-xs font-bold text-yellow-400">
                                                {adminStats.pendingPlayers} pendente{adminStats.pendingPlayers > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                </article>

                                {/* Criar Times Card (Replaces Live Games) */}
                                <article
                                    className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 border border-white/5 shadow-lg cursor-pointer hover:bg-white/5 transition-all group"
                                    onClick={() => navigate("/admin/teams/define")}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-pink-500/20 rounded-xl">
                                            <Shield className="w-5 h-5 text-pink-400" />
                                        </div>
                                        <span className="text-sm font-bold text-white">Criar Times</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xs text-gray-400">Sortear e definir</span>
                                    </div>
                                    <div className="mt-2 px-2 py-1 bg-pink-500/10 rounded-lg inline-flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-pink-400">
                                            Nova rodada
                                        </span>
                                    </div>
                                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                </article>
                            </div>
                        </div>

                        {/* Próximo Jogo - Inside Admin Section */}
                        <div className="col-span-2 mt-4">
                            <h2 className="text-[16px] font-bold text-white mb-3 pl-1 tracking-tight flex items-center gap-2">
                                Próximo Jogo
                                <div className="h-px bg-white/10 flex-grow" />
                            </h2>

                            {loading ? (
                                <Skeleton className="h-36 w-full rounded-2xl" />
                            ) : nextMatch ? (
                                <article
                                    className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-5 flex flex-col min-h-[140px] border border-white/5 shadow-lg group cursor-pointer"
                                    onClick={() => navigate("/times")}
                                >
                                    <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-black/40 to-transparent" />

                                    <div className="relative z-10 flex items-center gap-4 mb-5">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center shadow-inner">
                                            <Calendar className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200 bg-pink-500/20 px-2.5 py-1 rounded-md border border-pink-500/20">
                                                    Rodada {nextMatch.round_number}
                                                </span>
                                            </div>
                                            <h3 className="text-[18px] font-bold text-white tracking-tight capitalize">
                                                {formatDate(nextMatch.scheduled_date)}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="relative z-10 mt-auto bg-black/40 rounded-xl p-3 border border-white/5 backdrop-blur-sm flex items-center justify-between">
                                        {nextMatch.user_team_name ? (
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                                                    style={{ backgroundColor: nextMatch.user_team_color || "#6b7280" }}
                                                >
                                                    {nextMatch.user_team_name.charAt(0)}
                                                </div>
                                                <span className="text-[13px] font-bold text-green-400">
                                                    ✓ Você está no {nextMatch.user_team_name}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                                                </div>
                                                <span className="text-[13px] font-bold text-gray-100">Escalação Pendente</span>
                                            </div>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-gray-300" />
                                    </div>
                                </article>
                            ) : (
                                <div className="bg-[#1c1c1e] rounded-2xl p-6 text-center border border-white/5">
                                    <Calendar className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                                    <div className="text-gray-400">Nenhum jogo agendado</div>
                                </div>
                            )}
                        </div>

                        {/* Estatísticas Section Header */}
                        <div className="col-span-2 mt-4">
                            <h2 className="text-[16px] font-bold text-white mb-3 pl-1 tracking-tight flex items-center gap-2">
                                Estatísticas
                                <div className="h-px bg-white/10 flex-grow" />
                            </h2>
                        </div>

                        {/* Top 5 Cards Inside Estatísticas for Admin */}
                        {/* Ranking Card */}
                        <article
                            className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 flex flex-col border border-white/5 shadow-lg group transition-transform duration-300 hover:-translate-y-1 cursor-pointer"
                            onClick={() => navigate("/classification")}
                        >
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />
                            <div className="relative z-10 flex justify-between items-start mb-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200 bg-pink-500/20 px-2 py-0.5 rounded-md border border-pink-500/20">
                                    Ranking
                                </span>
                            </div>
                            <div className="relative z-10 flex-grow flex flex-col gap-2">
                                {topRanking.length > 0 ? (
                                    <>
                                        <div className="flex items-end justify-between pb-2 mb-1 border-b border-white/10">
                                            <div>
                                                <span className="text-[9px] font-bold text-pink-300 uppercase tracking-wider block mb-0.5">1º LUGAR</span>
                                                <span className="text-lg font-black text-white leading-none">{topRanking[0]?.nickname?.toUpperCase()}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-bold text-pink-300 leading-none">{topRanking[0]?.pontos_totais}</span>
                                                <span className="text-[9px] text-gray-300 block uppercase font-bold">Pts</span>
                                            </div>
                                        </div>
                                        {topRanking.slice(1, 5).map((player, idx) => (
                                            <div key={player.player_id} className="flex items-center justify-between text-xs py-0.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="font-bold text-gray-400 w-3 text-center">{idx + 2}</span>
                                                    <span className="font-bold text-gray-100">{player.nickname?.toUpperCase()}</span>
                                                </div>
                                                <span className="font-bold text-white">{player.pontos_totais}</span>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="text-gray-400 text-sm">Sem dados</div>
                                )}
                            </div>
                        </article>

                        {/* Goals Card */}
                        <article
                            className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 flex flex-col border border-white/5 shadow-lg group transition-transform duration-300 hover:-translate-y-1 cursor-pointer"
                            onClick={() => navigate("/statistics")}
                        >
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />
                            <div className="relative z-10 flex justify-between items-start mb-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200 bg-pink-500/20 px-2 py-0.5 rounded-md border border-pink-500/20">
                                    Gols
                                </span>
                            </div>
                            <div className="relative z-10 flex-grow flex flex-col gap-2">
                                {topScorers.length > 0 ? (
                                    <>
                                        <div className="flex items-end justify-between pb-2 mb-1 border-b border-white/10">
                                            <div>
                                                <span className="text-[9px] font-bold text-pink-300 uppercase tracking-wider block mb-0.5">ARTILHEIRO</span>
                                                <span className="text-lg font-black text-white leading-none">{topScorers[0]?.nickname?.toUpperCase()}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-bold text-pink-300 leading-none">{topScorers[0]?.gols}</span>
                                                <span className="text-[9px] text-gray-300 block uppercase font-bold">Gols</span>
                                            </div>
                                        </div>
                                        {topScorers.slice(1, 5).map((player, idx) => (
                                            <div key={player.player_id} className="flex items-center justify-between text-xs py-0.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="font-bold text-gray-400 w-3 text-center">{idx + 2}</span>
                                                    <span className="font-bold text-gray-100">{player.nickname?.toUpperCase()}</span>
                                                </div>
                                                <span className="font-bold text-white">{player.gols}</span>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="text-gray-400 text-sm">Sem dados</div>
                                )}
                            </div>
                        </article>

                        {/* Assists Card */}
                        <article
                            className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 flex flex-col border border-white/5 shadow-lg group transition-transform duration-300 hover:-translate-y-1 cursor-pointer"
                            onClick={() => navigate("/statistics")}
                        >
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />
                            <div className="relative z-10 flex justify-between items-start mb-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200 bg-pink-500/20 px-2 py-0.5 rounded-md border border-pink-500/20">
                                    Assis.
                                </span>
                            </div>
                            <div className="relative z-10 flex-grow flex flex-col gap-2">
                                {topAssists.length > 0 ? (
                                    <>
                                        <div className="flex items-end justify-between pb-2 mb-1 border-b border-white/10">
                                            <div>
                                                <span className="text-[9px] font-bold text-pink-300 uppercase tracking-wider block mb-0.5">GARÇOM</span>
                                                <span className="text-lg font-black text-white leading-none">{topAssists[0]?.nickname?.toUpperCase()}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-bold text-pink-300 leading-none">{topAssists[0]?.assistencias}</span>
                                                <span className="text-[9px] text-gray-300 block uppercase font-bold">Ass.</span>
                                            </div>
                                        </div>
                                        {topAssists.slice(1, 5).map((player, idx) => (
                                            <div key={player.player_id} className="flex items-center justify-between text-xs py-0.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="font-bold text-gray-400 w-3 text-center">{idx + 2}</span>
                                                    <span className="font-bold text-gray-100">{player.nickname?.toUpperCase()}</span>
                                                </div>
                                                <span className="font-bold text-white">{player.assistencias}</span>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="text-gray-400 text-sm">Sem dados</div>
                                )}
                            </div>
                        </article>

                        {/* Últ. Rodada Card (for admin - compact version) */}
                        <article
                            className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 flex flex-col border border-white/5 shadow-lg group cursor-pointer transition-transform duration-300 hover:-translate-y-1"
                            onClick={() => navigate("/matches")}
                        >
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />
                            <div className="relative z-10 flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200 bg-pink-500/20 px-2 py-0.5 rounded-md border border-pink-500/20">
                                    Últ. Rodada
                                </span>
                            </div>
                            <div className="relative z-10 flex-grow flex flex-col gap-3 mt-1">
                                {adminLastRoundEvents ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="text-center">
                                            <span className="text-2xl font-black text-white">{adminLastRoundEvents.goals}</span>
                                            <span className="text-[10px] text-gray-400 block uppercase font-bold">Gols</span>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-2xl font-black text-white">{adminLastRoundEvents.assists}</span>
                                            <span className="text-[10px] text-gray-400 block uppercase font-bold">Assist.</span>
                                        </div>
                                        {adminLastRoundEvents.yellowCards > 0 && (
                                            <div className="text-center">
                                                <span className="text-2xl font-black text-yellow-400">{adminLastRoundEvents.yellowCards}</span>
                                                <span className="text-[10px] text-gray-400 block uppercase font-bold">Amarelo</span>
                                            </div>
                                        )}
                                        {adminLastRoundEvents.blueCards > 0 && (
                                            <div className="text-center">
                                                <span className="text-2xl font-black text-blue-400">{adminLastRoundEvents.blueCards}</span>
                                                <span className="text-[10px] text-gray-400 block uppercase font-bold">Azul</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-gray-400 text-sm text-center py-4">Sem dados</div>
                                )}
                            </div>
                        </article>
                    </>
                )}

                {/* Next Match Section - Only for non-admins */}
                {!isAdmin && (
                    <div className="col-span-2 mt-2">
                        <h2 className="text-[16px] font-bold text-white mb-3 pl-1 tracking-tight flex items-center gap-2">
                            Próximo Jogo
                            <div className="h-px bg-white/10 flex-grow" />
                        </h2>

                        {loading ? (
                            <Skeleton className="h-36 w-full rounded-2xl" />
                        ) : nextMatch ? (
                            <article
                                className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-5 flex flex-col min-h-[140px] border border-white/5 shadow-lg group cursor-pointer"
                                onClick={() => navigate("/times")}
                            >
                                <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-black/40 to-transparent" />

                                <div className="relative z-10 flex items-center gap-4 mb-5">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center shadow-inner">
                                        <Calendar className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200 bg-pink-500/20 px-2.5 py-1 rounded-md border border-pink-500/20">
                                                Rodada {nextMatch.round_number}
                                            </span>
                                        </div>
                                        <h3 className="text-[18px] font-bold text-white tracking-tight capitalize">
                                            {formatDate(nextMatch.scheduled_date)}
                                        </h3>
                                    </div>
                                </div>

                                <div className="relative z-10 mt-auto bg-black/40 rounded-xl p-3 border border-white/5 backdrop-blur-sm flex items-center justify-between">
                                    {nextMatch.user_team_name ? (
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                                                style={{ backgroundColor: nextMatch.user_team_color || "#6b7280" }}
                                            >
                                                {nextMatch.user_team_name.charAt(0)}
                                            </div>
                                            <span className="text-[13px] font-bold text-green-400">
                                                ✓ Você está no {nextMatch.user_team_name}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                                            </div>
                                            <span className="text-[13px] font-bold text-gray-100">Escalação Pendente</span>
                                        </div>
                                    )}
                                    <ChevronRight className="w-4 h-4 text-gray-300" />
                                </div>
                            </article>
                        ) : (
                            <div className="bg-[#1c1c1e] rounded-2xl p-6 text-center border border-white/5">
                                <Calendar className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                                <div className="text-gray-400">Nenhum jogo agendado</div>
                            </div>
                        )}
                    </div>
                )}

            </main>

            <Footer />
        </div>
    );
}
