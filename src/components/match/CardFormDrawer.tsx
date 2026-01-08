import { Square, Check, X } from "lucide-react";
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

interface CardFormDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teamHome: TeamColor;
    teamAway: TeamColor;
    getPlayersOnField: (team: string) => Player[];
    onSubmit: () => void;
    loading: boolean;
    displayMinute: string;
    cardData: {
        team: string;
        player_id: string;
        card_type: string;
    };
    setCardData: (data: any) => void;
}

const teamNames: Record<string, string> = {
    branco: "Branco",
    preto: "Preto",
    azul: "Azul",
    laranja: "Laranja",
};

export function CardFormDrawer({
    open,
    onOpenChange,
    teamHome,
    teamAway,
    getPlayersOnField,
    onSubmit,
    loading,
    displayMinute,
    cardData,
    setCardData,
}: CardFormDrawerProps) {
    const handleClose = () => {
        onOpenChange(false);
        setCardData({
            team: "",
            player_id: "",
            card_type: "",
        });
    };

    const handleSubmit = () => {
        onSubmit();
        handleClose();
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
                        <DrawerTitle className="text-amber-400 flex items-center gap-2">
                            <Square size={18} />
                            Registrar Cartão
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
                                    variant={cardData.team === team ? "default" : "outline"}
                                    className={`h-14 rounded-xl ${cardData.team === team ? "bg-primary ring-2 ring-primary" : ""}`}
                                    onClick={() => setCardData({ ...cardData, team, player_id: "" })}
                                >
                                    <TeamLogo teamColor={team} size="sm" className="mr-2" />
                                    {teamNames[team]}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Card Type Selection */}
                    {cardData.team && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-3">Tipo de cartão:</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant={cardData.card_type === "amarelo" ? "default" : "outline"}
                                    className={`h-14 rounded-xl flex items-center gap-3 ${cardData.card_type === "amarelo"
                                        ? "bg-yellow-500 hover:bg-yellow-600 text-black ring-2 ring-yellow-400"
                                        : "border-yellow-500/50 text-yellow-500"
                                        }`}
                                    onClick={() => setCardData({ ...cardData, card_type: "amarelo" })}
                                >
                                    <div className="h-8 w-6 bg-yellow-400 rounded-sm shadow-md" />
                                    <span className="font-medium">Amarelo</span>
                                </Button>
                                <Button
                                    variant={cardData.card_type === "azul" ? "default" : "outline"}
                                    className={`h-14 rounded-xl flex items-center gap-3 ${cardData.card_type === "azul"
                                        ? "bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-400"
                                        : "border-blue-500/50 text-blue-500"
                                        }`}
                                    onClick={() => setCardData({ ...cardData, card_type: "azul" })}
                                >
                                    <div className="h-8 w-6 bg-blue-500 rounded-sm shadow-md" />
                                    <span className="font-medium">Azul</span>
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Player Selection - Vertical List */}
                    {cardData.team && cardData.card_type && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-3">Qual jogador?</p>
                            <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                {getPlayersOnField(cardData.team).map((player) => (
                                    <Button
                                        key={player.id}
                                        variant={cardData.player_id === player.id ? "default" : "outline"}
                                        className={`w-full h-14 justify-start gap-3 rounded-xl ${cardData.player_id === player.id
                                            ? cardData.card_type === "amarelo"
                                                ? "bg-yellow-500 hover:bg-yellow-600 text-black ring-2 ring-yellow-400"
                                                : "bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-400"
                                            : ""
                                            }`}
                                        onClick={() => setCardData({ ...cardData, player_id: player.id })}
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
                </div>

                <DrawerFooter className="border-t border-border/50">
                    <Button
                        onClick={handleSubmit}
                        className={`w-full h-14 rounded-xl text-lg font-semibold ${cardData.card_type === "amarelo"
                            ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                            : cardData.card_type === "azul"
                                ? "bg-blue-600 hover:bg-blue-700"
                                : "bg-amber-500 hover:bg-amber-600"
                            }`}
                        disabled={loading || !cardData.team || !cardData.player_id || !cardData.card_type}
                    >
                        <Check size={20} className="mr-2" />
                        Confirmar Cartão ({displayMinute}')
                    </Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
