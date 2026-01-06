import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, UserX, Users, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const teamColors: Record<string, { bg: string; border: string; text: string }> = {
    azul: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
    branco: { bg: "bg-slate-200/10", border: "border-slate-300/30", text: "text-slate-300" },
    preto: { bg: "bg-zinc-700/20", border: "border-zinc-500/30", text: "text-zinc-400" },
    laranja: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400" },
    vermelho: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400" },
};

const teamLabels: Record<string, string> = {
    azul: "Azul",
    branco: "Branco",
    preto: "Preto",
    laranja: "Laranja",
    vermelho: "Vermelho",
};

interface Absence {
    id: string;
    player_id: string;
    original_team_color: string;
    player: {
        nickname: string | null;
        name: string;
        level: string | null;
    };
}

interface AvailablePlayer {
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

interface SubstituteSelection {
    absenceId: string;
    substitutePlayerId: string | null;
}

interface AbsenceSubstituteModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    matchId: string;
    roundId: string;
    teamHome: string;
    teamAway: string;
    onSubstitutesConfirmed: () => void;
}

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
        <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded border", colors[level] || colors.C)}>
            {level}
        </span>
    );
};

export function AbsenceSubstituteModal({
    open,
    onOpenChange,
    matchId,
    roundId,
    teamHome,
    teamAway,
    onSubstitutesConfirmed,
}: AbsenceSubstituteModalProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
    const [selections, setSelections] = useState<SubstituteSelection[]>([]);

    useEffect(() => {
        if (open) {
            loadData();
        }
    }, [open, matchId, roundId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load absences for teams playing this match (with level)
            const { data: absenceData, error: absenceError } = await supabase
                .from("round_absences")
                .select(`
          id,
          player_id,
          original_team_color,
          player:profiles!round_absences_player_id_fkey (
            nickname,
            name,
            level
          )
        `)
                .eq("round_id", roundId)
                .eq("status", "falta")
                .in("original_team_color", [teamHome, teamAway]);

            if (absenceError) throw absenceError;

            const typedAbsences = (absenceData || []) as unknown as Absence[];
            setAbsences(typedAbsences);

            // Initialize selections
            setSelections(typedAbsences.map(a => ({ absenceId: a.id, substitutePlayerId: null })));

            // Check existing substitutes for this match
            const { data: existingSubs } = await supabase
                .from("match_absence_substitutes")
                .select("absence_id, substitute_player_id")
                .eq("match_id", matchId);

            if (existingSubs && existingSubs.length > 0) {
                setSelections(typedAbsences.map(a => {
                    const existing = existingSubs.find(s => s.absence_id === a.id);
                    return { absenceId: a.id, substitutePlayerId: existing?.substitute_player_id || null };
                }));
            }

            // Load players from teams NOT playing in this match (with level)
            const { data: allTeamPlayers, error: tpError } = await supabase
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
                .eq("round_id", roundId)
                .not("team_color", "in", `(${teamHome},${teamAway})`);

            if (tpError) throw tpError;
            setAvailablePlayers((allTeamPlayers || []) as unknown as AvailablePlayer[]);

        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Erro ao carregar dados");
        } finally {
            setLoading(false);
        }
    };

    const selectSubstitute = (absenceId: string, substitutePlayerId: string) => {
        setSelections(prev => prev.map(s =>
            s.absenceId === absenceId ? { ...s, substitutePlayerId } : s
        ));
    };

    const isPlayerSelected = (playerId: string) => {
        return selections.some(s => s.substitutePlayerId === playerId);
    };

    const allSelected = absences.length > 0 && selections.every(s => s.substitutePlayerId !== null);

    const handleConfirm = async () => {
        if (!allSelected) {
            toast.error("Selecione um substituto para cada jogador ausente");
            return;
        }

        setSaving(true);
        try {
            // Delete existing substitutes for this match
            await supabase
                .from("match_absence_substitutes")
                .delete()
                .eq("match_id", matchId);

            // Insert new substitutes
            const inserts = selections.map(s => {
                const absence = absences.find(a => a.id === s.absenceId);
                return {
                    match_id: matchId,
                    absence_id: s.absenceId,
                    substitute_player_id: s.substitutePlayerId,
                    team_color: absence?.original_team_color || teamHome,
                };
            });

            const { error } = await supabase
                .from("match_absence_substitutes")
                .insert(inserts);

            if (error) throw error;

            toast.success("Substitutos confirmados!");
            onOpenChange(false);
            onSubstitutesConfirmed();
        } catch (error) {
            console.error("Error saving substitutes:", error);
            toast.error("Erro ao salvar substitutos");
        } finally {
            setSaving(false);
        }
    };

    // Group available players by team
    const playersByTeam = availablePlayers.reduce((acc, p) => {
        if (!acc[p.team_color]) acc[p.team_color] = [];
        acc[p.team_color].push(p);
        return acc;
    }, {} as Record<string, AvailablePlayer[]>);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background border-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                            <UserX className="h-4 w-4 text-red-400" />
                        </div>
                        Selecionar Substitutos
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Escolha um jogador de outro time para substituir cada ausente
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : absences.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum jogador ausente nesta partida</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Absences to fill */}
                        {absences.map(absence => {
                            const colors = teamColors[absence.original_team_color] || teamColors.branco;
                            const selection = selections.find(s => s.absenceId === absence.id);
                            const selectedPlayer = availablePlayers.find(p => p.player_id === selection?.substitutePlayerId);

                            return (
                                <Card key={absence.id} className="p-4 border-border bg-card/50">
                                    {/* Absent player */}
                                    <div className={cn(
                                        "flex items-center gap-3 p-3 rounded-xl border mb-4",
                                        colors.border,
                                        colors.bg
                                    )}>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <UserX className="w-4 h-4 text-red-400" />
                                                <span className="font-medium text-foreground">
                                                    {absence.player.nickname || absence.player.name}
                                                </span>
                                                {getLevelBadge(absence.player.level)}
                                            </div>
                                            <span className={cn("text-xs", colors.text)}>
                                                Time {teamLabels[absence.original_team_color]} • Ausente
                                            </span>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-muted-foreground" />
                                        {selectedPlayer ? (
                                            <div className="flex items-center gap-2 bg-emerald-500/20 px-3 py-2 rounded-xl border border-emerald-500/30">
                                                <Check className="w-4 h-4 text-emerald-400" />
                                                <span className="text-sm font-medium text-emerald-400">
                                                    {selectedPlayer.player.nickname || selectedPlayer.player.name}
                                                </span>
                                                {getLevelBadge(selectedPlayer.player.level)}
                                            </div>
                                        ) : (
                                            <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10">
                                                Selecionar
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Available substitutes */}
                                    <div className="space-y-3">
                                        <p className="text-xs text-muted-foreground font-medium">
                                            Jogadores disponíveis (times que não jogam):
                                        </p>
                                        {Object.entries(playersByTeam).map(([teamColor, players]) => {
                                            const tColors = teamColors[teamColor] || teamColors.branco;
                                            return (
                                                <div key={teamColor} className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-3 h-3 rounded-full", tColors.bg, tColors.border, "border")} />
                                                        <span className={cn("text-xs font-medium", tColors.text)}>
                                                            Time {teamLabels[teamColor]}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 pl-5">
                                                        {players.map(p => {
                                                            const isSelected = selection?.substitutePlayerId === p.player_id;
                                                            const isUsedElsewhere = !isSelected && isPlayerSelected(p.player_id);

                                                            return (
                                                                <button
                                                                    key={p.id}
                                                                    onClick={() => !isUsedElsewhere && selectSubstitute(absence.id, p.player_id)}
                                                                    disabled={isUsedElsewhere}
                                                                    className={cn(
                                                                        "flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border",
                                                                        isSelected
                                                                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                                                            : isUsedElsewhere
                                                                                ? "bg-muted/20 text-muted-foreground cursor-not-allowed border-border/50 opacity-50"
                                                                                : "bg-card border-border text-foreground hover:bg-accent hover:border-primary/50"
                                                                    )}
                                                                >
                                                                    <span>{p.player.nickname || p.player.name}</span>
                                                                    {getLevelBadge(p.player.level)}
                                                                    {isSelected && <Check className="w-3 h-3" />}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Card>
                            );
                        })}

                        {/* Confirm button */}
                        <Button
                            onClick={handleConfirm}
                            disabled={!allSelected || saving}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Confirmar e Iniciar Partida
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
