import { ArrowLeftRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamLogo } from "@/components/match/TeamLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerFooter,
    DrawerClose,
} from "@/components/ui/drawer";

interface Player {
    id: string;
    name: string;
    nickname: string | null;
    avatar_url?: string | null;
    position: "goleiro" | "defensor" | "meio-campista" | "atacante" | null;
    level?: string;
}

type TeamColor = "branco" | "preto" | "azul" | "laranja";

interface SubstitutionFormDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teamHome: TeamColor;
    teamAway: TeamColor;
    getPlayersOnField: (team: string) => Player[];
    availablePlayersIn: Player[];
    onSubmit: () => void;
    loading: boolean;
    displayMinute: string;
    subData: {
        team: string;
        player_out_id: string;
        player_in_id: string;
    };
    setSubData: (data: any) => void;
    loadAvailablePlayersIn: (team: string) => void;
}

const teamNames: Record<string, string> = {
    branco: "Branco",
    preto: "Preto",
    azul: "Azul",
    laranja: "Laranja",
};

export function SubstitutionFormDrawer({
    open,
    onOpenChange,
    teamHome,
    teamAway,
    getPlayersOnField,
    availablePlayersIn,
    onSubmit,
    loading,
    displayMinute,
    subData,
    setSubData,
    loadAvailablePlayersIn,
}: SubstitutionFormDrawerProps) {
    const handleClose = () => {
        onOpenChange(false);
        setSubData({
            team: "",
            player_out_id: "",
            player_in_id: "",
        });
    };

    const handleSubmit = () => {
        onSubmit();
        handleClose();
    };

    const handleTeamSelect = (team: string) => {
        setSubData({ ...subData, team, player_out_id: "", player_in_id: "" });
        loadAvailablePlayersIn(team);
    };

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

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="max-h-[85vh]">
                <DrawerHeader className="border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <DrawerTitle className="text-muted-foreground flex items-center gap-2">
                            <ArrowLeftRight size={20} />
                            Registrar Substituição
                        </DrawerTitle>
                        <DrawerClose asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10">
                                <X size={18} />
                            </Button>
                        </DrawerClose>
                    </div>
                </DrawerHeader>

                <div className="overflow-y-auto px-4 py-4 space-y-5">
                    {/* Team Selection */}
                    <div>
                        <p className="text-sm text-muted-foreground mb-3">Qual time?</p>
                        <div className="grid grid-cols-2 gap-3">
                            {([teamHome, teamAway] as TeamColor[]).map((team) => (
                                <Button
                                    key={team}
                                    variant={subData.team === team ? "default" : "outline"}
                                    className={`h-14 rounded-xl ${subData.team === team ? "bg-primary ring-2 ring-primary" : ""}`}
                                    onClick={() => handleTeamSelect(team)}
                                >
                                    <TeamLogo teamColor={team} size="sm" className="mr-2" />
                                    {teamNames[team]}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Player OUT Selection */}
                    {subData.team && (
                        <div>
                            <p className="text-sm text-destructive mb-3 flex items-center gap-2">
                                <span className="h-5 w-5 bg-destructive/20 rounded-full flex items-center justify-center text-xs">↓</span>
                                Quem sai?
                            </p>
                            <div className="space-y-2 max-h-[180px] overflow-y-auto">
                                {getPlayersOnField(subData.team).map((player) => (
                                    <Button
                                        key={player.id}
                                        variant={subData.player_out_id === player.id ? "default" : "outline"}
                                        className={`w-full h-14 justify-start gap-3 rounded-xl ${subData.player_out_id === player.id
                                            ? "bg-destructive/80 hover:bg-destructive ring-2 ring-destructive"
                                            : "border-destructive/30"
                                            }`}
                                        onClick={() => setSubData({ ...subData, player_out_id: player.id })}
                                    >
                                        <Avatar className="h-9 w-9 border border-border/50">
                                            <AvatarImage src={player.avatar_url || undefined} />
                                            <AvatarFallback className="text-xs">{getPlayerInitials(player)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{getPlayerDisplay(player)}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Player IN Selection */}
                    {subData.player_out_id && (
                        <div>
                            <p className="text-sm text-emerald-400 mb-3 flex items-center gap-2">
                                <span className="h-5 w-5 bg-emerald-500/20 rounded-full flex items-center justify-center text-xs">↑</span>
                                Quem entra?
                            </p>
                            {availablePlayersIn.length === 0 ? (
                                <p className="text-center text-muted-foreground py-6">
                                    Nenhum jogador disponível para substituição
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                                    {availablePlayersIn.map((player) => (
                                        <Button
                                            key={player.id}
                                            variant={subData.player_in_id === player.id ? "default" : "outline"}
                                            className={`w-full h-14 justify-start gap-3 rounded-xl ${subData.player_in_id === player.id
                                                ? "bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-500"
                                                : "border-emerald-500/30"
                                                }`}
                                            onClick={() => setSubData({ ...subData, player_in_id: player.id })}
                                        >
                                            <Avatar className="h-9 w-9 border border-border/50">
                                                <AvatarImage src={player.avatar_url || undefined} />
                                                <AvatarFallback className="text-xs">{getPlayerInitials(player)}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{getPlayerDisplay(player)}</span>
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DrawerFooter className="border-t border-border/50">
                    <Button
                        onClick={handleSubmit}
                        className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-lg font-semibold"
                        disabled={loading || !subData.team || !subData.player_out_id || !subData.player_in_id}
                    >
                        <Check size={20} className="mr-2" />
                        Confirmar Substituição ({displayMinute}')
                    </Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
