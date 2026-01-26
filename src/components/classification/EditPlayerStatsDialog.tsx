import { useEffect, useState } from "react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PlayerStats } from "@/pages/Classification";

interface EditPlayerStatsDialogProps {
    player: PlayerStats;
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    season: number | null;
}

export function EditPlayerStatsDialog({ player, isOpen, onClose, onSave, season }: EditPlayerStatsDialogProps) {
    const [stats, setStats] = useState<Partial<PlayerStats>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Fetch the latest stats for the player for the given season
            const fetchStats = async () => {
                if (!season) {
                    toast.error("Temporada não selecionada.");
                    return;
                }
                setLoading(true);
                const { data, error } = await supabase
                    .from("player_rankings")
                    .select("*")
                    .eq("player_id", player.player_id)
                    .eq("season", season)
                    .single();

                if (error || !data) {
                    toast.error("Erro ao carregar estatísticas do jogador.");
                    console.error(error);
                    setStats({});
                } else {
                    setStats(data);
                }
                setLoading(false);
            };
            fetchStats();
        }
    }, [isOpen, player.player_id, season]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setStats(prev => ({ ...prev, [name]: value ? parseInt(value, 10) : null }));
    };

    const handleSave = async () => {
        if (!season) {
            toast.error("Temporada não selecionada.");
            return;
        }
        setLoading(true);
        const { error } = await supabase
            .from("player_rankings")
            .update(stats)
            .eq("player_id", player.player_id)
            .eq("season", season);

        setLoading(false);
        if (error) {
            toast.error("Erro ao salvar as alterações.");
            console.error(error);
        } else {
            toast.success("Estatísticas atualizadas com sucesso!");
            onSave();
            onClose();
        }
    };

    const fields: (keyof PlayerStats)[] = [
        'pontos_totais', 'presencas', 'vitorias', 'empates', 'derrotas', 'gols', 'assistencias', 'saldo_gols',
        'cartoes_amarelos', 'cartoes_azuis', 'atrasos', 'faltas', 'punicoes'
    ];

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Editar Estatísticas de {player.nickname}</AlertDialogTitle>
                    <AlertDialogDescription>
                        Temporada: {season}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {loading ? (
                    <div>Carregando...</div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {fields.map(field => (
                            <div key={field}>
                                <Label htmlFor={field}>{field.replace(/_/g, ' ')}</Label>
                                <Input
                                    id={field}
                                    name={field}
                                    type="number"
                                    value={stats[field] ?? ''}
                                    onChange={handleInputChange}
                                />
                            </div>
                        ))}
                    </div>
                )}
                <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                        <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Button onClick={handleSave} disabled={loading}>
                            {loading ? "Salvando..." : "Salvar"}
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
