import { Goal, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

interface GoalFormDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teamHome: TeamColor;
    teamAway: TeamColor;
    getPlayersOnField: (team: string) => Player[];
    onSubmit: () => void;
    loading: boolean;
    displayMinute: string;
    goalData: {
        team: string;
        player_id: string;
        has_assist: boolean;
        assist_player_id: string;
        is_own_goal: boolean;
    };
    setGoalData: (data: any) => void;
}

const teamNames: Record<string, string> = {
    branco: "Branco",
    preto: "Preto",
    azul: "Azul",
    laranja: "Laranja",
};

export function GoalFormDrawer({
    open,
    onOpenChange,
    teamHome,
    teamAway,
    getPlayersOnField,
    onSubmit,
    loading,
    displayMinute,
    goalData,
    setGoalData,
}: GoalFormDrawerProps) {
    const handleClose = () => {
        onOpenChange(false);
        setGoalData({
            team: "",
            player_id: "",
            has_assist: false,
            assist_player_id: "",
            is_own_goal: false,
        });
    };

    const handleSubmit = () => {
        onSubmit();
        // Only close the drawer, don't reset data
        // The parent component (ManageMatch) will handle resetting after successful save
        onOpenChange(false);
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

    const opposingTeam = goalData.team === teamHome ? teamAway : teamHome;

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="max-h-[85vh]">
                <DrawerHeader className="border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <DrawerTitle className="text-emerald-400 flex items-center gap-2">
                            <Goal size={20} />
                            Registrar Gol
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
                        <p className="text-sm text-muted-foreground mb-3">Qual time marcou?</p>
                        <div className="grid grid-cols-2 gap-3">
                            {([teamHome, teamAway] as TeamColor[]).map((team) => (
                                <Button
                                    key={team}
                                    variant={goalData.team === team ? "default" : "outline"}
                                    className={`h-14 rounded-xl ${goalData.team === team ? "bg-primary ring-2 ring-primary" : ""}`}
                                    onClick={() =>
                                        setGoalData({
                                            ...goalData,
                                            team,
                                            player_id: "",
                                            has_assist: false,
                                            assist_player_id: "",
                                            is_own_goal: false,
                                        })
                                    }
                                >
                                    <TeamLogo teamColor={team} size="sm" className="mr-2" />
                                    {teamNames[team]}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Player Selection - Vertical List */}
                    {goalData.team && !goalData.is_own_goal && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-3">Quem marcou?</p>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {getPlayersOnField(goalData.team).map((player) => (
                                    <Button
                                        key={player.id}
                                        variant={goalData.player_id === player.id ? "default" : "outline"}
                                        className={`w-full h-14 justify-start gap-3 rounded-xl ${goalData.player_id === player.id
                                            ? "bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-500"
                                            : ""
                                            }`}
                                        onClick={() => setGoalData({ ...goalData, player_id: player.id })}
                                    >
                                        <Avatar className="h-9 w-9 border border-border/50">
                                            <AvatarImage src={player.avatar_url || undefined} />
                                            <AvatarFallback className="text-xs">{getPlayerInitials(player)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{getPlayerDisplay(player)}</span>
                                    </Button>
                                ))}
                                {/* Own Goal Option */}
                                <Button
                                    variant="outline"
                                    className="w-full h-14 justify-start gap-3 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10"
                                    onClick={() =>
                                        setGoalData({
                                            ...goalData,
                                            is_own_goal: true,
                                            player_id: "",
                                            has_assist: false,
                                            assist_player_id: "",
                                        })
                                    }
                                >
                                    <div className="h-9 w-9 rounded-full bg-destructive/20 flex items-center justify-center">
                                        <span className="text-xs font-bold">GC</span>
                                    </div>
                                    <span className="font-medium">Gol Contra</span>
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Own Goal - Opposing Player Selection */}
                    {goalData.team && goalData.is_own_goal && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm text-destructive font-medium">GOL CONTRA - Quem fez?</p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-muted-foreground"
                                    onClick={() => setGoalData({ ...goalData, is_own_goal: false, player_id: "" })}
                                >
                                    Cancelar
                                </Button>
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {getPlayersOnField(opposingTeam).map((player) => (
                                    <Button
                                        key={player.id}
                                        variant={goalData.player_id === player.id ? "default" : "outline"}
                                        className={`w-full h-14 justify-start gap-3 rounded-xl ${goalData.player_id === player.id
                                            ? "bg-destructive hover:bg-destructive/90 ring-2 ring-destructive"
                                            : "border-destructive/50"
                                            }`}
                                        onClick={() => setGoalData({ ...goalData, player_id: player.id })}
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

                    {/* Assist Toggle */}
                    {goalData.player_id && !goalData.is_own_goal && (
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                            <span className="text-sm font-medium">Houve assistência?</span>
                            <Switch
                                checked={goalData.has_assist}
                                onCheckedChange={(checked) =>
                                    setGoalData({ ...goalData, has_assist: checked, assist_player_id: "" })
                                }
                            />
                        </div>
                    )}

                    {/* Assist Player Selection */}
                    {goalData.has_assist && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-3">Quem assistiu?</p>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {getPlayersOnField(goalData.team)
                                    .filter((p) => p.id !== goalData.player_id)
                                    .map((player) => (
                                        <Button
                                            key={player.id}
                                            variant={goalData.assist_player_id === player.id ? "default" : "outline"}
                                            className={`w-full h-14 justify-start gap-3 rounded-xl ${goalData.assist_player_id === player.id ? "bg-primary ring-2 ring-primary" : ""
                                                }`}
                                            onClick={() => setGoalData({ ...goalData, assist_player_id: player.id })}
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
                        className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-lg font-semibold"
                        disabled={
                            loading ||
                            !goalData.team ||
                            !goalData.player_id ||
                            (goalData.has_assist && !goalData.assist_player_id)
                        }
                    >
                        <Check size={20} className="mr-2" />
                        Confirmar Gol ({displayMinute}')
                    </Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
