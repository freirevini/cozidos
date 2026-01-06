import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
    ArrowLeft,
    UserX,
    Clock,
    Check,
    Users,
    AlertTriangle,
    Loader2,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Team color mapping matching home page style
const teamColors: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
    azul: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", gradient: "from-blue-500/20" },
    branco: { bg: "bg-slate-200/10", border: "border-slate-300/30", text: "text-slate-300", gradient: "from-slate-300/20" },
    preto: { bg: "bg-zinc-700/20", border: "border-zinc-500/30", text: "text-zinc-400", gradient: "from-zinc-500/20" },
    laranja: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", gradient: "from-orange-500/20" },
    vermelho: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", gradient: "from-red-500/20" },
};

const teamLabels: Record<string, string> = {
    azul: "Time Azul",
    branco: "Time Branco",
    preto: "Time Preto",
    laranja: "Time Laranja",
    vermelho: "Time Vermelho",
};

interface TeamPlayer {
    id: string;
    player_id: string;
    team_color: string;
    player: {
        id: string;
        nickname: string | null;
        name: string;
        avatar_url: string | null;
        level: string | null;
    };
}

interface Absence {
    id: string;
    round_id: string;
    player_id: string;
    original_team_color: string;
    status: "falta" | "atrasado";
}

interface Round {
    id: string;
    round_number: number;
    status: string;
    scheduled_date: string | null;
}

