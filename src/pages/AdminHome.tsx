import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Trophy, Target, Calendar, Users, ChevronRight,
    LogOut, AlertCircle, Plus, Settings, BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminStats {
    totalPlayers: number;
    pendingApprovals: number;
    totalRounds: number;
    pendingRounds: number;
    totalGoals: number;
    topScorer: { nickname: string; goals: number } | null;
    topRanking: { nickname: string; points: number } | null;
}

export default function AdminHome() {
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<AdminStats>({
        totalPlayers: 0,
        pendingApprovals: 0,
        totalRounds: 0,
        pendingRounds: 0,
        totalGoals: 0,
        topScorer: null,
        topRanking: null,
    });

    useEffect(() => {
        loadAdminStats();
    }, []);

    const loadAdminStats = async () => {
        try {
            setLoading(true);

            // Load pending approvals count
            const { count: pendingCount } = await supabase
                .from("profiles")
                .select("*", { count: "exact", head: true })
                .eq("status", "pendente")
                .eq("is_player", true);

            // Load total active players
            const { count: playersCount } = await supabase
                .from("profiles")
                .select("*", { count: "exact", head: true })
                .eq("status", "aprovado")
                .eq("is_player", true);

            // Load rounds stats
            const { data: roundsData } = await supabase
                .from("rounds")
                .select("id, status")
                .eq("season", new Date().getFullYear());

            const totalRounds = roundsData?.length || 0;
            const pendingRounds = roundsData?.filter(r => r.status !== "finalizada").length || 0;

            // Load top scorer
            const { data: scorerData } = await supabase
                .from("player_rankings")
                .select("nickname, gols")
                .order("gols", { ascending: false })
                .limit(1);

            // Load top ranking
            const { data: rankingData } = await supabase
                .from("player_rankings")
                .select("nickname, pontos_totais")
                .order("pontos_totais", { ascending: false })
                .limit(1);

            // Load total goals
            const { data: goalsData } = await supabase
                .from("player_rankings")
                .select("gols");

            const totalGoals = goalsData?.reduce((sum, p) => sum + (p.gols || 0), 0) || 0;

            setStats({
                totalPlayers: playersCount || 0,
                pendingApprovals: pendingCount || 0,
                totalRounds,
                pendingRounds,
                totalGoals,
                topScorer: scorerData?.[0] ? { nickname: scorerData[0].nickname, goals: scorerData[0].gols } : null,
                topRanking: rankingData?.[0] ? { nickname: rankingData[0].nickname, points: rankingData[0].pontos_totais } : null,
            });

        } catch (error) {
            console.error("Error loading admin stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const currentYear = new Date().getFullYear();

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />

            <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl">
                {/* Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            <h1 className="text-xl font-bold text-foreground">Admin: Cozidos FC</h1>
                        </div>
                        <p className="text-muted-foreground text-sm">Temporada {currentYear}</p>
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

                {/* Pending Approvals Alert */}
                {stats.pendingApprovals > 0 && (
                    <div
                        className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-xl cursor-pointer hover:bg-destructive/20 transition-all"
                        onClick={() => navigate("/admin/players")}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-destructive/20 rounded-full">
                                <AlertCircle className="w-5 h-5 text-destructive" />
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-foreground">
                                    {stats.pendingApprovals} aprovação{stats.pendingApprovals > 1 ? "ões" : ""} pendente{stats.pendingApprovals > 1 ? "s" : ""}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Jogadores aguardando aprovação
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    {/* Ranking Card */}
                    <StatCard
                        title="Ranking"
                        icon={<Trophy className="w-5 h-5" />}
                        loading={loading}
                        onClick={() => navigate("/classification")}
                        gradient="from-amber-500/20 to-orange-500/20"
                        iconColor="text-amber-400"
                    >
                        {stats.topRanking ? (
                            <>
                                <div className="text-xs text-muted-foreground mb-1">Líder</div>
                                <div className="font-bold text-foreground truncate">{stats.topRanking.nickname}</div>
                                <div className="text-primary font-bold">{stats.topRanking.points} pts</div>
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
                        {stats.topScorer ? (
                            <>
                                <div className="text-xs text-muted-foreground mb-1">Líder</div>
                                <div className="font-bold text-foreground truncate">{stats.topScorer.nickname}</div>
                                <div className="text-primary font-bold">{stats.topScorer.goals} gols</div>
                            </>
                        ) : (
                            <div className="text-muted-foreground text-sm">Sem dados</div>
                        )}
                    </StatCard>

                    {/* Rounds Card */}
                    <StatCard
                        title="Rodadas"
                        icon={<Calendar className="w-5 h-5" />}
                        loading={loading}
                        onClick={() => navigate("/admin/round/manage")}
                        gradient="from-blue-500/20 to-cyan-500/20"
                        iconColor="text-blue-400"
                    >
                        <div className="text-xs text-muted-foreground mb-1">Temporada</div>
                        <div className="font-bold text-foreground">{stats.totalRounds} rodadas</div>
                        {stats.pendingRounds > 0 && (
                            <div className="text-amber-400 text-sm">{stats.pendingRounds} em andamento</div>
                        )}
                    </StatCard>

                    {/* Players Card */}
                    <StatCard
                        title="Jogadores"
                        icon={<Users className="w-5 h-5" />}
                        loading={loading}
                        onClick={() => navigate("/admin/players")}
                        gradient="from-purple-500/20 to-violet-500/20"
                        iconColor="text-purple-400"
                    >
                        <div className="text-xs text-muted-foreground mb-1">Ativos</div>
                        <div className="font-bold text-foreground">{stats.totalPlayers} jogadores</div>
                        {stats.pendingApprovals > 0 && (
                            <div className="text-destructive text-sm">{stats.pendingApprovals} pendentes</div>
                        )}
                    </StatCard>
                </div>

                {/* Quick Actions */}
                <div className="mb-4">
                    <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        ⚡ AÇÕES RÁPIDAS
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                        <ActionButton
                            icon={<Plus className="w-4 h-4" />}
                            label="Nova Rodada"
                            onClick={() => navigate("/admin/round")}
                            variant="primary"
                        />
                        <ActionButton
                            icon={<Users className="w-4 h-4" />}
                            label="Jogadores"
                            onClick={() => navigate("/admin/players")}
                        />
                        <ActionButton
                            icon={<Trophy className="w-4 h-4" />}
                            label="Classificação"
                            onClick={() => navigate("/classification")}
                        />
                        <ActionButton
                            icon={<BarChart3 className="w-4 h-4" />}
                            label="Estatísticas"
                            onClick={() => navigate("/statistics")}
                        />
                    </div>
                </div>

                {/* Secondary Actions */}
                <div className="space-y-2">
                    <QuickLink label="Gerenciar Times" onClick={() => navigate("/admin/teams/manage")} />
                    <QuickLink label="Gerenciar Rodadas" onClick={() => navigate("/admin/round/manage")} />
                    <QuickLink label="Ver Histórico de Partidas" onClick={() => navigate("/matches")} />
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

function ActionButton({
    icon,
    label,
    onClick,
    variant = "default",
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: "default" | "primary";
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-all",
                variant === "primary"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted/30 hover:bg-muted/50 text-foreground border border-border/30"
            )}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function QuickLink({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center justify-between p-3 bg-muted/10 hover:bg-muted/30 border border-border/20 rounded-xl transition-all text-sm"
        >
            <span className="text-muted-foreground">{label}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
    );
}
