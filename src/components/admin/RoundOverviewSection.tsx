import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MatchRowCompact, { TeamColor, MatchStatus } from './MatchRowCompact';
import { TrendingUp, TrendingDown, Minus, Goal, Target } from 'lucide-react';

// Helper to format time as HH:MM
const formatTime = (time: string | null): string => {
    if (!time) return '--:--';
    // Handle formats like "21:00:00" -> "21:00"
    const parts = time.split(':');
    if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
    }
    return time;
};

interface Match {
    id: string;
    round_id: string;
    match_number: number;
    team_home: TeamColor;
    team_away: TeamColor;
    score_home: number;
    score_away: number;
    status: string | null;
    started_at: string | null;
    finished_at: string | null;
    scheduled_time: string;
    match_timer_started_at: string | null;
}

interface Round {
    id: string;
    round_number: number;
    status: string;
    scheduled_date: string | null;
}

interface RoundStats {
    goals: number;
    assists: number;
}

type SectionState = 'active_round' | 'finished_round' | 'upcoming_matches' | 'none';

interface RoundOverviewSectionProps {
    isAdmin?: boolean;
}

const RoundOverviewSection: React.FC<RoundOverviewSectionProps> = ({ isAdmin = false }) => {
    const navigate = useNavigate();
    const [rounds, setRounds] = useState<Round[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [currentRoundStats, setCurrentRoundStats] = useState<RoundStats | null>(null);
    const [previousRoundStats, setPreviousRoundStats] = useState<RoundStats | null>(null);
    const [loading, setLoading] = useState(true);

    // Detect section state
    const sectionState = useMemo((): SectionState => {
        if (rounds.length === 0) return 'none';

        // Portuguese status values: a_iniciar, em_andamento, finalizada
        const activeRound = rounds.find(r => r.status === 'em_andamento');
        if (activeRound) return 'active_round';

        const scheduledRound = rounds.find(r => r.status === 'a_iniciar');
        const finishedRounds = rounds.filter(r => r.status === 'finalizada');

        if (scheduledRound && matches.some(m => m.round_id === scheduledRound.id)) {
            return 'upcoming_matches';
        }

        if (finishedRounds.length > 0) {
            return 'finished_round';
        }

        return 'none';
    }, [rounds, matches]);

    // Get the relevant round based on state
    const relevantRound = useMemo(() => {
        if (sectionState === 'active_round') {
            return rounds.find(r => r.status === 'em_andamento');
        }
        if (sectionState === 'upcoming_matches') {
            return rounds.find(r => r.status === 'a_iniciar');
        }
        if (sectionState === 'finished_round') {
            return rounds.filter(r => r.status === 'finalizada').sort((a, b) => b.round_number - a.round_number)[0];
        }
        return null;
    }, [rounds, sectionState]);

    // Filter matches for the relevant round
    const roundMatches = useMemo(() => {
        if (!relevantRound) return [];
        return matches
            .filter(m => m.round_id === relevantRound.id)
            .sort((a, b) => a.match_number - b.match_number);
    }, [matches, relevantRound]);

    // Categorize matches for active round view
    // Match status: not_started, in_progress, finished/finalizada
    const categorizedMatches = useMemo(() => {
        const finished = roundMatches.filter(m => m.status === 'finalizada' || m.status === 'finished');
        const inProgress = roundMatches.filter(m => m.status === 'in_progress');
        const scheduled = roundMatches.filter(m => m.status === 'not_started' || !m.status);

        return {
            previous: finished.slice(-2), // Last 2 finished
            current: inProgress[0] || null,
            upcoming: scheduled.slice(0, 2) // Next 2 scheduled
        };
    }, [roundMatches]);

    // Calculate match minutes
    const getMatchMinutes = (match: Match): number => {
        if (match.status !== 'in_progress' || !match.match_timer_started_at) return 0;
        const started = new Date(match.match_timer_started_at).getTime();
        const now = Date.now();
        return Math.floor((now - started) / 60000);
    };

    // Load data
    useEffect(() => {
        loadData();

        // Real-time subscription for matches
        const channel = supabase
            .channel('round_overview_matches')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'matches'
            }, () => loadData())
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'rounds'
            }, () => loadData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const loadData = async () => {
        try {
            // Load rounds
            const { data: roundsData } = await supabase
                .from('rounds')
                .select('*')
                .order('round_number', { ascending: false })
                .limit(5);

            if (roundsData) {
                setRounds(roundsData as Round[]);
            }

            // Load matches for recent rounds
            if (roundsData && roundsData.length > 0) {
                const roundIds = roundsData.map(r => r.id);
                const { data: matchesData } = await supabase
                    .from('matches')
                    .select('*')
                    .in('round_id', roundIds)
                    .order('match_number', { ascending: true });

                if (matchesData) {
                    setMatches(matchesData as Match[]);
                }

                // Load stats for comparison (last 2 finished rounds)
                const finishedRounds = roundsData.filter(r => r.status === 'finalizada').slice(0, 2);
                if (finishedRounds.length > 0) {
                    await loadRoundStats(finishedRounds[0].id, true);
                    if (finishedRounds.length > 1) {
                        await loadRoundStats(finishedRounds[1].id, false);
                    }
                }
            }
        } catch (error) {
            console.error('[RoundOverviewSection] Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadRoundStats = async (roundId: string, isCurrent: boolean) => {
        try {
            // Count goals
            const { data: goalsData } = await supabase
                .from('goals')
                .select('id, match:matches!inner(round_id)')
                .eq('match.round_id', roundId);

            // Count assists
            const { data: assistsData } = await supabase
                .from('assists')
                .select('id, goal:goals!inner(match:matches!inner(round_id))')
                .eq('goal.match.round_id', roundId);

            const stats: RoundStats = {
                goals: goalsData?.length || 0,
                assists: assistsData?.length || 0
            };

            if (isCurrent) {
                setCurrentRoundStats(stats);
            } else {
                setPreviousRoundStats(stats);
            }
        } catch (error) {
            console.error('[RoundOverviewSection] Error loading stats:', error);
        }
    };

    // Calculate comparison percentage
    const getComparison = () => {
        if (!currentRoundStats || !previousRoundStats) return null;

        const currentTotal = currentRoundStats.goals + currentRoundStats.assists;
        const previousTotal = previousRoundStats.goals + previousRoundStats.assists;

        if (previousTotal === 0) return null;

        const diff = ((currentTotal - previousTotal) / previousTotal) * 100;
        return Math.round(diff);
    };

    if (loading || sectionState === 'none') {
        return null;
    }

    const comparison = getComparison();

    // Render based on state
    const renderContent = () => {
        switch (sectionState) {
            case 'active_round':
                return (
                    <div className="rounded-2xl overflow-hidden border border-white/5">
                        {/* Previous matches */}
                        {categorizedMatches.previous.length > 0 && (
                            <>
                                <div className="px-3 py-2 bg-[#1c1c1e]">
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        Jogos Anteriores
                                    </h3>
                                </div>
                                {categorizedMatches.previous.map(match => (
                                    <MatchRowCompact
                                        key={match.id}
                                        matchId={match.id}
                                        roundId={match.round_id}
                                        teamHome={match.team_home}
                                        teamAway={match.team_away}
                                        scoreHome={match.score_home}
                                        scoreAway={match.score_away}
                                        status="finished"
                                        isAdmin={isAdmin}
                                    />
                                ))}
                            </>
                        )}

                        {/* Current match */}
                        {categorizedMatches.current && (
                            <>
                                <div className="px-3 py-2 bg-pink-500/10 border-t border-white/5">
                                    <h3 className="text-[10px] font-bold text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                                        Jogo Atual
                                    </h3>
                                </div>
                                <MatchRowCompact
                                    matchId={categorizedMatches.current.id}
                                    roundId={categorizedMatches.current.round_id}
                                    teamHome={categorizedMatches.current.team_home}
                                    teamAway={categorizedMatches.current.team_away}
                                    scoreHome={categorizedMatches.current.score_home}
                                    scoreAway={categorizedMatches.current.score_away}
                                    status="in_progress"
                                    minutes={getMatchMinutes(categorizedMatches.current)}
                                    isAdmin={isAdmin}
                                />
                            </>
                        )}

                        {/* Upcoming matches */}
                        {categorizedMatches.upcoming.length > 0 && (
                            <>
                                <div className="px-3 py-2 bg-[#1c1c1e] border-t border-white/5">
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        Próximos Jogos
                                    </h3>
                                </div>
                                {categorizedMatches.upcoming.map(match => (
                                    <MatchRowCompact
                                        key={match.id}
                                        matchId={match.id}
                                        roundId={match.round_id}
                                        teamHome={match.team_home}
                                        teamAway={match.team_away}
                                        scoreHome={match.score_home}
                                        scoreAway={match.score_away}
                                        status="scheduled"
                                        scheduledTime={formatTime(match.scheduled_time)}
                                        isAdmin={isAdmin}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                );

            case 'finished_round':
                return (
                    <div className="grid grid-cols-3 gap-3">
                        {/* Goals */}
                        <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center">
                            <div className="p-2 bg-emerald-500/20 rounded-xl mb-2">
                                <Goal className="w-5 h-5 text-emerald-400" />
                            </div>
                            <span className="text-2xl font-black text-white">{currentRoundStats?.goals || 0}</span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold">Gols</span>
                        </div>

                        {/* Assists */}
                        <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center">
                            <div className="p-2 bg-blue-500/20 rounded-xl mb-2">
                                <Target className="w-5 h-5 text-blue-400" />
                            </div>
                            <span className="text-2xl font-black text-white">{currentRoundStats?.assists || 0}</span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold">Assis.</span>
                        </div>

                        {/* Comparison */}
                        <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center">
                            <div className={`p-2 rounded-xl mb-2 ${comparison === null ? 'bg-gray-500/20' :
                                comparison > 0 ? 'bg-emerald-500/20' :
                                    comparison < 0 ? 'bg-red-500/20' : 'bg-gray-500/20'
                                }`}>
                                {comparison === null ? (
                                    <Minus className="w-5 h-5 text-gray-400" />
                                ) : comparison > 0 ? (
                                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                                ) : comparison < 0 ? (
                                    <TrendingDown className="w-5 h-5 text-red-400" />
                                ) : (
                                    <Minus className="w-5 h-5 text-gray-400" />
                                )}
                            </div>
                            <span className={`text-2xl font-black ${comparison === null ? 'text-gray-400' :
                                comparison > 0 ? 'text-emerald-400' :
                                    comparison < 0 ? 'text-red-400' : 'text-white'
                                }`}>
                                {comparison === null ? '--' : `${comparison > 0 ? '+' : ''}${comparison}%`}
                            </span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold text-center leading-tight">
                                vs Anterior
                            </span>
                        </div>
                    </div>
                );

            case 'upcoming_matches':
                return (
                    <div className="rounded-2xl overflow-hidden border border-white/5">
                        {roundMatches.slice(0, 2).map(match => (
                            <MatchRowCompact
                                key={match.id}
                                matchId={match.id}
                                roundId={match.round_id}
                                teamHome={match.team_home}
                                teamAway={match.team_away}
                                scoreHome={match.score_home}
                                scoreAway={match.score_away}
                                status="scheduled"
                                scheduledTime={formatTime(match.scheduled_time)}
                            />
                        ))}
                    </div>
                );

            default:
                return null;
        }
    };

    const getSectionTitle = () => {
        switch (sectionState) {
            case 'active_round':
                return `Rodada ${relevantRound?.round_number || ''} em andamento`;
            case 'finished_round':
                return 'Estatísticas Última Rodada';
            case 'upcoming_matches':
                return 'Próximos Jogos';
            default:
                return '';
        }
    };

    const handleTitleClick = () => {
        if (!relevantRound) return;

        if (isAdmin) {
            navigate(`/matches?roundId=${relevantRound.id}`);
        } else {
            navigate(`/matches?roundId=${relevantRound.id}`);
        }
    };

    return (
        <div className="col-span-2 mt-4">
            <h2
                onClick={handleTitleClick}
                className={`text-[16px] font-bold text-white mb-3 pl-1 tracking-tight flex items-center gap-2 ${relevantRound ? 'cursor-pointer hover:text-pink-300 transition-colors' : ''}`}
            >
                {getSectionTitle()}
                <div className="h-px bg-white/10 flex-grow" />
            </h2>
            {renderContent()}
        </div>
    );
};

export default RoundOverviewSection;
