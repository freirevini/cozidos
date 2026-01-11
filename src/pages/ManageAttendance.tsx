import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    ChevronUp,
    Undo2,
    UserPlus,
    ArrowLeftRight,
    UserCircle,
    Trash2
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
    player?: {
        id: string;
        nickname: string | null;
        name: string;
        avatar_url: string | null;
        level: string | null;
    };
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

    // Guest player states
    const [guestPool, setGuestPool] = useState<TeamPlayer[]>([]);
    const [showAddGuest, setShowAddGuest] = useState(false);
    const [guestName, setGuestName] = useState("");
    const [addingGuest, setAddingGuest] = useState(false);

    // Team swap states
    const [swapPlayer, setSwapPlayer] = useState<TeamPlayer | null>(null);
    const [showSwapModal, setShowSwapModal] = useState(false);

    const MAX_PLAYERS_PER_TEAM = 5;

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

            // Load team players for this round (includes level and is_guest)
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
                        level,
                        is_guest
                    )
                `)
                .eq("round_id", roundId);

            if (tpError) throw tpError;

            const allPlayers = (tpData || []) as unknown as (TeamPlayer & { player: { is_guest?: boolean } })[];

            // Separate regular players from guest pool (guests without team or with team)
            const regularPlayers = allPlayers.filter(p => !p.player?.is_guest);
            const guestPlayers = allPlayers.filter(p => p.player?.is_guest);

            setTeamPlayers(regularPlayers);
            setGuestPool(guestPlayers);

            // Expand all teams by default
            const teams = new Set(regularPlayers.map(tp => tp.team_color));

            // Load existing absences with player info
            const { data: absData } = await supabase
                .from("round_absences")
                .select(`
                    *,
                    player:profiles!round_absences_player_id_fkey (
                        id,
                        nickname,
                        name,
                        avatar_url,
                        level
                    )
                `)
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
                                team_color: existingAbsence.original_team_color as "azul" | "branco" | "preto" | "laranja",
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

    // Get count of players in each team (excluding absences)
    const getTeamPlayerCount = (teamColor: string): number => {
        const teamCount = teamPlayers.filter(p => p.team_color === teamColor).length;
        const guestCount = guestPool.filter(p => p.team_color === teamColor).length;
        const absentCount = absences.filter(a => a.original_team_color === teamColor && a.status === "falta").length;
        return teamCount + guestCount - absentCount;
    };

    // Create guest player
    const createGuest = async () => {
        if (!guestName.trim() || !roundId) return;

        setAddingGuest(true);
        try {
            const { data, error } = await supabase.rpc('create_guest_player', {
                p_name: guestName.trim(),
                p_round_id: roundId,
                p_team_color: null // Will be in pool, not assigned to team
            });

            if (error) throw error;

            const result = data as { success: boolean; player_id?: string; error?: string };

            if (!result.success) {
                throw new Error(result.error || 'Erro ao criar convidado');
            }

            toast.success(`Convidado "${guestName}" criado! Aloque-o em uma equipe.`);
            setGuestName("");
            setShowAddGuest(false);
            await loadData();
        } catch (error: any) {
            console.error("Error creating guest:", error);
            toast.error("Erro ao criar convidado: " + error.message);
        } finally {
            setAddingGuest(false);
        }
    };

    // Allocate guest to a team
    const allocateGuestToTeam = async (guest: TeamPlayer, teamColor: string) => {
        if (getTeamPlayerCount(teamColor) >= MAX_PLAYERS_PER_TEAM) {
            toast.error(`Time ${teamLabels[teamColor]} já possui ${MAX_PLAYERS_PER_TEAM} jogadores`);
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from("round_team_players")
                .update({ team_color: teamColor as "azul" | "branco" | "preto" | "laranja" })
                .eq("id", guest.id);

            if (error) throw error;

            toast.success(`${guest.player.nickname || guest.player.name} alocado para ${teamLabels[teamColor]}`);
            await loadData();
        } catch (error: any) {
            console.error("Error allocating guest:", error);
            toast.error("Erro ao alocar convidado: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Change player team
    const changePlayerTeam = async (player: TeamPlayer, newTeamColor: string) => {
        if (player.team_color === newTeamColor) {
            setShowSwapModal(false);
            setSwapPlayer(null);
            return;
        }

        if (getTeamPlayerCount(newTeamColor) >= MAX_PLAYERS_PER_TEAM) {
            toast.error(`Time ${teamLabels[newTeamColor]} já possui ${MAX_PLAYERS_PER_TEAM} jogadores`);
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from("round_team_players")
                .update({ team_color: newTeamColor as "azul" | "branco" | "preto" | "laranja" })
                .eq("id", player.id);

            if (error) throw error;

            toast.success(`${player.player.nickname || player.player.name} movido para ${teamLabels[newTeamColor]}`);
            setShowSwapModal(false);
            setSwapPlayer(null);
            await loadData();
        } catch (error: any) {
            console.error("Error changing team:", error);
            toast.error("Erro ao trocar de time: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Delete guest player
    const deleteGuest = async (guest: TeamPlayer) => {
        if (!confirm(`Remover convidado "${guest.player.nickname || guest.player.name}"?`)) {
            return;
        }

        setSaving(true);
        try {
            // Remove from round_team_players first
            await supabase
                .from("round_team_players")
                .delete()
                .eq("id", guest.id);

            // Optionally also delete the profile (or keep for historical data)
            // For now, just remove from round - profile stays

            toast.success(`Convidado "${guest.player.nickname || guest.player.name}" removido`);
            await loadData();
        } catch (error: any) {
            console.error("Error deleting guest:", error);
            toast.error("Erro ao excluir convidado: " + error.message);
        } finally {
            setSaving(false);
        }
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
            <div className="sticky top-0 z-40 bg-background border-b border-border">
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
                    Toque no jogador para alternar status. Use <ArrowLeftRight className="inline w-3 h-3 mx-1" /> para trocar de time.
                </p>
            </div>

            {/* Guest Players Section */}
            <div className="px-4 pb-4">
                <Card className="p-4 bg-card/40 border-border/50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <UserCircle className="w-5 h-5 text-purple-400" />
                            <span className="font-semibold text-foreground">Convidados</span>
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                                {guestPool.length}
                            </Badge>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowAddGuest(!showAddGuest)}
                            className="h-8 text-xs gap-1"
                        >
                            <UserPlus className="w-3 h-3" />
                            Novo Convidado
                        </Button>
                    </div>

                    {/* Add Guest Form */}
                    <AnimatePresence>
                        {showAddGuest && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-3"
                            >
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Nome do convidado"
                                        value={guestName}
                                        onChange={(e) => setGuestName(e.target.value)}
                                        className="flex-1 h-10"
                                        onKeyDown={(e) => e.key === "Enter" && createGuest()}
                                    />
                                    <Button
                                        onClick={createGuest}
                                        disabled={!guestName.trim() || addingGuest}
                                        className="h-10 px-4"
                                    >
                                        {addingGuest ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Guest Pool List */}
                    {guestPool.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                            Nenhum convidado. Clique em "Novo Convidado" para adicionar.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {guestPool.filter(g => !g.team_color || g.team_color === 'pool').map(guest => (
                                <div key={guest.id} className="flex items-center justify-between p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xs">
                                            {(guest.player.nickname || guest.player.name).charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-sm">{guest.player.nickname || guest.player.name}</span>
                                        <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">Convidado</Badge>
                                    </div>
                                    <div className="flex gap-1">
                                        {Object.keys(teamLabels).slice(0, 4).map(team => {
                                            const count = getTeamPlayerCount(team);
                                            const isFull = count >= MAX_PLAYERS_PER_TEAM;
                                            return (
                                                <Button
                                                    key={team}
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => allocateGuestToTeam(guest, team)}
                                                    disabled={isFull || saving}
                                                    className={cn(
                                                        "h-7 w-7 p-0 rounded-md",
                                                        teamColors[team]?.bg,
                                                        teamColors[team]?.border,
                                                        isFull && "opacity-50"
                                                    )}
                                                    title={`${teamLabels[team]} (${count}/${MAX_PLAYERS_PER_TEAM})`}
                                                >
                                                    <span className={cn("text-[10px] font-bold", teamColors[team]?.text)}>
                                                        {team.charAt(0).toUpperCase()}
                                                    </span>
                                                </Button>
                                            );
                                        })}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => deleteGuest(guest)}
                                            disabled={saving}
                                            className="h-7 w-7 p-0 rounded-md bg-red-500/10 border border-red-500/20 hover:bg-red-500/20"
                                            title="Excluir convidado"
                                        >
                                            <Trash2 className="w-3 h-3 text-red-400" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {/* Show allocated guests */}
                            {guestPool.filter(g => g.team_color && g.team_color !== 'pool').map(guest => (
                                <div key={guest.id} className="flex items-center justify-between p-2 rounded-lg bg-card/50 border border-border">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs",
                                            teamColors[guest.team_color]?.bg,
                                            teamColors[guest.team_color]?.text
                                        )}>
                                            {(guest.player.nickname || guest.player.name).charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-sm">{guest.player.nickname || guest.player.name}</span>
                                        <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">Convidado</Badge>
                                        <Badge className={cn("text-[10px]", teamColors[guest.team_color]?.bg, teamColors[guest.team_color]?.text)}>
                                            {teamLabels[guest.team_color]}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => { setSwapPlayer(guest); setShowSwapModal(true); }}
                                            className="h-7 w-7 p-0"
                                            title="Trocar de time"
                                        >
                                            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => deleteGuest(guest)}
                                            disabled={saving}
                                            className="h-7 w-7 p-0 bg-red-500/10 hover:bg-red-500/20"
                                            title="Excluir convidado"
                                        >
                                            <Trash2 className="w-3 h-3 text-red-400" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
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
                        // First try to find in teamPlayers (for atrasados that are still in team)
                        const tp = teamPlayers.find(t => t.player_id === absence.player_id);
                        if (tp) return tp;

                        // If not found (was removed due to falta), create from absence data
                        if (absence.player) {
                            return {
                                id: `absence-${absence.id}`,
                                player_id: absence.player_id,
                                team_color: absence.original_team_color,
                                player: absence.player
                            } as TeamPlayer;
                        }
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
                                                            {status === "falta" && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        togglePlayerStatus(tp, "presente");
                                                                    }}
                                                                    disabled={saving}
                                                                    className="ml-2 p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
                                                                    title="Chegou - Reverter falta"
                                                                >
                                                                    <Undo2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {status !== "falta" && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSwapPlayer(tp);
                                                                        setShowSwapModal(true);
                                                                    }}
                                                                    disabled={saving}
                                                                    className="ml-1 p-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground transition-colors"
                                                                    title="Trocar de time"
                                                                >
                                                                    <ArrowLeftRight className="w-4 h-4" />
                                                                </button>
                                                            )}
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

            {/* Bottom Actions */}
            <div className="px-4 pt-6 pb-24">
                <Button
                    onClick={() => navigate(`/admin/round/manage?round=${roundId}`)}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl"
                >
                    Concluir Gestão de Presença
                </Button>
            </div>

            {/* Team Swap Modal */}
            <AnimatePresence>
                {showSwapModal && swapPlayer && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                        onClick={() => { setShowSwapModal(false); setSwapPlayer(null); }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-card rounded-2xl p-6 w-full max-w-sm border border-border"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-foreground mb-2">Trocar de Time</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Mover <span className="font-semibold text-foreground">{swapPlayer.player.nickname || swapPlayer.player.name}</span> para:
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(teamLabels).slice(0, 4).map(([team, label]) => {
                                    const count = getTeamPlayerCount(team);
                                    const isFull = count >= MAX_PLAYERS_PER_TEAM;
                                    const isCurrent = team === swapPlayer.team_color;

                                    return (
                                        <Button
                                            key={team}
                                            variant="outline"
                                            onClick={() => changePlayerTeam(swapPlayer, team)}
                                            disabled={isFull || saving}
                                            className={cn(
                                                "h-14 flex-col gap-1",
                                                teamColors[team]?.bg,
                                                teamColors[team]?.border,
                                                isCurrent && "ring-2 ring-primary"
                                            )}
                                        >
                                            <span className={cn("font-bold", teamColors[team]?.text)}>{label}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {count}/{MAX_PLAYERS_PER_TEAM} jogadores
                                            </span>
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => { setShowSwapModal(false); setSwapPlayer(null); }}
                                className="w-full mt-4"
                            >
                                Cancelar
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
