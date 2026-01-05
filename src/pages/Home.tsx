import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileStats } from "@/hooks/useProfileStats";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Award, Calendar, ChevronRight, TrendingUp, LogOut, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderData {
    player_id: string;
    nickname: string;
    avatar_url: string | null;
    value: number;
}

interface UserStats {
    ranking_position: number | null;
    ranking_change: number;
    total_points: number;
    goals: number;
    assists: number;
    matches_played: number;
}

interface NextMatchData {
    round_id: string;
    round_number: number;
    scheduled_date: string;
    user_team_name: string | null;
    user_team_color: string | null;
    first_match: {
        team_a_name: string;
        team_a_color: string;
        team_b_name: string;
        team_b_color: string;
        scheduled_time: string | null;
    } | null;
}

export default function Home() {
    const navigate = useNavigate();
    const { user, profile, signOut } = useAuth();
    const [loading, setLoading] = useState(true);

    // Leaders data
    const [topRanking, setTopRanking] = useState<LeaderData | null>(null);
    const [topScorer, setTopScorer] = useState<LeaderData | null>(null);
    const [topAssist, setTopAssist] = useState<LeaderData | null>(null);

    // User stats
    const [userStats, setUserStats] = useState<UserStats>({
        ranking_position: null,
        ranking_change: 0,
        total_points: 0,
        goals: 0,
        assists: 0,
        matches_played: 0,
    });

    // Next match
    const [nextMatch, setNextMatch] = useState<NextMatchData | null>(null);

    const currentYear = new Date().getFullYear();

    // Use the same hook as Profile page for user's personal stats
    const { stats: userProfileStats, loading: statsLoading } = useProfileStats(profile?.id, currentYear, null);

    useEffect(() => {
        loadHomeData();
    }, [user, profile]);

    // Update user stats from hook
    useEffect(() => {
        if (userProfileStats && profile?.id) {
            setUserStats(prev => ({
                ...prev,
                goals: userProfileStats.gols,
                assists: userProfileStats.assistencias,
                matches_played: userProfileStats.partidas,
                total_points: userProfileStats.pontos_totais
            }));
        }
    }, [userProfileStats, profile]);

    const loadHomeData = async () => {
        if (!user) return;

        try {
            setLoading(true);

            // Load stats from player_round_stats for current year (same as Classification page)
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
                    round:rounds!inner(scheduled_date),
                    profile:profiles!inner(nickname, name, avatar_url, level, is_player, status)
                `)
                .gte("round.scheduled_date", `${currentYear}-01-01`)
                .lte("round.scheduled_date", `${currentYear}-12-31`);

            if (statsError) {
                console.error("[Home] Error loading round stats:", statsError);
            }

            // Aggregate stats by player
            const playerMap = new Map<string, {
                player_id: string;
                nickname: string;
                avatar_url: string | null;
                gols: number;
                assistencias: number;
                pontos_totais: number;
            }>();

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
                        nickname: rs.profile?.nickname || rs.profile?.name || 'Sem nome',
                        avatar_url: rs.profile?.avatar_url || null,
                        gols: rs.goals || 0,
                        assistencias: rs.assists || 0,
                        pontos_totais: rs.total_points || 0
                    });
                }
            });

            const playersArray = Array.from(playerMap.values());

            // Top ranking (by points)
            const sortedByPoints = [...playersArray].sort((a, b) => b.pontos_totais - a.pontos_totais);
            if (sortedByPoints.length > 0) {
                setTopRanking({
                    player_id: sortedByPoints[0].player_id,
                    nickname: sortedByPoints[0].nickname,
                    avatar_url: sortedByPoints[0].avatar_url,
                    value: sortedByPoints[0].pontos_totais,
                });

                // Find user position
                const userIdx = sortedByPoints.findIndex(p => p.player_id === profile?.id);
                if (userIdx !== -1) {
                    setUserStats(prev => ({
                        ...prev,
                        ranking_position: userIdx + 1,
                    }));
                }
            }

            // Top scorer (by goals)
            const sortedByGoals = [...playersArray].sort((a, b) => b.gols - a.gols);
            if (sortedByGoals.length > 0 && sortedByGoals[0].gols > 0) {
                setTopScorer({
                    player_id: sortedByGoals[0].player_id,
                    nickname: sortedByGoals[0].nickname,
                    avatar_url: sortedByGoals[0].avatar_url,
                    value: sortedByGoals[0].gols,
                });
            }

            // Top assists
            const sortedByAssists = [...playersArray].sort((a, b) => b.assistencias - a.assistencias);
            if (sortedByAssists.length > 0 && sortedByAssists[0].assistencias > 0) {
                setTopAssist({
                    player_id: sortedByAssists[0].player_id,
                    nickname: sortedByAssists[0].nickname,
                    avatar_url: sortedByAssists[0].avatar_url,
                    value: sortedByAssists[0].assistencias,
                });
            }

            // Load next scheduled round
            const { data: nextRound } = await supabase
                .from("rounds")
                .select("id, round_number, scheduled_date")
                .gte("scheduled_date", new Date().toISOString().split("T")[0])
                .order("scheduled_date", { ascending: true })
                .limit(1);

            if (nextRound && nextRound.length > 0 && profile?.id) {
                const roundId = nextRound[0].id;

                // Get user's team for this round
                const { data: userTeamData } = await supabase
                    .from("team_players")
                    .select(`team:teams!inner(id, name, color, round_id)`)
                    .eq("player_id", profile.id)
                    .eq("teams.round_id", roundId)
                    .limit(1);

                // Get first match of the round with teams
                const { data: matchData } = await supabase
                    .from("matches")
                    .select(`
                        id, match_order, scheduled_time,
                        team_a:teams!matches_team_a_id_fkey(id, name, color),
                        team_b:teams!matches_team_b_id_fkey(id, name, color)
                    `)
                    .eq("round_id", roundId)
                    .order("match_order", { ascending: true })
                    .limit(1);

                // Find the first match where user is playing
                let userMatch = null;
                if (userTeamData?.[0]?.team?.id) {
                    const userTeamId = userTeamData[0].team.id;
                    const { data: userMatchData } = await supabase
                        .from("matches")
                        .select(`
                            id, match_order, scheduled_time,
                            team_a:teams!matches_team_a_id_fkey(id, name, color),
                            team_b:teams!matches_team_b_id_fkey(id, name, color)
                        `)
                        .eq("round_id", roundId)
                        .or(`team_a_id.eq.${userTeamId},team_b_id.eq.${userTeamId}`)
                        .order("match_order", { ascending: true })
                        .limit(1);

                    if (userMatchData && userMatchData.length > 0) {
                        userMatch = userMatchData[0];
                    }
                }

                const firstMatch = userMatch || (matchData && matchData.length > 0 ? matchData[0] : null);

                setNextMatch({
                    round_id: roundId,
                    round_number: nextRound[0].round_number,
                    scheduled_date: nextRound[0].scheduled_date,
                    user_team_name: userTeamData?.[0]?.team?.name || null,
                    user_team_color: userTeamData?.[0]?.team?.color || null,
                    first_match: firstMatch ? {
                        team_a_name: firstMatch.team_a?.name || "Time A",
                        team_a_color: firstMatch.team_a?.color || "#6b7280",
                        team_b_name: firstMatch.team_b?.name || "Time B",
                        team_b_color: firstMatch.team_b?.color || "#6b7280",
                        scheduled_time: firstMatch.scheduled_time || null,
                    } : null,
                });
            }

        } catch (error) {
            console.error("Error loading home data:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + "T12:00:00");
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            day: 'numeric',
            month: 'short'
        };
        return date.toLocaleDateString('pt-BR', options);
    };

    const formatTime = (timeStr: string | null) => {
        if (!timeStr) return null;
        // timeStr is in format "HH:MM" or "HH:MM:SS"
        const parts = timeStr.split(":");
        return `${parts[0]}h${parts[1]}`;
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />

            <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl">
                {/* Greeting with Logout */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            👋 Olá, {profile?.nickname || profile?.name || "Jogador"}!
                        </h1>
                        <p className="text-muted-foreground">Temporada {currentYear}</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={signOut}
                        className="text-muted-foreground hover:text-destructive"
                    >
                        <LogOut className="w-4 h-4 mr-1" />
                        Sair
                    </Button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    {/* Classification Card */}
                    <StatCard
                        title="Classificação"
                        icon={<Trophy className="w-5 h-5" />}
                        loading={loading}
                        onClick={() => navigate("/classification")}
                        gradient="from-amber-500/20 to-orange-500/20"
                        iconColor="text-amber-400"
                    >
                        {topRanking ? (
                            <>
                                <div className="text-xs text-muted-foreground mb-1">Líder</div>
                                <div className="font-bold text-foreground truncate">{topRanking.nickname}</div>
                                <div className="text-primary font-bold">{topRanking.value} pts</div>
                                {userStats.ranking_position && (
                                    <div className="mt-2 pt-2 border-t border-border/30 text-xs">
                                        <span className="text-muted-foreground">Você: </span>
                                        <span className="font-bold text-foreground">#{userStats.ranking_position}</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-muted-foreground text-sm">Sem dados</div>
                        )}
                    </StatCard>

                    {/* Top Scorer Card */}
                    <StatCard
                        title="Artilheiro"
                        icon={<Target className="w-5 h-5" />}
                        loading={loading}
                        onClick={() => navigate("/statistics")}
                        gradient="from-red-500/20 to-pink-500/20"
                        iconColor="text-red-400"
                    >
                        {topScorer ? (
                            <>
                                <div className="text-xs text-muted-foreground mb-1">Líder</div>
                                <div className="font-bold text-foreground truncate">{topScorer.nickname}</div>
                                <div className="text-primary font-bold">{topScorer.value} gols</div>
                                <div className="mt-2 pt-2 border-t border-border/30 text-xs">
                                    <span className="text-muted-foreground">Você: </span>
                                    <span className="font-bold text-foreground">{userStats.goals} gols</span>
                                </div>
                            </>
                        ) : (
                            <div className="text-muted-foreground text-sm">Sem dados</div>
                        )}
                    </StatCard>

                    {/* Top Assists Card */}
                    <StatCard
                        title="Assistências"
                        icon={<Award className="w-5 h-5" />}
                        loading={loading}
                        onClick={() => navigate("/statistics")}
                        gradient="from-blue-500/20 to-cyan-500/20"
                        iconColor="text-blue-400"
                    >
                        {topAssist ? (
                            <>
                                <div className="text-xs text-muted-foreground mb-1">Líder</div>
                                <div className="font-bold text-foreground truncate">{topAssist.nickname}</div>
                                <div className="text-primary font-bold">{topAssist.value} assist.</div>
                                <div className="mt-2 pt-2 border-t border-border/30 text-xs">
                                    <span className="text-muted-foreground">Você: </span>
                                    <span className="font-bold text-foreground">{userStats.assists} assist.</span>
                                </div>
                            </>
                        ) : (
                            <div className="text-muted-foreground text-sm">Sem dados</div>
                        )}
                    </StatCard>

                    {/* My Profile Card */}
                    <StatCard
                        title="Meu Perfil"
                        icon={<TrendingUp className="w-5 h-5" />}
                        loading={loading || statsLoading}
                        onClick={() => navigate("/profile")}
                        gradient="from-purple-500/20 to-violet-500/20"
                        iconColor="text-purple-400"
                    >
                        <div className="text-xs text-muted-foreground mb-1">Resumo</div>
                        <div className="font-bold text-foreground">{userStats.total_points} pontos</div>
                        <div className="text-primary font-bold">{userStats.matches_played} jogos</div>
                        <div className="mt-2 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                            Ver estatísticas completas →
                        </div>
                    </StatCard>
                </div>

                {/* Next Match Section */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        Próximo Jogo
                    </h2>

                    {loading ? (
                        <Skeleton className="h-40 w-full rounded-xl" />
                    ) : nextMatch ? (
                        <div
                            className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-all"
                            onClick={() => navigate("/times")}
                        >
                            {/* Date and Time Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-muted-foreground">
                                    Rodada {nextMatch.round_number}
                                </div>
                                <div className="flex items-center gap-2">
                                    {nextMatch.first_match?.scheduled_time && (
                                        <span className="flex items-center gap-1 text-sm font-medium text-primary">
                                            <Clock className="w-4 h-4" />
                                            {formatTime(nextMatch.first_match.scheduled_time)}
                                        </span>
                                    )}
                                    <span className="text-sm font-medium text-primary capitalize">
                                        {formatDate(nextMatch.scheduled_date)}
                                    </span>
                                </div>
                            </div>

                            {/* Match Teams Display */}
                            {nextMatch.first_match ? (
                                <div className="space-y-3">
                                    {/* Teams vs Display */}
                                    <div className="flex items-center justify-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                                                style={{ backgroundColor: nextMatch.first_match.team_a_color }}
                                            >
                                                {nextMatch.first_match.team_a_name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-foreground text-sm">{nextMatch.first_match.team_a_name}</span>
                                        </div>
                                        <span className="text-muted-foreground font-bold">vs</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-foreground text-sm">{nextMatch.first_match.team_b_name}</span>
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                                                style={{ backgroundColor: nextMatch.first_match.team_b_color }}
                                            >
                                                {nextMatch.first_match.team_b_name.charAt(0)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* User's Team Status */}
                                    {nextMatch.user_team_name ? (
                                        <div className="flex items-center justify-center gap-2 pt-2 border-t border-border/30">
                                            <div
                                                className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                                                style={{ backgroundColor: nextMatch.user_team_color || "#6b7280" }}
                                            >
                                                {nextMatch.user_team_name.charAt(0)}
                                            </div>
                                            <span className="text-sm text-green-400">
                                                ✓ Você está no {nextMatch.user_team_name}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="text-center pt-2 border-t border-border/30">
                                            <span className="text-sm text-muted-foreground">
                                                Escalação pendente
                                            </span>
                                        </div>
                                    )}

                                    {/* View Button */}
                                    <div className="flex items-center justify-center pt-2">
                                        <span className="text-xs text-primary flex items-center gap-1">
                                            Ver Escalação <ChevronRight className="w-4 h-4" />
                                        </span>
                                    </div>
                                </div>
                            ) : nextMatch.user_team_name ? (
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                                        style={{ backgroundColor: nextMatch.user_team_color || "#6b7280" }}
                                    >
                                        {nextMatch.user_team_name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-foreground">{nextMatch.user_team_name}</div>
                                        <div className="text-sm text-green-400">✓ Você está escalado</div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <div className="text-muted-foreground">Escalação pendente</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Fique atento às atualizações
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-muted/30 border border-border/50 rounded-xl p-6 text-center">
                            <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <div className="text-muted-foreground">Nenhum jogo agendado</div>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                    <QuickActionButton
                        label="Ver Classificação Completa"
                        onClick={() => navigate("/classification")}
                    />
                    <QuickActionButton
                        label="Ver Histórico de Rodadas"
                        onClick={() => navigate("/matches")}
                    />
                </div>
            </main>

            <Footer />
        </div>
    );
}

// Helper Components
function StatCard({
    title,
    icon,
    loading,
    onClick,
    gradient,
    iconColor,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    loading: boolean;
    onClick: () => void;
    gradient: string;
    iconColor: string;
    children: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                "bg-gradient-to-br rounded-xl p-4 border border-border/50 cursor-pointer",
                "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all",
                gradient
            )}
            onClick={onClick}
        >
            <div className="flex items-center gap-2 mb-2">
                <div className={iconColor}>{icon}</div>
                <span className="text-sm font-medium text-foreground">{title}</span>
            </div>

            {loading ? (
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16" />
                </div>
            ) : (
                children
            )}
        </div>
    );
}

function QuickActionButton({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 border border-border/30 rounded-xl transition-all"
        >
            <span className="text-foreground font-medium">{label}</span>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
    );
}
