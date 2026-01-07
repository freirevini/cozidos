import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlayerActionMenu, type PlayerActionMenuProps } from "./PlayerActionMenu";

export interface Player {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  email: string | null;
  birth_date: string | null;
  is_player: boolean;
  level: string | null;
  position: string | null;
  status: string | null;
  user_id: string | null;
  avatar_url: string | null;
  claim_token: string | null;
  created_by_admin_simple: boolean | null;
  player_type_detail: string | null;
}

interface PlayerCompactCardProps {
  player: Player;
  onEdit: (player: Player) => void;
  onDelete: (player: Player) => void;
  onUnlink: (player: Player) => void;
  onApprove: (player: Player) => void;
  onReject: (player: Player) => void;
  onLinkPlayer: (player: Player) => void;
  onEditAvatar: (player: Player) => void;
  onCopyToken: (token: string) => void;
  onCopyInviteLink: (token: string) => void;
  onGenerateToken: (playerId: string) => void;
  onViewProfile?: (player: Player) => void;
}

const positionIcons: Record<string, { icon: string; label: string }> = {
  goleiro: { icon: "🧤", label: "GOL" },
  defensor: { icon: "🛡️", label: "DEF" },
  "meio-campista": { icon: "⚙️", label: "MEI" },
  atacante: { icon: "⚡", label: "ATA" },
};

const statusConfig: Record<string, { color: string; label: string }> = {
  pendente: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Pendente" },
  aprovado: { color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Aprovado" },
  congelado: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", label: "Congelado" },
  rejeitado: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Rejeitado" },
  inativo: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", label: "Inativo" },
};

const levelColors: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  D: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  E: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function PlayerCompactCard({
  player,
  onEdit,
  onDelete,
  onUnlink,
  onApprove,
  onReject,
  onLinkPlayer,
  onEditAvatar,
  onCopyToken,
  onCopyInviteLink,
  onGenerateToken,
  onViewProfile,
}: PlayerCompactCardProps) {
  const displayName = player.nickname || player.first_name || player.name || "Sem nome";
  const position = player.position ? positionIcons[player.position] : null;
  const status = player.status ? statusConfig[player.status] : statusConfig.pendente;
  const level = player.level ? levelColors[player.level] : null;

  const initials = displayName
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/50 hover:bg-card/80 hover:border-primary/30 transition-all duration-200">
      {/* Clickable area for profile navigation */}
      <div
        className={`flex items-center gap-3 flex-1 min-w-0 ${onViewProfile ? 'cursor-pointer' : ''}`}
        onClick={() => onViewProfile?.(player)}
      >
        {/* Avatar */}
        <Avatar className="h-10 w-10 border border-border/50 bg-muted shrink-0">
          <AvatarImage src={player.avatar_url || undefined} alt={displayName} />
          <AvatarFallback className="bg-muted text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground truncate">
              {displayName}
            </span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 mt-1">
            {/* Posição */}
            {position && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                {position.icon} {position.label}
              </span>
            )}

            {/* Nível */}
            {player.level && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${level}`}>
                {player.level}
              </Badge>
            )}

            {/* Status */}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${status.color}`}>
              {status.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Menu de ações */}
      <PlayerActionMenu
        player={player}
        onEdit={() => onEdit(player)}
        onDelete={() => onDelete(player)}
        onUnlink={() => onUnlink(player)}
        onApprove={() => onApprove(player)}
        onReject={() => onReject(player)}
        onLinkPlayer={() => onLinkPlayer(player)}
        onEditAvatar={() => onEditAvatar(player)}
        onCopyToken={onCopyToken}
        onCopyInviteLink={onCopyInviteLink}
        onGenerateToken={onGenerateToken}
      />
    </div>
  );
}