export default function ManageAttendance() {
    const { roundId } = useParams();
    const navigate = useNavigate();
    const { isAdmin } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [round, setRound] = useState<Round | null>(null);
    const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

    // Group players by team (including absent players from absences table)
    const playersByTeam = teamPlayers.reduce((acc, tp) => {
        if (!acc[tp.team_color]) acc[tp.team_color] = [];
        acc[tp.team_color].push(tp);
        return acc;
    }, {} as Record<string, TeamPlayer[]>);

    // Add absent players to their original teams for display
    const allPlayersByTeam = { ...playersByTeam };
    absences.forEach(absence => {
        if (!allPlayersByTeam[absence.original_team_color]) {
            allPlayersByTeam[absence.original_team_color] = [];
        }
    });

    const loadData = useCallback(async () => {
        if (!roundId) return;

        setLoading(true);
        try {
            // Load round info
            const { data: roundData } = await supabase
                .from("rounds")
                .select("*")
                .eq("id", roundId)
                .single();

            if (roundData) setRound(roundData);

            // Load team players for this round (includes level)
            const { data: tpData, error: tpError } = await supabase
                .from("round_team_players")
                .select(`
          id,
          player_id,
          team_color,
          player:profiles!round_team_players_player_id_fkey (
            id,
            nickname,
            name,
            avatar_url,
            level
          )
        `)
                .eq("round_id", roundId);

            if (tpError) throw tpError;
            setTeamPlayers((tpData || []) as unknown as TeamPlayer[]);

            // Expand all teams by default
            const teams = new Set((tpData || []).map(tp => tp.team_color));

            // Load existing absences
            const { data: absData } = await supabase
                .from("round_absences")
                .select("*")
                .eq("round_id", roundId);

            // Add absent player teams to expanded
            (absData || []).forEach(a => teams.add(a.original_team_color));
            setExpandedTeams(teams);
            setAbsences((absData || []) as Absence[]);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Erro ao carregar dados");
        } finally {
            setLoading(false);
        }
    }, [roundId]);

    useEffect(() => {
        if (!isAdmin) {
            toast.error("Acesso não autorizado");
            navigate("/");
            return;
        }
        loadData();
    }, [isAdmin, roundId, navigate, loadData]);

    const toggleTeamExpanded = (team: string) => {
        setExpandedTeams(prev => {
            const next = new Set(prev);
            if (next.has(team)) next.delete(team);
            else next.add(team);
            return next;
        });
    };

    const getPlayerStatus = (playerId: string): "presente" | "atrasado" | "falta" => {
        const absence = absences.find(a => a.player_id === playerId);
        if (!absence) return "presente";
        return absence.status;
    };

    const togglePlayerStatus = async (player: TeamPlayer, newStatus: "atrasado" | "falta" | "presente") => {
        setSaving(true);
        try {
            const existingAbsence = absences.find(a => a.player_id === player.player_id);
            const previousStatus = getPlayerStatus(player.player_id);

            if (newStatus === "presente") {
                // Remove absence record
                if (existingAbsence) {
                    await supabase
                        .from("round_absences")
                        .delete()
                        .eq("id", existingAbsence.id);

                    // If was "falta", add player back to team
                    if (previousStatus === "falta") {
                        await supabase
                            .from("round_team_players")
                            .insert({
                                round_id: roundId,
                                player_id: player.player_id,
                                team_color: existingAbsence.original_team_color,
                            });
                    }

                    setAbsences(prev => prev.filter(a => a.id !== existingAbsence.id));
                    toast.success(`${player.player.nickname || player.player.name} marcado como presente`);
                    await loadData(); // Reload to get updated team players
                }
            } else {
                // Add or update absence
                if (existingAbsence) {
                    // If changing from atrasado to falta, remove from team
                    if (previousStatus === "atrasado" && newStatus === "falta") {
                        await supabase
                            .from("round_team_players")
                            .delete()
                            .eq("round_id", roundId)
                            .eq("player_id", player.player_id);
                    }

                    await supabase
                        .from("round_absences")
                        .update({ status: newStatus })
                        .eq("id", existingAbsence.id);

                    setAbsences(prev => prev.map(a =>
                        a.id === existingAbsence.id ? { ...a, status: newStatus } : a
                    ));
                } else {
                    // New absence - if falta, remove from team
                    if (newStatus === "falta") {
                        await supabase
                            .from("round_team_players")
                            .delete()
                            .eq("round_id", roundId)
                            .eq("player_id", player.player_id);
                    }

                    const { data: newAbsence, error } = await supabase
                        .from("round_absences")
                        .insert({
                            round_id: roundId,
                            player_id: player.player_id,
                            original_team_color: player.team_color,
                            status: newStatus,
                        })
                        .select()
                        .single();

                    if (error) throw error;
                    setAbsences(prev => [...prev, newAbsence as Absence]);
                }

                const statusLabel = newStatus === "falta" ? "Faltou" : "Atrasou";
                toast.success(`${player.player.nickname || player.player.name} marcado como ${statusLabel}`);

                if (newStatus === "falta") {
                    toast.info("Jogador removido da escalação. Ao iniciar partidas, você escolherá um substituto.", {
                        duration: 5000
                    });
                    await loadData(); // Reload to update team view
                }
            }
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Erro ao atualizar status");
        } finally {
            setSaving(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "falta": return <UserX className="w-4 h-4 text-red-400" />;
            case "atrasado": return <Clock className="w-4 h-4 text-yellow-400" />;
            default: return <Check className="w-4 h-4 text-emerald-400" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "falta": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs px-2">Faltou</Badge>;
            case "atrasado": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs px-2">Atrasou</Badge>;
            default: return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-2">Presente</Badge>;
        }
    };

    const getLevelBadge = (level: string | null) => {
        if (!level) return null;
        const colors: Record<string, string> = {
            A: "bg-purple-500/20 text-purple-400 border-purple-500/30",
            B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
            C: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
            D: "bg-amber-500/20 text-amber-400 border-amber-500/30",
            E: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
        };
        return (
            <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", colors[level] || colors.C)}>
                {level}
            </span>
        );
    };

    // Get absent players info for display
    const getAbsentPlayersByTeam = () => {
        const result: Record<string, Array<{ playerId: string; nickname: string; level: string | null }>> = {};

        absences.filter(a => a.status === "falta").forEach(absence => {
            // Find player info from team players or need to fetch
            const tp = teamPlayers.find(t => t.player_id === absence.player_id);
            if (!result[absence.original_team_color]) {
                result[absence.original_team_color] = [];
            }
            if (tp) {
                result[absence.original_team_color].push({
                    playerId: absence.player_id,
                    nickname: tp.player.nickname || tp.player.name,
                    level: tp.player.level,
                });
            }
        });

        return result;
    };

    const totalAbsences = absences.filter(a => a.status === "falta").length;
    const totalLate = absences.filter(a => a.status === "atrasado").length;

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* Header - matching home page style */}
            <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
                <div className="px-4 py-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/admin/round/manage?round=${roundId}`)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold text-primary">Gestão de Presença</h1>
                            <p className="text-sm text-muted-foreground">
                                Rodada {round?.round_number} • {round?.scheduled_date ? new Date(round.scheduled_date).toLocaleDateString('pt-BR') : ''}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Card - matching home page card style */}
            <div className="px-4 py-4">
                <Card className="bg-card/50 border-border p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                                    <UserX className="w-4 h-4 text-red-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-red-400">{totalAbsences}</p>
                                    <p className="text-xs text-muted-foreground">Faltas</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                    <Clock className="w-4 h-4 text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-amber-400">{totalLate}</p>
                                    <p className="text-xs text-muted-foreground">Atrasos</p>
                                </div>
                            </div>
                        </div>
                        {totalAbsences > 0 && (
                            <div className="flex items-center gap-2 text-xs text-orange-400 bg-orange-500/10 px-3 py-2 rounded-lg border border-orange-500/20">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="font-medium">Substitutos necessários</span>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Instructions */}
            <div className="px-4 pb-3">
                <p className="text-xs text-muted-foreground text-center">
                    Toque no jogador para alternar: Presente → Atrasou → Faltou → Presente
                </p>
            </div>

            {/* Team Cards */}
            <div className="px-4 space-y-4">
                {Object.entries(allPlayersByTeam).map(([teamColor, players]) => {
                    const colors = teamColors[teamColor] || teamColors.branco;
                    const expanded = expandedTeams.has(teamColor);
                    const teamAbsences = absences.filter(a => a.original_team_color === teamColor);
                    const teamFaltas = teamAbsences.filter(a => a.status === "falta");
                    const hasFalta = teamFaltas.length > 0;

                    // Also include absent players in the display
                    const absentPlayers = teamFaltas.map(absence => {
                        const tp = teamPlayers.find(t => t.player_id === absence.player_id);
                        if (tp) return tp;
                        // If not found in current teamPlayers (was removed), create a placeholder
                        return null;
                    }).filter(Boolean) as TeamPlayer[];

                    // Combine current players with absent players for display
                    const allTeamPlayers = [...players];
                    absentPlayers.forEach(ap => {
                        if (!allTeamPlayers.some(p => p.player_id === ap.player_id)) {
                            allTeamPlayers.push(ap);
                        }
                    });

                    return (
                        <motion.div
                            key={teamColor}
                            className={cn(
                                "rounded-2xl overflow-hidden border",
                                colors.border,
                                "bg-card/30"
                            )}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {/* Team Header */}
                            <button
                                onClick={() => toggleTeamExpanded(teamColor)}
                                className={cn(
                                    "w-full flex items-center justify-between p-4",
                                    `bg-gradient-to-r ${colors.gradient} to-transparent`
                                )}
                            >
                                <div className="flex items-center gap-3 flex-wrap">
                                    <Users className={cn("w-5 h-5", colors.text)} />
                                    <span className={cn("font-bold text-lg", colors.text)}>
                                        {teamLabels[teamColor] || teamColor}
                                    </span>
                                    <Badge variant="outline" className="text-xs border-border">
                                        {allTeamPlayers.length} jogadores
                                    </Badge>
                                    {hasFalta && (
                                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                                            <UserX className="w-3 h-3 mr-1" />
                                            {teamFaltas.length} falta{teamFaltas.length > 1 ? 's' : ''}
                                        </Badge>
                                    )}
                                </div>
                                {expanded ? (
                                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                            </button>

                            {/* Player List */}
                            <AnimatePresence>
                                {expanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-3 pb-3 space-y-2">
                                            {allTeamPlayers.map((tp) => {
                                                const status = getPlayerStatus(tp.player_id);
                                                return (
                                                    <button
                                                        key={tp.id}
                                                        onClick={() => {
                                                            const nextStatus = status === "presente" ? "atrasado"
                                                                : status === "atrasado" ? "falta"
                                                                    : "presente";
                                                            togglePlayerStatus(tp, nextStatus);
                                                        }}
                                                        disabled={saving}
                                                        className={cn(
                                                            "w-full flex items-center justify-between p-3 rounded-xl transition-all",
                                                            "bg-card/50 hover:bg-card border border-border",
                                                            status === "falta" && "border-red-500/30 bg-red-500/5",
                                                            status === "atrasado" && "border-amber-500/30 bg-amber-500/5"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {/* Avatar */}
                                                            <div className={cn(
                                                                "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm",
                                                                status === "presente" && "bg-emerald-500/20 text-emerald-400",
                                                                status === "atrasado" && "bg-amber-500/20 text-amber-400",
                                                                status === "falta" && "bg-red-500/20 text-red-400"
                                                            )}>
                                                                {tp.player.avatar_url ? (
                                                                    <img
                                                                        src={tp.player.avatar_url}
                                                                        alt=""
                                                                        className="w-full h-full rounded-xl object-cover"
                                                                    />
                                                                ) : (
                                                                    (tp.player.nickname || tp.player.name).charAt(0).toUpperCase()
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-foreground">
                                                                    {tp.player.nickname || tp.player.name}
                                                                </span>
                                                                {getLevelBadge(tp.player.level)}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {getStatusIcon(status)}
                                                            {getStatusBadge(status)}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            {/* Fixed Bottom Actions */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
                <Button
                    onClick={() => navigate(`/admin/round/manage?round=${roundId}`)}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl"
                >
                    Concluir Gestão de Presença
                </Button>
            </div>
        </div>
    );
}
