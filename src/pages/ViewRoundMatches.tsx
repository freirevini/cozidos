import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TeamLogo } from "@/components/match/TeamLogo";
import { formatMatchTimer, formatEventMinute, getMatchCurrentMinute } from "@/lib/matchTimer";
import { ChevronRight } from "lucide-react";

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

const teamNames: Record<string, string> = {
    branco: "Branco",
    preto: "Preto",
    azul: "Azul",
    laranja: "Laranja",
};

export default function ViewRoundMatches() {
    const { roundId } = useParams();
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [round, setRound] = useState<any>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [, setTick] = useState(0);

    useEffect(() => {
        checkAdmin();
        loadRoundData();

        // Timer update for live matches
        const interval = setInterval(() => {
            setTick((t) => t + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [roundId]);

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)
                .single();

            if (data?.role !== "admin") {
                toast.error("Acesso não autorizado");
                navigate("/");
                return;
            }
            setIsAdmin(data?.role === "admin");
        } else {
            toast.error("Acesso não autorizado");
            navigate("/");
        }
    };

    const loadRoundData = async () => {
        try {
            const { data: roundData, error: roundError } = await supabase
                .from("rounds")
                .select("*")
                .eq("id", roundId)
                .single();

            if (roundError) throw roundError;
            setRound(roundData);

            const { data: matchesData, error: matchesError } = await supabase
                .from("matches")
                .select("*")
                .eq("round_id", roundId)
                .order("scheduled_time", { ascending: true });

            if (matchesError) throw matchesError;
            setMatches(matchesData || []);

        } catch (error: any) {
            console.error("Erro ao carregar dados:", error);
            toast.error("Erro ao carregar dados da rodada");
        } finally {
            setLoading(false);
        }
    };

    const getMatchCurrentState = (match: Match) => {
        // Calculate derived state for display (timer, etc)
        let timerDisplay = "";
        if (match.status === 'in_progress') {
            const currentMinute = getMatchCurrentMinute(
                match.match_timer_started_at,
                match.match_timer_paused_at,
                match.match_timer_total_paused_seconds
            );

            // Format as MM:SS if needed, but getMatchCurrentMinute returns integer minute
            // Let's us matchTimer lib logic for display if we want exact timer
            const now = Date.now();
            const startTime = match.match_timer_started_at ? new Date(match.match_timer_started_at).getTime() : now;
            const pausedAt = match.match_timer_paused_at ? new Date(match.match_timer_paused_at).getTime() : null;
            const totalPaused = (match.match_timer_total_paused_seconds || 0) * 1000;

            let elapsed = 0;
            if (pausedAt) {
                elapsed = pausedAt - startTime - totalPaused;
            } else {
                elapsed = now - startTime - totalPaused;
            }
            // Basic formatting
            const m = Math.floor(Math.max(0, elapsed) / 60000);
            const s = Math.floor((Math.max(0, elapsed) % 60000) / 1000);
            timerDisplay = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        } else if (match.status === 'finished') {
            timerDisplay = "Fim";
        } else {
            const date = new Date(match.scheduled_time);
            timerDisplay = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        return timerDisplay;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <main className="container mx-auto px-4 py-8">
                    <div className="text-center">Carregando...</div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        Rodada {round?.round_number}
                    </h1>
                    <Badge variant="outline">
                        {round && new Date(round.scheduled_date + "T00:00:00").toLocaleDateString('pt-BR')}
                    </Badge>
                </div>

                <div className="space-y-4">
                    {matches.map((match) => (
                        <Card key={match.id} className="overflow-hidden border-border bg-card/50">
                            <CardContent className="p-0">
                                <div className="flex flex-col">
                                    {/* Header Status */}
                                    <div className="bg-muted/30 px-4 py-2 flex justify-between items-center text-xs text-muted-foreground border-b border-border/50">
                                        <span>Jogo {match.match_number}</span>
                                        <span className={match.status === 'in_progress' ? "text-green-500 font-bold animate-pulse" : ""}>
                                            {match.status === 'not_started' && 'Não Iniciado'}
                                            {match.status === 'in_progress' && 'Em Andamento'}
                                            {match.status === 'finished' && 'Finalizado'}
                                        </span>
                                    </div>

                                    <div className="p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            {/* Home Team */}
                                            <div className="flex-1 flex flex-col items-center gap-2">
                                                <TeamLogo teamColor={match.team_home as any} size="lg" />
                                                <span className="font-semibold text-sm">{teamNames[match.team_home]}</span>
                                            </div>

                                            {/* Score */}
                                            <div className="flex flex-col items-center gap-1 min-w-[80px]">
                                                <div className="flex items-center gap-3 text-3xl font-bold bg-muted/20 px-4 py-2 rounded-lg">
                                                    <span>{match.score_home}</span>
                                                    <span className="text-muted-foreground text-xl">:</span>
                                                    <span>{match.score_away}</span>
                                                </div>
                                                <span className="text-xs font-mono text-muted-foreground mt-1">
                                                    {getMatchCurrentState(match)}
                                                </span>
                                            </div>

                                            {/* Away Team */}
                                            <div className="flex-1 flex flex-col items-center gap-2">
                                                <TeamLogo teamColor={match.team_away as any} size="lg" />
                                                <span className="font-semibold text-sm">{teamNames[match.team_away]}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/10 p-3 border-t border-border/50 flex justify-end">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="gap-1"
                                            onClick={() => navigate(`/match/${match.id}`)}
                                        >
                                            Ver Detalhes
                                            <ChevronRight size={16} />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {matches.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-lg">
                            Nenhuma partida encontrada nesta rodada.
                        </div>
                    )}
                </div>

                <div className="mt-8">
                    <Button
                        onClick={() => navigate("/admin/round")}
                        variant="outline"
                        className="w-full"
                    >
                        Voltar para Rodadas
                    </Button>
                </div>

            </main>
        </div>
    );
}
