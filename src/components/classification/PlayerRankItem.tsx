import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { PlayerStats } from "@/pages/Classification";

interface PlayerRankItemProps {
    player: PlayerStats;
    rank: number;
    isAdmin: boolean;
    onEdit: (player: PlayerStats) => void;
}

export function PlayerRankItem({ player, rank, isAdmin, onEdit }: PlayerRankItemProps) {
    const navigate = useNavigate();

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit(player);
    };

    return (
        <div
            onClick={() => navigate(`/profile/${player.player_id}`)}
            className="group flex items-center p-3 rounded-xl bg-[#1c1c1e] border border-white/5 hover:bg-white/5 hover:border-pink-500/20 transition-all duration-200 cursor-pointer active:scale-[0.98]"
        >
            <span className="w-8 text-center font-bold text-lg text-pink-300/80">
                {rank}
            </span>
            <Avatar className="h-10 w-10 ml-2 ring-2 ring-white/10 group-hover:ring-pink-500/30 transition-all">
                {player.avatar_url ? (
                    <AvatarImage src={player.avatar_url} alt={player.nickname} className="object-cover" />
                ) : (
                    <AvatarFallback className="text-xs">
                        {player.nickname.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                )}
            </Avatar>
            <div className="flex-1 min-w-0 ml-3">
                <div className="font-bold text-sm text-white truncate group-hover:text-pink-300 transition-colors">
                    {player.nickname}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {player.level && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-[#472639] text-[#F9A8D4]">
                            Nível {player.level}
                        </span>
                    )}
                    <span className="text-xs text-gray-400">
                        {player.presencas}P • {player.vitorias}V • {player.empates}E • {player.derrotas}D • {player.saldo_gols}S
                    </span>
                </div>
            </div>
            <div className="flex items-center">
                {isAdmin && (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full mr-2"
                        onClick={handleEditClick}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
                <div className="text-right">
                    <span className="font-black text-xl text-white block">
                        {player.pontos_totais}
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">PTS</span>
                </div>
            </div>
        </div>
    );
}