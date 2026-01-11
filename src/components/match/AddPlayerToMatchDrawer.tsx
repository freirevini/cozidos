import { useState, useEffect } from "react";
import { UserPlus, Check, X, Loader2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TeamLogo } from "@/components/match/TeamLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerFooter,
    DrawerClose,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TeamColor = "branco" | "preto" | "azul" | "laranja";

interface Player {
    id: string;
    name: string;
    nickname: string | null;
    avatar_url: string | null;
    level: string | null;
}

interface AddPlayerToMatchDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teamHome: TeamColor;
    teamAway: TeamColor;
    roundId: string;
    existingPlayerIds: string[];
    onPlayerAdded: () => void;
}

const teamNames: Record<string, string> = {
    branco: "Branco",
    preto: "Preto",
    azul: "Azul",
    laranja: "Laranja",
};

export function AddPlayerToMatchDrawer({
    open,
    onOpenChange,
    teamHome,
    teamAway,
    roundId,
    existingPlayerIds,
    onPlayerAdded,
}: AddPlayerToMatchDrawerProps) {
    const [activeTab, setActiveTab] = useState<"existing" | "guest">("existing");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTeam, setSelectedTeam] = useState<string>("");
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [guestName, setGuestName] = useState("");
    const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    // Load available players when drawer opens
    useEffect(() => {
        if (open) {
            loadAvailablePlayers();
        }
    }, [open, existingPlayerIds]);

    const loadAvailablePlayers = async () => {
        setLoadingPlayers(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, name, nickname, avatar_url, level")
                .eq("is_player", true)
                .eq("status", "aprovado")
                .or("is_guest.is.null,is_guest.eq.false")
                .order("nickname", { ascending: true, nullsFirst: false });

            if (error) throw error;

            // Filter out players already in the match
            const filtered = (data || []).filter(
                (player) => !existingPlayerIds.includes(player.id)
            );

            setAvailablePlayers(filtered);
        } catch (error) {
            console.error("Erro ao carregar jogadores:", error);
            toast.error("Erro ao carregar lista de jogadores");
        } finally {
            setLoadingPlayers(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        setSearchTerm("");
        setSelectedTeam("");
        setSelectedPlayer(null);
        setGuestName("");
        setActiveTab("existing");
    };

    const handleSubmitExisting = async () => {
        if (!selectedPlayer || !selectedTeam) {
            toast.error("Selecione o jogador e o time");
            return;
        }

        setLoading(true);
        try {
            // Insert into round_team_players
            const { error } = await supabase
                .from("round_team_players")
                .insert({
                    round_id: roundId,
                    player_id: selectedPlayer.id,
                    team_color: selectedTeam as TeamColor,
                });

            if (error) {
                if (error.code === "23505") {
                    toast.error("Este jogador já está na escalação");
                } else {
                    throw error;
                }
                return;
            }

            toast.success(`${selectedPlayer.nickname || selectedPlayer.name} adicionado ao time ${teamNames[selectedTeam]}!`);
            onPlayerAdded();
            handleClose();
        } catch (error: any) {
            console.error("Erro ao adicionar jogador:", error);
            toast.error("Erro ao adicionar jogador: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitGuest = async () => {
        if (!guestName.trim() || !selectedTeam) {
            toast.error("Preencha o nome e selecione o time");
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('create_guest_player', {
                p_name: guestName.trim(),
                p_round_id: roundId,
                p_team_color: selectedTeam,
            });

            if (error) throw error;

            const result = data as { success: boolean; error?: string; player_id?: string };

            if (!result.success) {
                throw new Error(result.error || 'Erro ao criar jogador avulso');
            }

            toast.success(`${guestName} adicionado como avulso!`);
            onPlayerAdded();
            handleClose();
        } catch (error: any) {
            console.error("Erro ao adicionar avulso:", error);
            toast.error("Erro ao adicionar avulso: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = () => {
        if (activeTab === "existing") {
            handleSubmitExisting();
        } else {
            handleSubmitGuest();
        }
    };

    // Filter players by search term
    const filteredPlayers = availablePlayers.filter((player) => {
        const searchLower = searchTerm.toLowerCase();
        return (
            player.name.toLowerCase().includes(searchLower) ||
            (player.nickname && player.nickname.toLowerCase().includes(searchLower))
        );
    });

    const getPlayerInitials = (player: Player) => {
        const name = player.nickname || player.name;
        return name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    };

    const getPlayerDisplay = (player: Player) => {
        return player.nickname || player.name.split(" ")[0];
    };

    const isValidExisting = selectedPlayer !== null && selectedTeam !== "";
    const isValidGuest = guestName.trim().length > 0 && selectedTeam !== "";
    const isValid = activeTab === "existing" ? isValidExisting : isValidGuest;

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="max-h-[90vh]">
                <DrawerHeader className="border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <DrawerTitle className="text-primary flex items-center gap-2">
                            <UserPlus size={20} />
                            Adicionar à Escalação
                        </DrawerTitle>
                        <DrawerClose asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10">
                                <X size={18} />
                            </Button>
                        </DrawerClose>
                    </div>
                </DrawerHeader>

                <div className="overflow-y-auto px-4 py-4 space-y-4">
                    {/* Tabs for existing player vs guest */}
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "existing" | "guest")}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="existing" className="flex items-center gap-2">
                                <Users size={16} />
                                Jogador Cadastrado
                            </TabsTrigger>
                            <TabsTrigger value="guest" className="flex items-center gap-2">
                                <UserPlus size={16} />
                                Convidado
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="existing" className="mt-4 space-y-4">
                            {/* Team Selection */}
                            <div>
                                <p className="text-sm text-muted-foreground mb-3">Qual time?</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {([teamHome, teamAway] as TeamColor[]).map((team) => (
                                        <Button
                                            key={team}
                                            variant={selectedTeam === team ? "default" : "outline"}
                                            className={`h-14 rounded-xl ${selectedTeam === team ? "bg-primary ring-2 ring-primary" : ""}`}
                                            onClick={() => setSelectedTeam(team)}
                                        >
                                            <TeamLogo teamColor={team} size="sm" className="mr-2" />
                                            {teamNames[team]}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Player Search */}
                            {selectedTeam && (
                                <div>
                                    <p className="text-sm text-muted-foreground mb-3">Buscar jogador:</p>
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Digite o nome do jogador..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="h-12 pl-10 text-base"
                                        />
                                    </div>

                                    {/* Player List */}
                                    {loadingPlayers ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    ) : filteredPlayers.length === 0 ? (
                                        <p className="text-center text-muted-foreground py-8">
                                            {searchTerm ? "Nenhum jogador encontrado" : "Todos os jogadores já estão na partida"}
                                        </p>
                                    ) : (
                                        <div className="space-y-2 max-h-[220px] overflow-y-auto">
                                            {filteredPlayers.slice(0, 30).map((player) => (
                                                <Button
                                                    key={player.id}
                                                    variant={selectedPlayer?.id === player.id ? "default" : "outline"}
                                                    className={`w-full h-14 justify-start gap-3 rounded-xl ${selectedPlayer?.id === player.id
                                                        ? "bg-primary ring-2 ring-primary"
                                                        : ""
                                                        }`}
                                                    onClick={() => setSelectedPlayer(player)}
                                                >
                                                    <Avatar className="h-9 w-9 border border-border/50">
                                                        <AvatarImage src={player.avatar_url || undefined} />
                                                        <AvatarFallback className="text-xs">
                                                            {getPlayerInitials(player)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 text-left">
                                                        <span className="font-medium">{getPlayerDisplay(player)}</span>
                                                        {player.level && (
                                                            <span className="ml-2 text-xs opacity-70">
                                                                Nível {player.level}
                                                            </span>
                                                        )}
                                                    </div>
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="guest" className="mt-4 space-y-4">
                            {/* Team Selection */}
                            <div>
                                <p className="text-sm text-muted-foreground mb-3">Qual time?</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {([teamHome, teamAway] as TeamColor[]).map((team) => (
                                        <Button
                                            key={team}
                                            variant={selectedTeam === team ? "default" : "outline"}
                                            className={`h-14 rounded-xl ${selectedTeam === team ? "bg-primary ring-2 ring-primary" : ""}`}
                                            onClick={() => setSelectedTeam(team)}
                                        >
                                            <TeamLogo teamColor={team} size="sm" className="mr-2" />
                                            {teamNames[team]}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Guest Name Input */}
                            {selectedTeam && (
                                <div>
                                    <p className="text-sm text-muted-foreground mb-3">Nome do Convidado:</p>
                                    <Input
                                        placeholder="Ex: João da Silva"
                                        value={guestName}
                                        onChange={(e) => setGuestName(e.target.value)}
                                        className="h-12 text-base"
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">
                                        O jogador será marcado com "(Avulso)" e não aparecerá na classificação.
                                    </p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>

                <DrawerFooter className="border-t border-border/50">
                    <Button
                        onClick={handleSubmit}
                        className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-lg font-semibold"
                        disabled={loading || !isValid}
                    >
                        {loading ? (
                            <Loader2 size={20} className="mr-2 animate-spin" />
                        ) : (
                            <Check size={20} className="mr-2" />
                        )}
                        {activeTab === "existing" ? "Adicionar à Escalação" : "Adicionar Avulso"}
                    </Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
